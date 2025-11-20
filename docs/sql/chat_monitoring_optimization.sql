-- ========================================
-- 聊天会话监控性能优化
-- ========================================
-- 目的：从 200+ 次查询减少到 2 次
-- 性能提升：100 倍+
-- ========================================

-- 1. 创建会话统计 RPC 函数（合并 3 次查询为 1 次）
CREATE OR REPLACE FUNCTION get_chat_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  active_count INT;
  today_new_count INT;
  locked_count INT;
  yesterday TIMESTAMP;
  today_start TIMESTAMP;
BEGIN
  yesterday := NOW() - INTERVAL '24 hours';
  today_start := DATE_TRUNC('day', NOW());
  
  -- 一次性获取所有统计
  SELECT 
    COUNT(*) FILTER (WHERE last_message_at >= yesterday) AS active,
    COUNT(*) FILTER (WHERE created_at >= today_start) AS today_new,
    COUNT(*) FILTER (WHERE is_locked = true) AS locked
  INTO active_count, today_new_count, locked_count
  FROM chat_threads;
  
  result := json_build_object(
    'active', COALESCE(active_count, 0),
    'today_new', COALESCE(today_new_count, 0),
    'locked', COALESCE(locked_count, 0)
  );
  
  RETURN result;
END;
$$;

-- 2. 创建会话监控视图（预关联用户和技师信息）
CREATE OR REPLACE VIEW v_chat_monitoring AS
SELECT 
  ct.id,
  ct.thread_type,
  ct.customer_id,
  ct.girl_id,
  ct.support_id,
  ct.is_locked,
  ct.last_message_at,
  ct.last_message_text,
  ct.created_at,
  ct.updated_at,
  
  -- 客户信息
  customer.id AS customer_user_id,
  customer.username AS customer_username,
  customer.display_name AS customer_display_name,
  customer.avatar_url AS customer_avatar_url,
  
  -- 技师信息
  girl.id AS girl_id_full,
  girl.girl_number,
  girl.name AS girl_name,
  girl.username AS girl_username,
  girl.avatar_url AS girl_avatar_url,
  
  -- 客服信息
  support.id AS support_user_id,
  support.username AS support_username,
  support.display_name AS support_display_name,
  support.avatar_url AS support_avatar_url,
  
  -- 关联订单（通过子查询获取第一个关联订单）
  (
    SELECT json_build_object(
      'order_number', o.order_number,
      'id', o.id
    )
    FROM chat_messages cm
    INNER JOIN orders o ON cm.order_id = o.id
    WHERE cm.thread_id = ct.id AND cm.order_id IS NOT NULL
    LIMIT 1
  ) AS related_order
  
FROM chat_threads ct
LEFT JOIN user_profiles customer ON ct.customer_id = customer.id
LEFT JOIN girls girl ON ct.girl_id = girl.id
LEFT JOIN user_profiles support ON ct.support_id = support.id;

-- 3. 创建索引加速查询
CREATE INDEX IF NOT EXISTS idx_chat_threads_last_message 
  ON chat_threads(last_message_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_chat_threads_created 
  ON chat_threads(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_threads_type_active 
  ON chat_threads(thread_type, last_message_at DESC) 
  WHERE last_message_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_order 
  ON chat_messages(thread_id, order_id) 
  WHERE order_id IS NOT NULL;

-- 4. 注释
COMMENT ON FUNCTION get_chat_stats() IS '获取会话统计（活跃/今日新增/已锁定），合并3次查询为1次';
COMMENT ON VIEW v_chat_monitoring IS '会话监控视图，预关联用户、技师、客服信息和关联订单';
