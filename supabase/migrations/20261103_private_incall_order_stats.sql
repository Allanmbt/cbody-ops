-- Private 到店订单统计：一次 RPC 返回期间汇总、门店/月度拆分和分页明细。
-- 仅使用订单与结算快照，不修改任何业务表或历史数据。

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

  WITH period_orders AS MATERIALIZED (
    SELECT
      o.id,
      o.order_number,
      o.completed_at,
      os.settled_at,
      COALESCE(NULLIF(o.incall_location_snapshot ->> 'location_id', ''), 'unknown') AS location_key,
      COALESCE(
        NULLIF(location.name, ''),
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
      os.extra_commission_rate,
      os.platform_should_get
    FROM public.orders AS o
    INNER JOIN public.order_settlements AS os
      ON os.order_id = o.id
     AND os.settlement_status = 'settled'
    LEFT JOIN public.girls AS g ON g.id = o.girl_id
    LEFT JOIN public.incall_locations AS location
      ON location.id::TEXT = o.incall_location_snapshot ->> 'location_id'
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
      COALESCE(SUM(platform_should_get), 0) AS platform_gross_profit
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
      COALESCE(SUM(platform_should_get), 0) AS platform_gross_profit
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
      COALESCE(SUM(platform_should_get), 0) AS platform_gross_profit
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
  IS 'Private Incall 已完成且已核验订单统计，按泰国财务月返回汇总与分页明细。';
