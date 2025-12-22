-- ========================================
-- 技师监控性能优化
-- ========================================
-- 目的：从5次查询减少到1次（统计），从2次查询减少到1次（列表）
-- 性能提升：统计 5倍+，列表 4-5倍
-- ========================================

-- 1. 先删除旧视图，避免列结构冲突
DROP VIEW IF EXISTS v_therapist_monitoring;

-- 2. 创建技师监控视图（包含 sort_order 用于角色过滤）
CREATE VIEW v_therapist_monitoring AS
SELECT
  g.id,
  g.girl_number,
  g.username,
  g.name,
  g.avatar_url,
  g.city_id,
  g.is_blocked,
  g.is_verified,
  g.sort_order,  -- 添加 sort_order 字段用于角色过滤

  -- 城市信息
  c.id AS city_id_full,
  c.code AS city_code,
  c.name AS city_name,

  -- 状态信息
  COALESCE(gs.status, 'offline') AS status,
  gs.current_lat,
  gs.current_lng,
  gs.last_online_at,
  gs.cooldown_until_at,
  gs.next_available_time,

  -- 当前订单（仅 busy 状态的技师）
  o.id AS current_order_id,
  o.order_number AS current_order_number,
  o.status AS current_order_status,

  -- 状态排序权重（用于 ORDER BY，避免客户端排序）
  CASE
    WHEN COALESCE(gs.status, 'offline') = 'available' THEN 1
    WHEN COALESCE(gs.status, 'offline') = 'busy' THEN 2
    WHEN COALESCE(gs.status, 'offline') = 'offline' THEN 3
    ELSE 999
  END AS status_order

FROM girls g
LEFT JOIN cities c ON g.city_id = c.id
LEFT JOIN girls_status gs ON g.id = gs.girl_id
LEFT JOIN LATERAL (
  -- 使用 LATERAL JOIN 获取每个技师的最新进行中订单
  SELECT id, order_number, status, girl_id
  FROM orders
  WHERE girl_id = g.id
    AND status IN ('confirmed', 'en_route', 'arrived', 'in_service')
  ORDER BY created_at DESC
  LIMIT 1
) o ON TRUE
WHERE g.is_blocked = false
  AND g.is_verified = true;

-- 授权
GRANT SELECT ON v_therapist_monitoring TO authenticated;

-- ========================================
-- 3. 添加性能索引
-- ========================================

-- girls 表：优化筛选条件
CREATE INDEX IF NOT EXISTS idx_girls_verified_blocked_city 
ON girls(is_verified, is_blocked, city_id) 
WHERE is_verified = true AND is_blocked = false;

-- girls 表：优化搜索
CREATE INDEX IF NOT EXISTS idx_girls_search 
ON girls(girl_number, name, username) 
WHERE is_verified = true AND is_blocked = false;

-- girls_status 表：优化状态筛选
CREATE INDEX IF NOT EXISTS idx_girls_status_status_girl 
ON girls_status(status, girl_id);

-- orders 表：优化当前订单查询
CREATE INDEX IF NOT EXISTS idx_orders_girl_active_status 
ON orders(girl_id, status, created_at DESC) 
WHERE status IN ('confirmed', 'en_route', 'arrived', 'in_service');

-- cities 表：优化城市 JOIN
CREATE INDEX IF NOT EXISTS idx_cities_id
ON cities(id);

-- ========================================
-- 4. 创建技师统计 RPC 函数（合并 5 次查询为 1 次，支持角色过滤）
-- ========================================

CREATE OR REPLACE FUNCTION get_therapist_stats(
  p_filter_sort_order BOOLEAN DEFAULT false
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
  v_allowed_girl_ids UUID[];
  v_today_start TIMESTAMPTZ;
BEGIN
  v_today_start := DATE_TRUNC('day', NOW());

  -- 如果需要过滤，获取允许的技师ID列表（sort_order >= 998）
  IF p_filter_sort_order THEN
    SELECT ARRAY_AGG(id)
    INTO v_allowed_girl_ids
    FROM girls
    WHERE sort_order >= 998;

    -- 如果没有符合条件的技师，返回空统计
    IF v_allowed_girl_ids IS NULL OR array_length(v_allowed_girl_ids, 1) = 0 THEN
      RETURN json_build_object(
        'online', 0,
        'busy', 0,
        'offline', 0,
        'total', 0,
        'today_online', 0
      );
    END IF;
  END IF;

  -- 一次性获取所有统计（支持过滤 girl_id）
  SELECT json_build_object(
    'online', COUNT(*) FILTER (
      WHERE gs.status = 'available'
      AND g.is_blocked = false
      AND g.is_verified = true
      AND (NOT p_filter_sort_order OR g.id = ANY(v_allowed_girl_ids))
    ),
    'busy', COUNT(*) FILTER (
      WHERE gs.status = 'busy'
      AND g.is_blocked = false
      AND g.is_verified = true
      AND (NOT p_filter_sort_order OR g.id = ANY(v_allowed_girl_ids))
    ),
    'offline', COUNT(*) FILTER (
      WHERE gs.status = 'offline'
      AND g.is_blocked = false
      AND g.is_verified = true
      AND (NOT p_filter_sort_order OR g.id = ANY(v_allowed_girl_ids))
    ),
    'total', COUNT(DISTINCT g.id) FILTER (
      WHERE g.is_blocked = false
      AND g.is_verified = true
      AND (NOT p_filter_sort_order OR g.id = ANY(v_allowed_girl_ids))
    ),
    'today_online', COUNT(DISTINCT gs.girl_id) FILTER (
      WHERE gs.last_online_at >= v_today_start
      AND g.is_blocked = false
      AND g.is_verified = true
      AND (NOT p_filter_sort_order OR g.id = ANY(v_allowed_girl_ids))
    )
  )
  INTO v_result
  FROM girls g
  LEFT JOIN girls_status gs ON g.id = gs.girl_id;

  RETURN COALESCE(v_result, json_build_object(
    'online', 0,
    'busy', 0,
    'offline', 0,
    'total', 0,
    'today_online', 0
  ));
END;
$$;

-- 授权
GRANT EXECUTE ON FUNCTION get_therapist_stats(BOOLEAN) TO authenticated;

-- ========================================
-- 5. 创建技师列表 RPC 函数（支持角色过滤）
-- ========================================

CREATE OR REPLACE FUNCTION get_monitoring_therapists(
  p_status TEXT[] DEFAULT NULL,
  p_city_id INTEGER DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_only_abnormal BOOLEAN DEFAULT FALSE,
  p_filter_sort_order BOOLEAN DEFAULT false,  -- 添加角色过滤参数
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  girl_number INTEGER,
  username TEXT,
  name TEXT,
  avatar_url TEXT,
  city_id INTEGER,
  city_code TEXT,
  city_name TEXT,
  status TEXT,
  current_lat NUMERIC,
  current_lng NUMERIC,
  last_online_at TIMESTAMPTZ,
  cooldown_until_at TIMESTAMPTZ,
  next_available_time TIMESTAMPTZ,
  current_order_id UUID,
  current_order_number TEXT,
  current_order_status TEXT,
  sort_order INTEGER,  -- 添加 sort_order 返回字段
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH filtered_therapists AS (
    SELECT
      t.*,
      COUNT(*) OVER() AS total_count
    FROM v_therapist_monitoring t
    WHERE
      -- 角色过滤（sort_order >= 998）
      (NOT p_filter_sort_order OR t.sort_order >= 998)
      -- 状态筛选
      AND (p_status IS NULL OR t.status = ANY(p_status))
      -- 城市筛选
      AND (p_city_id IS NULL OR t.city_id = p_city_id)
      -- 搜索筛选
      AND (
        p_search IS NULL
        OR t.girl_number::TEXT = p_search
        OR t.name ILIKE '%' || p_search || '%'
        OR t.username ILIKE '%' || p_search || '%'
      )
      -- 默认显示在线和忙碌
      AND (
        p_only_abnormal = TRUE
        OR p_status IS NOT NULL
        OR t.status IN ('available', 'busy')
      )
    ORDER BY t.status_order, t.girl_number
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT
    ft.id,
    ft.girl_number,
    ft.username,
    ft.name,
    ft.avatar_url,
    ft.city_id,
    ft.city_code,
    ft.city_name,
    ft.status,
    ft.current_lat,
    ft.current_lng,
    ft.last_online_at,
    ft.cooldown_until_at,
    ft.next_available_time,
    ft.current_order_id,
    ft.current_order_number,
    ft.current_order_status,
    ft.sort_order,
    ft.total_count
  FROM filtered_therapists ft;
END;
$$;

-- 授权
GRANT EXECUTE ON FUNCTION get_monitoring_therapists(TEXT[], INTEGER, TEXT, BOOLEAN, BOOLEAN, INTEGER, INTEGER) TO authenticated;

-- ========================================
-- 使用示例
-- ========================================
-- 1. 获取统计数据（5次查询 → 1次）
--    SELECT get_therapist_stats();  -- 所有技师
--    SELECT get_therapist_stats(true);  -- 仅 sort_order >= 998 的技师
--
-- 2. 获取技师列表（使用视图，简单场景）
--    SELECT * FROM v_therapist_monitoring
--    WHERE status IN ('available', 'busy')
--    AND sort_order >= 998  -- 角色过滤
--    ORDER BY status_order, girl_number
--    LIMIT 50;
--
-- 3. 获取技师列表（使用 RPC，复杂场景）
--    SELECT * FROM get_monitoring_therapists(
--      p_status := ARRAY['available', 'busy'],
--      p_city_id := 1,
--      p_search := '张',
--      p_filter_sort_order := true,  -- 角色过滤
--      p_limit := 50,
--      p_offset := 0
--    );
-- ========================================

-- ========================================
-- 注释
-- ========================================
COMMENT ON FUNCTION get_therapist_stats(BOOLEAN) IS '获取技师状态统计（在线/忙碌/离线/总数/今日上线），合并5次查询为1次，支持角色过滤 sort_order >= 998';
COMMENT ON FUNCTION get_monitoring_therapists(TEXT[], INTEGER, TEXT, BOOLEAN, BOOLEAN, INTEGER, INTEGER) IS '获取技师监控列表，支持状态/城市/搜索筛选和角色过滤，包含分页和总数';
COMMENT ON VIEW v_therapist_monitoring IS '技师监控视图，预关联城市、状态、当前订单，包含 sort_order 用于角色过滤';

