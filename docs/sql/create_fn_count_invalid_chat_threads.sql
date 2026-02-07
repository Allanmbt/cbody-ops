-- 创建函数：统计无效聊天线程数量
-- 无效线程定义：c2g类型、无已完成订单、创建时间超过指定天数

CREATE OR REPLACE FUNCTION count_invalid_chat_threads(days_threshold INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invalid_count INTEGER := 0;
BEGIN
  -- 统计无效线程数量（使用子查询）
  SELECT COUNT(*)
  INTO invalid_count
  FROM (
    SELECT ct.id
    FROM chat_threads ct
    LEFT JOIN orders o
      ON ct.customer_id = o.user_id
      AND ct.girl_id = o.girl_id
      AND o.status = 'completed'
    WHERE ct.thread_type = 'c2g'
      AND ct.created_at < NOW() - (days_threshold || ' days')::INTERVAL
    GROUP BY ct.id
    HAVING COUNT(o.id) = 0
  ) AS invalid_threads;

  RETURN COALESCE(invalid_count, 0);
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION count_invalid_chat_threads(INTEGER) IS '统计无效聊天线程数量（无已完成订单且超过指定天数的c2g线程）';
