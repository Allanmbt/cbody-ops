-- ========================================
-- 订单统计 RPC 函数
-- ========================================
-- 目的：将6次查询合并为1次，性能提升5-6倍
-- ========================================

CREATE OR REPLACE FUNCTION get_order_stats(
  p_today_start TIMESTAMPTZ,
  p_ten_minutes_ago TIMESTAMPTZ
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- 一次性统计所有数据（所有统计都基于今日6:00后创建的订单）
  SELECT json_build_object(
    'pending', COUNT(*) FILTER (WHERE status = 'pending' AND created_at >= p_today_start),
    'pending_overtime', COUNT(*) FILTER (WHERE status = 'pending' AND created_at >= p_today_start AND created_at < p_ten_minutes_ago),
    'active', COUNT(*) FILTER (WHERE status IN ('confirmed', 'en_route', 'arrived', 'in_service') AND created_at >= p_today_start),
    'active_abnormal', 0,  -- TODO: 后续实现异常检测逻辑
    'today_completed', COUNT(*) FILTER (WHERE status = 'completed' AND created_at >= p_today_start),
    'today_cancelled', (
      SELECT COUNT(*)
      FROM order_cancellations oc
      JOIN orders o ON oc.order_id = o.id
      WHERE oc.cancelled_at >= p_today_start
        AND o.created_at >= p_today_start
    )
  )
  INTO v_result
  FROM orders;

  RETURN v_result;
END;
$$;

-- 授权
GRANT EXECUTE ON FUNCTION get_order_stats(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ========================================
-- 使用示例
-- ========================================
-- SELECT get_order_stats(
--   '2024-01-01 00:00:00+00'::timestamptz,
--   NOW() - INTERVAL '10 minutes'
-- );
-- ========================================
