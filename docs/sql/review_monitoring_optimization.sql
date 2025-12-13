-- ========================================
-- 评论审核性能优化
-- ========================================
-- 目的：从 4 次查询减少到 1 次
-- 性能提升：3-4 倍
-- ========================================

-- 0. 启用 pg_trgm 扩展（用于模糊搜索）
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. 创建评论统计 RPC 函数（合并 4 次查询为 1 次）
CREATE OR REPLACE FUNCTION get_review_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  pending_count INT;
  today_new_count INT;
  approved_count INT;
  rejected_count INT;
  today_start TIMESTAMP;
BEGIN
  today_start := DATE_TRUNC('day', NOW());
  
  -- 一次性获取所有统计
  SELECT 
    COUNT(*) FILTER (WHERE status = 'pending') AS pending,
    COUNT(*) FILTER (WHERE created_at >= today_start) AS today_new,
    COUNT(*) FILTER (WHERE status = 'approved') AS approved,
    COUNT(*) FILTER (WHERE status = 'rejected') AS rejected
  INTO pending_count, today_new_count, approved_count, rejected_count
  FROM order_reviews;
  
  result := json_build_object(
    'pending', COALESCE(pending_count, 0),
    'today_new', COALESCE(today_new_count, 0),
    'approved', COALESCE(approved_count, 0),
    'rejected', COALESCE(rejected_count, 0)
  );
  
  RETURN result;
END;
$$;

-- 2. 创建评论监控视图（预关联订单、用户、技师信息）
DROP VIEW IF EXISTS v_review_monitoring;

CREATE VIEW v_review_monitoring AS
SELECT
  r.id,
  r.order_id,
  r.user_id,
  r.girl_id,
  r.service_id,
  r.rating_service,
  r.rating_attitude,
  r.rating_emotion,
  r.rating_similarity,
  r.rating_overall,
  r.comment_text,
  r.is_anonymous,
  r.min_user_level,
  r.status,
  r.reviewed_by,
  r.reviewed_at,
  r.reject_reason,
  r.created_at,
  r.updated_at,

  -- 技师工号和名称（用于搜索）
  g.girl_number,
  g.name AS girl_name,

  -- 订单信息
  CASE
    WHEN o.id IS NOT NULL THEN json_build_object(
      'id', o.id,
      'order_number', o.order_number
    )
    ELSE NULL
  END AS order_info,

  -- 评论者信息
  CASE
    WHEN u.id IS NOT NULL THEN json_build_object(
      'user_id', u.id,
      'display_name', u.display_name,
      'avatar_url', u.avatar_url
    )
    ELSE NULL
  END AS user_profile,

  -- 技师信息
  CASE
    WHEN g.id IS NOT NULL THEN json_build_object(
      'id', g.id,
      'girl_number', g.girl_number,
      'name', g.name,
      'avatar_url', g.avatar_url
    )
    ELSE NULL
  END AS girl_info

FROM order_reviews r
LEFT JOIN orders o ON r.order_id = o.id
LEFT JOIN user_profiles u ON r.user_id = u.id
LEFT JOIN girls g ON r.girl_id = g.id;

-- 3. 创建索引加速查询
CREATE INDEX IF NOT EXISTS idx_order_reviews_status_created
  ON order_reviews(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_reviews_girl_id
  ON order_reviews(girl_id) WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS idx_order_reviews_order_id
  ON order_reviews(order_id);

CREATE INDEX IF NOT EXISTS idx_order_reviews_user_id
  ON order_reviews(user_id);

CREATE INDEX IF NOT EXISTS idx_order_reviews_created
  ON order_reviews(created_at DESC);

-- 技师工号索引（用于搜索）
CREATE INDEX IF NOT EXISTS idx_girls_girl_number
  ON girls(girl_number);

-- 技师名称索引（用于搜索）
CREATE INDEX IF NOT EXISTS idx_girls_name_trgm
  ON girls USING gin(name gin_trgm_ops);

-- 4. 注释
COMMENT ON FUNCTION get_review_stats() IS '获取评论统计（待审核/今日新增/已通过/已驳回），合并4次查询为1次';
COMMENT ON VIEW v_review_monitoring IS '评论监控视图，预关联订单、用户、技师信息，支持按工号/名称搜索';
