-- ========================================
-- 订单管理性能优化
-- ========================================
-- 目的：从查询所有用户优化到视图查询
-- 性能提升：10-30 倍
-- ========================================

-- 1. 创建订单管理统计 RPC 函数（轻量级）
CREATE OR REPLACE FUNCTION get_admin_order_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  total_count INT;
  active_count INT;
  completed_count INT;
  cancelled_count INT;
BEGIN
  -- 一次性获取基础统计（4个查询合并为1个）
  SELECT 
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE status IN ('confirmed', 'en_route', 'arrived', 'in_service')) AS active,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed,
    COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled
  INTO total_count, active_count, completed_count, cancelled_count
  FROM orders;
  
  result := json_build_object(
    'total', COALESCE(total_count, 0),
    'active', COALESCE(active_count, 0),
    'completed', COALESCE(completed_count, 0),
    'cancelled', COALESCE(cancelled_count, 0)
  );
  
  RETURN result;
END;
$$;

-- 2. 创建订单管理列表视图（预关联所有信息）
CREATE OR REPLACE VIEW v_admin_orders_list AS
SELECT 
  o.id,
  o.order_number,
  o.girl_id,
  o.user_id,
  o.service_id,
  o.service_duration_id,
  o.service_name,
  o.service_duration,
  o.service_price,
  o.booking_mode,
  o.eta_minutes,
  o.estimated_arrival_at,
  o.service_address_id,
  o.address_snapshot,
  o.latitude,
  o.longitude,
  o.distance,
  o.currency,
  o.service_fee,
  o.travel_fee,
  o.extra_fee,
  o.discount_amount,
  o.total_amount,
  o.pricing_snapshot,
  o.status,
  o.service_started_at,
  o.completed_at,
  o.scheduled_start_at,
  o.queue_position,
  o.created_at,
  o.updated_at,
  
  -- 技师信息
  json_build_object(
    'id', g.id,
    'girl_number', g.girl_number,
    'username', g.username,
    'name', g.name,
    'avatar_url', g.avatar_url
  ) AS girl,
  
  -- 服务信息
  json_build_object(
    'id', s.id,
    'code', s.code,
    'title', s.title
  ) AS service,
  
  -- 时长信息
  json_build_object(
    'id', sd.id,
    'duration_minutes', sd.duration_minutes
  ) AS service_duration_detail,
  
  -- 用户信息（从 user_profiles 获取）
  json_build_object(
    'id', up.id,
    'display_name', up.display_name,
    'avatar_url', up.avatar_url
  ) AS user_profile
  
FROM orders o
LEFT JOIN girls g ON o.girl_id = g.id
LEFT JOIN services s ON o.service_id = s.id
LEFT JOIN service_durations sd ON o.service_duration_id = sd.id
LEFT JOIN user_profiles up ON o.user_id = up.id;

-- 3. 创建索引加速查询
-- 订单号索引（唯一）
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number 
  ON orders(order_number);

-- 状态 + 创建时间索引
CREATE INDEX IF NOT EXISTS idx_orders_status_created 
  ON orders(status, created_at DESC);

-- 技师ID + 创建时间索引
CREATE INDEX IF NOT EXISTS idx_orders_girl_created 
  ON orders(girl_id, created_at DESC);

-- 用户ID + 创建时间索引
CREATE INDEX IF NOT EXISTS idx_orders_user_created 
  ON orders(user_id, created_at DESC);

-- 完成时间索引
CREATE INDEX IF NOT EXISTS idx_orders_completed_at 
  ON orders(completed_at DESC) WHERE completed_at IS NOT NULL;

-- 更新时间索引
CREATE INDEX IF NOT EXISTS idx_orders_updated_at 
  ON orders(updated_at DESC);

-- 创建时间索引
CREATE INDEX IF NOT EXISTS idx_orders_created_at 
  ON orders(created_at DESC);

-- 4. 注释
COMMENT ON FUNCTION get_admin_order_stats() IS '获取订单管理基础统计（总数/进行中/已完成/已取消），轻量级设计';
COMMENT ON VIEW v_admin_orders_list IS '订单管理列表视图，预关联技师、服务、时长、用户信息，解决N+1查询';
