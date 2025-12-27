-- ========================================
-- 自动创建缺失的时长配置记录
-- ========================================
-- 目的：为所有已绑定服务的技师自动创建缺失的 90/120 分钟时长记录
-- 前提：服务项目中存在 90 或 120 分钟时长
-- ========================================

CREATE OR REPLACE FUNCTION auto_create_missing_durations()
RETURNS TABLE(
  created_count INTEGER,
  details TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created_90 INTEGER := 0;
  v_created_120 INTEGER := 0;
BEGIN
  -- 创建缺失的 90 分钟时长记录
  -- 逻辑：如果技师已绑定某个服务，且该服务有 90 分钟时长，但技师没有对应的 girl_service_durations 记录，则自动创建
  INSERT INTO girl_service_durations (
    admin_girl_service_id,
    service_duration_id,
    custom_price,
    is_active,
    created_at,
    updated_at
  )
  SELECT
    ags.id,
    sd_90.id,
    NULL,  -- 使用默认价格（NULL 表示使用 service_durations.default_price）
    true,  -- 默认开启
    NOW(),
    NOW()
  FROM admin_girl_services ags
  INNER JOIN girls g ON g.id = ags.girl_id
  INNER JOIN service_durations sd_90 ON sd_90.service_id = ags.service_id
  WHERE sd_90.duration_minutes = 90
    AND g.is_verified = true
    AND g.is_blocked = false
    AND NOT EXISTS (
      -- 确保该技师该服务的 90 分钟记录不存在
      SELECT 1
      FROM girl_service_durations gsd
      WHERE gsd.admin_girl_service_id = ags.id
        AND gsd.service_duration_id = sd_90.id
    );

  GET DIAGNOSTICS v_created_90 = ROW_COUNT;

  -- 创建缺失的 120 分钟时长记录
  INSERT INTO girl_service_durations (
    admin_girl_service_id,
    service_duration_id,
    custom_price,
    is_active,
    created_at,
    updated_at
  )
  SELECT
    ags.id,
    sd_120.id,
    NULL,  -- 使用默认价格
    true,  -- 默认开启
    NOW(),
    NOW()
  FROM admin_girl_services ags
  INNER JOIN girls g ON g.id = ags.girl_id
  INNER JOIN service_durations sd_120 ON sd_120.service_id = ags.service_id
  WHERE sd_120.duration_minutes = 120
    AND g.is_verified = true
    AND g.is_blocked = false
    AND NOT EXISTS (
      -- 确保该技师该服务的 120 分钟记录不存在
      SELECT 1
      FROM girl_service_durations gsd
      WHERE gsd.admin_girl_service_id = ags.id
        AND gsd.service_duration_id = sd_120.id
    );

  GET DIAGNOSTICS v_created_120 = ROW_COUNT;

  -- 返回创建结果
  RETURN QUERY
  SELECT
    (v_created_90 + v_created_120)::INTEGER,
    format('已创建 %s 条 90 分钟记录，%s 条 120 分钟记录', v_created_90, v_created_120);
END;
$$;

COMMENT ON FUNCTION auto_create_missing_durations() IS '自动为已绑定服务的技师创建缺失的 90/120 分钟时长记录（仅已认证且未封号）';

-- ========================================
-- 使用说明
-- ========================================
-- 1. 立即执行一次，创建所有缺失的记录：
--    SELECT * FROM auto_create_missing_durations();
--
-- 2. 可以在 cron_auto_enable_durations() 函数开头调用此函数，确保记录存在：
--    PERFORM auto_create_missing_durations();
--
-- 3. 也可以单独设置定时任务，每天执行一次：
--    SELECT cron.schedule(
--      'auto_create_missing_durations_task',
--      '0 3 * * *',  -- 每天凌晨 3 点执行
--      $$SELECT auto_create_missing_durations();$$
--    );
-- ========================================

-- 授权
GRANT EXECUTE ON FUNCTION auto_create_missing_durations() TO authenticated;
