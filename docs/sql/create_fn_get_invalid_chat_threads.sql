-- 创建函数：获取无效聊天线程ID列表
-- 无效线程定义：c2g类型、无已完成订单、创建时间超过指定天数
-- 优化版本：使用一次性JOIN查询，避免循环查询

CREATE OR REPLACE FUNCTION get_invalid_chat_threads(days_threshold INTEGER DEFAULT 30)
RETURNS TABLE(thread_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT ct.id AS thread_id
  FROM chat_threads ct
  LEFT JOIN orders o
    ON ct.customer_id = o.user_id
    AND ct.girl_id = o.girl_id
    AND o.status = 'completed'
  WHERE ct.thread_type = 'c2g'
    AND ct.created_at < NOW() - (days_threshold || ' days')::INTERVAL
  GROUP BY ct.id
  HAVING COUNT(o.id) = 0;
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION get_invalid_chat_threads(INTEGER) IS '获取无效聊天线程ID列表（无已完成订单且超过指定天数的c2g线程）';

