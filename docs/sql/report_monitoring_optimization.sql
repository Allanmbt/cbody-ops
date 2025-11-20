-- ========================================
-- 举报处理性能优化
-- ========================================
-- 目的：从 4 次查询减少到 1 次
-- 性能提升：3-4 倍
-- ========================================

-- 1. 创建举报统计 RPC 函数（合并 4 次查询为 1 次）
CREATE OR REPLACE FUNCTION get_report_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  pending_count INT;
  today_new_count INT;
  girl_reports_count INT;
  customer_reports_count INT;
  today_start TIMESTAMP;
BEGIN
  today_start := DATE_TRUNC('day', NOW());
  
  -- 一次性获取所有统计
  SELECT 
    COUNT(*) FILTER (WHERE status = 'pending') AS pending,
    COUNT(*) FILTER (WHERE created_at >= today_start) AS today_new,
    COUNT(*) FILTER (WHERE reporter_role = 'girl') AS girl_reports,
    COUNT(*) FILTER (WHERE reporter_role = 'customer') AS customer_reports
  INTO pending_count, today_new_count, girl_reports_count, customer_reports_count
  FROM reports;
  
  result := json_build_object(
    'pending', COALESCE(pending_count, 0),
    'today_new', COALESCE(today_new_count, 0),
    'girl_reports', COALESCE(girl_reports_count, 0),
    'customer_reports', COALESCE(customer_reports_count, 0)
  );
  
  RETURN result;
END;
$$;

-- 2. 创建举报监控视图（预关联用户、技师、订单信息）
CREATE OR REPLACE VIEW v_report_monitoring AS
SELECT 
  r.id,
  r.reporter_id,
  r.reporter_role,
  r.target_user_id,
  r.report_type,
  r.description,
  r.screenshot_urls,
  r.status,
  r.thread_id,
  r.order_id,
  r.reviewed_by,
  r.reviewed_at,
  r.admin_notes,
  r.created_at,
  r.updated_at,
  
  -- 举报人信息（优先技师信息）
  CASE 
    WHEN reporter_girl.user_id IS NOT NULL THEN json_build_object(
      'user_id', reporter_girl.user_id,
      'display_name', reporter_girl.name,
      'avatar_url', reporter_girl.avatar_url,
      'girl_number', reporter_girl.girl_number,
      'girl_name', reporter_girl.name
    )
    ELSE json_build_object(
      'user_id', reporter_user.id,
      'display_name', reporter_user.display_name,
      'avatar_url', reporter_user.avatar_url
    )
  END AS reporter_profile,
  
  -- 被举报人信息（优先技师信息）
  CASE 
    WHEN target_girl.user_id IS NOT NULL THEN json_build_object(
      'user_id', target_girl.user_id,
      'display_name', target_girl.name,
      'avatar_url', target_girl.avatar_url,
      'girl_number', target_girl.girl_number,
      'girl_name', target_girl.name
    )
    ELSE json_build_object(
      'user_id', target_user.id,
      'display_name', target_user.display_name,
      'avatar_url', target_user.avatar_url
    )
  END AS target_profile,
  
  -- 关联订单
  CASE 
    WHEN o.id IS NOT NULL THEN json_build_object(
      'id', o.id,
      'order_number', o.order_number
    )
    ELSE NULL
  END AS order_info
  
FROM reports r
LEFT JOIN user_profiles reporter_user ON r.reporter_id = reporter_user.id
LEFT JOIN girls reporter_girl ON r.reporter_id = reporter_girl.user_id
LEFT JOIN user_profiles target_user ON r.target_user_id = target_user.id
LEFT JOIN girls target_girl ON r.target_user_id = target_girl.user_id
LEFT JOIN orders o ON r.order_id = o.id;

-- 3. 创建索引加速查询
CREATE INDEX IF NOT EXISTS idx_reports_status_created 
  ON reports(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reports_reporter_role_created 
  ON reports(reporter_role, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reports_order_id 
  ON reports(order_id) WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reports_created 
  ON reports(created_at DESC);

-- 4. 注释
COMMENT ON FUNCTION get_report_stats() IS '获取举报统计（待处理/今日新增/技师举报/客户举报），合并4次查询为1次';
COMMENT ON VIEW v_report_monitoring IS '举报监控视图，预关联举报人、被举报人、订单信息';
