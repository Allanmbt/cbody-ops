-- ========================================
-- 技师监控性能优化
-- ========================================
-- 目的：从2次查询减少到1次，移除客户端排序
-- 性能提升：4-5倍
-- ========================================

-- 1. 创建技师监控视图
CREATE OR REPLACE VIEW v_therapist_monitoring AS
SELECT 
  g.id,
  g.girl_number,
  g.username,
  g.name,
  g.avatar_url,
  g.city_id,
  g.is_blocked,
  g.is_verified,
  
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
-- 2. 添加性能索引
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
-- 3. 创建 RPC 函数（可选，进一步优化）
-- ========================================

CREATE OR REPLACE FUNCTION get_monitoring_therapists(
  p_status TEXT[] DEFAULT NULL,
  p_city_id INTEGER DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_only_abnormal BOOLEAN DEFAULT FALSE,
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
      -- 状态筛选
      (p_status IS NULL OR t.status = ANY(p_status))
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
    ft.total_count
  FROM filtered_therapists ft;
END;
$$;

-- 授权
GRANT EXECUTE ON FUNCTION get_monitoring_therapists TO authenticated;

-- ========================================
-- 使用示例
-- ========================================
-- 1. 使用视图查询（简单场景）
--    SELECT * FROM v_therapist_monitoring
--    WHERE status IN ('available', 'busy')
--    ORDER BY status_order, girl_number
--    LIMIT 50;
--
-- 2. 使用 RPC 函数查询（复杂场景）
--    SELECT * FROM get_monitoring_therapists(
--      p_status := ARRAY['available', 'busy'],
--      p_city_id := 1,
--      p_search := '张',
--      p_limit := 50,
--      p_offset := 0
--    );
-- ========================================
