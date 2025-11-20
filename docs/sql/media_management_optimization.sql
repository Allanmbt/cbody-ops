-- ========================================
-- 媒体管理性能优化
-- ========================================
-- 目的：从 3 次查询减少到 1 次
-- 性能提升：3 倍
-- ========================================

-- 1. 创建媒体管理统计 RPC 函数
CREATE OR REPLACE FUNCTION get_admin_media_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  pending_count INT;
  approved_count INT;
  rejected_count INT;
  total_count INT;
BEGIN
  -- 一次性获取所有统计
  SELECT 
    COUNT(*) FILTER (WHERE status = 'pending') AS pending,
    COUNT(*) FILTER (WHERE status = 'approved') AS approved,
    COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
    COUNT(*) AS total
  INTO pending_count, approved_count, rejected_count, total_count
  FROM girls_media;
  
  result := json_build_object(
    'pending_count', COALESCE(pending_count, 0),
    'approved_count', COALESCE(approved_count, 0),
    'rejected_count', COALESCE(rejected_count, 0),
    'total_count', COALESCE(total_count, 0)
  );
  
  RETURN result;
END;
$$;

-- 2. 创建媒体管理列表视图（预关联技师和审核人信息）
CREATE OR REPLACE VIEW v_admin_media_list AS
SELECT 
  m.id,
  m.girl_id,
  m.kind,
  m.status,
  m.storage_key,
  m.thumb_key,
  m.provider,
  m.meta,
  m.min_user_level,
  m.sort_order,
  m.reviewed_by,
  m.reviewed_at,
  m.reject_reason,
  m.created_by,
  m.created_at,
  m.updated_at,
  
  -- 技师信息
  g.girl_number,
  g.username AS girl_username,
  g.name AS girl_name,
  
  -- 审核人信息
  reviewer.display_name AS reviewer_name
  
FROM girls_media m
LEFT JOIN girls g ON m.girl_id = g.id
LEFT JOIN user_profiles reviewer ON m.reviewed_by = reviewer.id;

-- 3. 创建索引加速查询
CREATE INDEX IF NOT EXISTS idx_girls_media_status_created 
  ON girls_media(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_girls_media_girl_status 
  ON girls_media(girl_id, status);

CREATE INDEX IF NOT EXISTS idx_girls_media_kind_status 
  ON girls_media(kind, status);

CREATE INDEX IF NOT EXISTS idx_girls_media_reviewed_at 
  ON girls_media(reviewed_at DESC) WHERE reviewed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_girls_media_sort_order 
  ON girls_media(sort_order);

-- 4. 注释
COMMENT ON FUNCTION get_admin_media_stats() IS '获取媒体管理统计（待审核/已发布/已驳回/总计），合并3次查询为1次';
COMMENT ON VIEW v_admin_media_list IS '媒体管理列表视图，预关联技师和审核人信息';
