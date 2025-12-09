-- ========================================
-- 订单统计 RPC 函数
-- ========================================
-- 目的：将6次查询合并为1次，性能提升5-6倍
-- 时间逻辑：以早晨6点为分界点
--   - 今天 = 今天6:00 到 明天6:00
--   - 昨天 = 昨天6:00 到 今天6:00
-- ========================================

CREATE OR REPLACE FUNCTION get_order_stats(
  p_today_start TIMESTAMPTZ,
  p_tomorrow_start TIMESTAMPTZ,
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
  -- 一次性统计所有数据（所有统计都基于今日6:00到明天6:00的订单）
  SELECT json_build_object(
    'pending', COUNT(*) FILTER (WHERE status = 'pending' AND created_at >= p_today_start AND created_at < p_tomorrow_start),
    'pending_overtime', COUNT(*) FILTER (WHERE status = 'pending' AND created_at >= p_today_start AND created_at < p_tomorrow_start AND created_at < p_ten_minutes_ago),
    'active', COUNT(*) FILTER (WHERE status IN ('confirmed', 'en_route', 'arrived', 'in_service') AND created_at >= p_today_start AND created_at < p_tomorrow_start),
    'active_abnormal', 0,  -- TODO: 后续实现异常检测逻辑
    'today_completed', COUNT(*) FILTER (WHERE status = 'completed' AND created_at >= p_today_start AND created_at < p_tomorrow_start),
    'today_cancelled', (
      SELECT COUNT(*)
      FROM order_cancellations oc
      JOIN orders o ON oc.order_id = o.id
      WHERE oc.cancelled_at >= p_today_start
        AND oc.cancelled_at < p_tomorrow_start
        AND o.created_at >= p_today_start
        AND o.created_at < p_tomorrow_start
    )
  )
  INTO v_result
  FROM orders;

  RETURN v_result;
END;
$$;

-- 授权
GRANT EXECUTE ON FUNCTION get_order_stats(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ========================================
-- 使用示例
-- ========================================
-- 当前时间：2024-12-09 14:00:00（下午2点）
-- 今天：2024-12-09 06:00:00 到 2024-12-10 06:00:00
-- SELECT get_order_stats(
--   '2024-12-09 06:00:00+08'::timestamptz,  -- 今天6点
--   '2024-12-10 06:00:00+08'::timestamptz,  -- 明天6点
--   NOW() - INTERVAL '10 minutes'           -- 10分钟前
-- );
-- ========================================
