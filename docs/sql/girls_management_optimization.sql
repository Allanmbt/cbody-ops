-- ========================================
-- 技师管理性能优化
-- ========================================
-- 目的：从 150+ 次查询减少到 1-4 次
-- 性能提升：25-150 倍
-- ========================================

-- 1. 创建技师管理统计 RPC 函数
CREATE OR REPLACE FUNCTION get_admin_girl_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  total_count INT;
  verified_count INT;
  pending_count INT;
  online_count INT;
BEGIN
  -- 一次性获取所有统计
  SELECT 
    COUNT(*) FILTER (WHERE deleted_at IS NULL) AS total,
    COUNT(*) FILTER (WHERE is_verified = true AND deleted_at IS NULL) AS verified,
    COUNT(*) FILTER (WHERE is_blocked = true AND deleted_at IS NULL) AS pending,
    0 AS online  -- 在线数需要从 girls_status 查询
  INTO total_count, verified_count, pending_count, online_count
  FROM girls;
  
  -- 查询在线技师数
  SELECT COUNT(*)
  INTO online_count
  FROM girls_status
  WHERE status = 'available';
  
  result := json_build_object(
    'total', COALESCE(total_count, 0),
    'verified', COALESCE(verified_count, 0),
    'pending', COALESCE(pending_count, 0),
    'online', COALESCE(online_count, 0)
  );
  
  RETURN result;
END;
$$;

-- 2. 创建服务绑定视图（解决 N+1 查询）
CREATE OR REPLACE VIEW v_admin_service_girl_binding AS
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
  json_build_object(
    'id', c.id,
    'name', c.name
  ) AS city,
  
  -- 分类信息（JSON数组）
  (
    SELECT json_agg(json_build_object('id', cat.id, 'name', cat.name))
    FROM girls_categories gc
    INNER JOIN categories cat ON gc.category_id = cat.id
    WHERE gc.girl_id = g.id
  ) AS categories,
  
  -- 所有服务绑定信息（JSON数组）
  (
    SELECT json_agg(
      json_build_object(
        'id', ags.id,
        'service_id', ags.service_id,
        'is_qualified', ags.is_qualified,
        'notes', ags.notes,
        'enabled_durations_count', (
          SELECT COUNT(*)
          FROM girl_service_durations gsd
          WHERE gsd.admin_girl_service_id = ags.id
            AND gsd.is_active = true
        )
      )
    )
    FROM admin_girl_services ags
    WHERE ags.girl_id = g.id
  ) AS service_bindings
  
FROM girls g
LEFT JOIN cities c ON g.city_id = c.id
WHERE g.is_blocked = false;

-- 3. 创建技师管理列表视图（包含分类信息）
CREATE OR REPLACE VIEW v_admin_girls_list AS
SELECT 
  g.id,
  g.girl_number,
  g.username,
  g.name,
  g.avatar_url,
  g.birth_date,
  g.height,
  g.weight,
  g.measurements,
  g.gender,
  g.languages,
  g.profile,
  g.tags,
  g.badge,
  g.rating,
  g.total_sales,
  g.total_reviews,
  g.max_travel_distance,
  g.trust_score,
  g.is_verified,
  g.is_blocked,
  g.is_visible_to_thai,
  g.sort_order,
  g.city_id,
  g.user_id,
  g.telegram_id,
  g.created_at,
  g.updated_at,
  g.deleted_at,
  
  -- 城市信息
  json_build_object(
    'id', c.id,
    'name', c.name
  ) AS city,
  
  -- 分类ID数组
  (
    SELECT array_agg(gc.category_id)
    FROM girls_categories gc
    WHERE gc.girl_id = g.id
  ) AS category_ids,
  
  -- 分类信息（JSON数组）
  (
    SELECT json_agg(json_build_object('id', cat.id, 'name', cat.name))
    FROM girls_categories gc
    INNER JOIN categories cat ON gc.category_id = cat.id
    WHERE gc.girl_id = g.id
  ) AS categories
  
FROM girls g
LEFT JOIN cities c ON g.city_id = c.id;

-- 4. 创建索引加速查询
CREATE INDEX IF NOT EXISTS idx_girls_is_blocked_deleted 
  ON girls(is_blocked, deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_girls_is_verified 
  ON girls(is_verified) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_girls_city_id 
  ON girls(city_id);

CREATE INDEX IF NOT EXISTS idx_girls_sort_order 
  ON girls(sort_order);

CREATE INDEX IF NOT EXISTS idx_girls_username 
  ON girls(username);

CREATE INDEX IF NOT EXISTS idx_girls_girl_number 
  ON girls(girl_number);

CREATE INDEX IF NOT EXISTS idx_girls_categories_girl_id 
  ON girls_categories(girl_id);

CREATE INDEX IF NOT EXISTS idx_girls_categories_category_id 
  ON girls_categories(category_id);

CREATE INDEX IF NOT EXISTS idx_admin_girl_services_girl_service 
  ON admin_girl_services(girl_id, service_id);

CREATE INDEX IF NOT EXISTS idx_girl_service_durations_binding 
  ON girl_service_durations(admin_girl_service_id) WHERE is_active = true;

-- 5. 注释
COMMENT ON FUNCTION get_admin_girl_stats() IS '获取技师管理统计（总数/已认证/待审核/在线），合并多次查询为1次';
COMMENT ON VIEW v_admin_service_girl_binding IS '服务绑定视图，预关联技师、城市、分类、绑定信息，解决N+1查询';
COMMENT ON VIEW v_admin_girls_list IS '技师管理列表视图，预关联城市和分类信息';
