-- 修正 Private 到店订单统计：
-- 1. 历史地址快照缺少 location_id 时按场所名称匹配，避免全部归入 unknown。
-- 2. 按 order_time_extensions 有效记录汇总多次加钟利润，并累计到平台总收益。

CREATE OR REPLACE FUNCTION public.get_private_incall_order_stats(
  p_period_mode TEXT,
  p_period_value TEXT,
  p_location_key TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_year INTEGER;
  v_month INTEGER;
  v_start_at TIMESTAMPTZ;
  v_end_at TIMESTAMPTZ;
  v_offset INTEGER;
  v_result JSONB;
BEGIN
  IF p_period_mode NOT IN ('month', 'year') THEN
    RAISE EXCEPTION '统计模式无效';
  END IF;
  IF p_page < 1 OR p_page_size < 1 OR p_page_size > 50 THEN
    RAISE EXCEPTION '分页参数无效';
  END IF;

  IF p_period_mode = 'month' THEN
    IF p_period_value !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN
      RAISE EXCEPTION '月份格式无效';
    END IF;
    v_year := split_part(p_period_value, '-', 1)::INTEGER;
    v_month := split_part(p_period_value, '-', 2)::INTEGER;
    v_start_at := make_timestamptz(v_year, v_month, 1, 6, 0, 0, 'Asia/Bangkok');
    v_end_at := v_start_at + INTERVAL '1 month';
  ELSE
    IF p_period_value !~ '^\d{4}$' THEN
      RAISE EXCEPTION '年份格式无效';
    END IF;
    v_year := p_period_value::INTEGER;
    v_start_at := make_timestamptz(v_year, 1, 1, 6, 0, 0, 'Asia/Bangkok');
    v_end_at := v_start_at + INTERVAL '1 year';
  END IF;

  IF v_year < 2000 OR v_year > 2100 THEN
    RAISE EXCEPTION '年份超出允许范围';
  END IF;

  v_offset := (p_page - 1) * p_page_size;

  WITH add_time_stats AS MATERIALIZED (
    SELECT
      extension.order_id,
      COUNT(*)::INTEGER AS add_time_count,
      COALESCE(SUM(extension.duration_minutes), 0)::INTEGER AS add_time_duration_minutes,
      COALESCE(SUM(extension.commission_thb_snapshot), 0)::NUMERIC(10, 2) AS add_time_commission_thb
    FROM public.order_time_extensions AS extension
    WHERE extension.settlement_status <> 'rejected'
    GROUP BY extension.order_id
  ),
  period_orders AS MATERIALIZED (
    SELECT
      o.id,
      o.order_number,
      o.completed_at,
      os.settled_at,
      COALESCE(
        matched_location.id::TEXT,
        NULLIF(o.incall_location_snapshot ->> 'location_id', ''),
        CASE
          WHEN NULLIF(BTRIM(o.incall_location_snapshot ->> 'name'), '') IS NOT NULL
            THEN 'name:' || LOWER(REGEXP_REPLACE(BTRIM(o.incall_location_snapshot ->> 'name'), '\s+', ' ', 'g'))
        END,
        'unknown'
      ) AS location_key,
      COALESCE(
        NULLIF(matched_location.name, ''),
        NULLIF(o.incall_location_snapshot ->> 'name', ''),
        '未知场所'
      ) AS location_name,
      o.girl_id,
      COALESCE(g.girl_number, 0) AS girl_number,
      COALESCE(NULLIF(g.name, ''), '未知技师') AS girl_name,
      o.service_name,
      o.service_duration,
      o.total_amount,
      os.service_commission_rate,
      ROUND(
        (os.service_fee * os.service_commission_rate)
        + (os.extra_fee * os.extra_commission_rate),
        2
      ) AS platform_should_get,
      COALESCE(add_time.add_time_count, 0) AS add_time_count,
      COALESCE(add_time.add_time_duration_minutes, 0) AS add_time_duration_minutes,
      COALESCE(add_time.add_time_commission_thb, 0)::NUMERIC(10, 2) AS add_time_commission_thb,
      (
        ROUND(
          (os.service_fee * os.service_commission_rate)
          + (os.extra_fee * os.extra_commission_rate),
          2
        ) + COALESCE(add_time.add_time_commission_thb, 0)
      )::NUMERIC(10, 2) AS total_platform_profit
    FROM public.orders AS o
    INNER JOIN public.order_settlements AS os
      ON os.order_id = o.id
     AND os.settlement_status = 'settled'
    LEFT JOIN public.girls AS g ON g.id = o.girl_id
    LEFT JOIN add_time_stats AS add_time ON add_time.order_id = o.id
    LEFT JOIN LATERAL (
      SELECT location.id, location.name
      FROM public.incall_locations AS location
      WHERE location.id::TEXT = NULLIF(o.incall_location_snapshot ->> 'location_id', '')
         OR LOWER(BTRIM(location.name)) = LOWER(BTRIM(o.incall_location_snapshot ->> 'name'))
      ORDER BY
        CASE
          WHEN location.id::TEXT = NULLIF(o.incall_location_snapshot ->> 'location_id', '') THEN 0
          ELSE 1
        END,
        location.created_at
      LIMIT 1
    ) AS matched_location ON TRUE
    WHERE o.service_type = 'incall'
      AND o.status = 'completed'
      AND o.completed_at >= v_start_at
      AND o.completed_at < v_end_at
  ),
  filtered_orders AS MATERIALIZED (
    SELECT *
    FROM period_orders
    WHERE p_location_key IS NULL OR location_key = p_location_key
  ),
  totals AS (
    SELECT
      COUNT(*) AS order_count,
      COALESCE(SUM(total_amount), 0) AS sales_amount,
      COALESCE(SUM(add_time_count), 0) AS add_time_count,
      COALESCE(SUM(add_time_duration_minutes), 0) AS add_time_duration_minutes,
      COALESCE(SUM(add_time_commission_thb), 0) AS add_time_profit,
      COALESCE(SUM(total_platform_profit), 0) AS platform_gross_profit
    FROM filtered_orders
  ),
  location_options AS (
    SELECT location_key, MAX(location_name) AS location_name
    FROM period_orders
    GROUP BY location_key
  ),
  location_stats AS (
    SELECT
      location_key,
      MAX(location_name) AS location_name,
      COUNT(*) AS order_count,
      COALESCE(SUM(total_amount), 0) AS sales_amount,
      COALESCE(SUM(add_time_count), 0) AS add_time_count,
      COALESCE(SUM(add_time_duration_minutes), 0) AS add_time_duration_minutes,
      COALESCE(SUM(add_time_commission_thb), 0) AS add_time_profit,
      COALESCE(SUM(total_platform_profit), 0) AS platform_gross_profit
    FROM filtered_orders
    GROUP BY location_key
  ),
  month_series AS (
    SELECT TO_CHAR(make_date(v_year, month_number, 1), 'YYYY-MM') AS month
    FROM generate_series(1, 12) AS month_number
    WHERE p_period_mode = 'year'
  ),
  month_stats AS (
    SELECT
      TO_CHAR(
        (completed_at AT TIME ZONE 'Asia/Bangkok') - INTERVAL '6 hours',
        'YYYY-MM'
      ) AS month,
      COUNT(*) AS order_count,
      COALESCE(SUM(total_amount), 0) AS sales_amount,
      COALESCE(SUM(add_time_count), 0) AS add_time_count,
      COALESCE(SUM(add_time_duration_minutes), 0) AS add_time_duration_minutes,
      COALESCE(SUM(add_time_commission_thb), 0) AS add_time_profit,
      COALESCE(SUM(total_platform_profit), 0) AS platform_gross_profit
    FROM filtered_orders
    WHERE p_period_mode = 'year'
    GROUP BY 1
  ),
  paged_orders AS (
    SELECT *
    FROM filtered_orders
    ORDER BY completed_at DESC, id DESC
    LIMIT p_page_size OFFSET v_offset
  )
  SELECT jsonb_build_object(
    'summary', (
      SELECT jsonb_build_object(
        'order_count', order_count,
        'sales_amount', sales_amount,
        'add_time_count', add_time_count,
        'add_time_duration_minutes', add_time_duration_minutes,
        'add_time_profit', add_time_profit,
        'platform_gross_profit', platform_gross_profit
      )
      FROM totals
    ),
    'location_options', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('location_key', location_key, 'location_name', location_name)
        ORDER BY location_name, location_key
      )
      FROM location_options
    ), '[]'::JSONB),
    'locations', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'location_key', location_key,
          'location_name', location_name,
          'order_count', order_count,
          'sales_amount', sales_amount,
          'add_time_count', add_time_count,
          'add_time_duration_minutes', add_time_duration_minutes,
          'add_time_profit', add_time_profit,
          'platform_gross_profit', platform_gross_profit
        )
        ORDER BY sales_amount DESC, location_name
      )
      FROM location_stats
    ), '[]'::JSONB),
    'months', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'month', series.month,
          'order_count', COALESCE(stats.order_count, 0),
          'sales_amount', COALESCE(stats.sales_amount, 0),
          'add_time_count', COALESCE(stats.add_time_count, 0),
          'add_time_duration_minutes', COALESCE(stats.add_time_duration_minutes, 0),
          'add_time_profit', COALESCE(stats.add_time_profit, 0),
          'platform_gross_profit', COALESCE(stats.platform_gross_profit, 0)
        )
        ORDER BY series.month
      )
      FROM month_series AS series
      LEFT JOIN month_stats AS stats ON stats.month = series.month
    ), '[]'::JSONB),
    'orders', COALESCE((
      SELECT jsonb_agg(to_jsonb(rows) ORDER BY rows.completed_at DESC, rows.id DESC)
      FROM paged_orders AS rows
    ), '[]'::JSONB),
    'pagination', (
      SELECT jsonb_build_object(
        'page', p_page,
        'page_size', p_page_size,
        'total', order_count,
        'total_pages', CASE
          WHEN order_count = 0 THEN 0
          ELSE CEIL(order_count::NUMERIC / p_page_size)::INTEGER
        END
      )
      FROM totals
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_private_incall_order_stats(TEXT, TEXT, TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_private_incall_order_stats(TEXT, TEXT, TEXT, INTEGER, INTEGER)
  TO service_role;

COMMENT ON FUNCTION public.get_private_incall_order_stats(TEXT, TEXT, TEXT, INTEGER, INTEGER)
  IS 'Private Incall 已完成且已核验订单统计；兼容历史场所快照并包含有效加钟佣金。';
