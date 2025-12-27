-- ========================================
-- 诊断查询：检查为什么自动开启时长不生效
-- ========================================

-- 诊断 1：检查是否存在 90 分钟时长的记录
SELECT
  '90分钟记录总数' as check_type,
  COUNT(*) as total_count
FROM girl_service_durations gsd
INNER JOIN service_durations sd ON sd.id = gsd.service_duration_id
WHERE sd.duration_minutes = 90;

-- 诊断 2：检查是否存在 120 分钟时长的记录
SELECT
  '120分钟记录总数' as check_type,
  COUNT(*) as total_count
FROM girl_service_durations gsd
INNER JOIN service_durations sd ON sd.id = gsd.service_duration_id
WHERE sd.duration_minutes = 120;

-- 诊断 3：详细查看所有 90 分钟记录及其排除原因
SELECT
  g.girl_number,
  g.name,
  sd.duration_minutes,
  gsd.is_active,
  g.is_verified,
  g.is_blocked,
  CASE
    WHEN gsd.is_active = true THEN '已开启（is_active=true）'
    WHEN g.is_verified = false THEN '未认证（is_verified=false）'
    WHEN g.is_blocked = true THEN '已封号（is_blocked=true）'
    ELSE '✓ 应该被开启'
  END as status_reason
FROM girl_service_durations gsd
INNER JOIN service_durations sd ON sd.id = gsd.service_duration_id
INNER JOIN admin_girl_services ags ON ags.id = gsd.admin_girl_service_id
INNER JOIN girls g ON g.id = ags.girl_id
WHERE sd.duration_minutes = 90
ORDER BY g.girl_number
LIMIT 20;

-- 诊断 4：详细查看所有 120 分钟记录及其排除原因
SELECT
  g.girl_number,
  g.name,
  sd.duration_minutes,
  gsd.is_active,
  g.is_verified,
  g.is_blocked,
  CASE
    WHEN gsd.is_active = true THEN '已开启（is_active=true）'
    WHEN g.is_verified = false THEN '未认证（is_verified=false）'
    WHEN g.is_blocked = true THEN '已封号（is_blocked=true）'
    ELSE '✓ 应该被开启'
  END as status_reason
FROM girl_service_durations gsd
INNER JOIN service_durations sd ON sd.id = gsd.service_duration_id
INNER JOIN admin_girl_services ags ON ags.id = gsd.admin_girl_service_id
INNER JOIN girls g ON g.id = ags.girl_id
WHERE sd.duration_minutes = 120
ORDER BY g.girl_number
LIMIT 20;

-- 诊断 5：统计各种排除情况的数量（90分钟）
SELECT
  '90分钟' as duration_type,
  COUNT(*) FILTER (WHERE gsd.is_active = true) as already_active_count,
  COUNT(*) FILTER (WHERE g.is_verified = false) as not_verified_count,
  COUNT(*) FILTER (WHERE g.is_blocked = true) as blocked_count,
  COUNT(*) FILTER (WHERE gsd.is_active = false AND g.is_verified = true AND g.is_blocked = false) as should_enable_count
FROM girl_service_durations gsd
INNER JOIN service_durations sd ON sd.id = gsd.service_duration_id
INNER JOIN admin_girl_services ags ON ags.id = gsd.admin_girl_service_id
INNER JOIN girls g ON g.id = ags.girl_id
WHERE sd.duration_minutes = 90;

-- 诊断 6：统计各种排除情况的数量（120分钟）
SELECT
  '120分钟' as duration_type,
  COUNT(*) FILTER (WHERE gsd.is_active = true) as already_active_count,
  COUNT(*) FILTER (WHERE g.is_verified = false) as not_verified_count,
  COUNT(*) FILTER (WHERE g.is_blocked = true) as blocked_count,
  COUNT(*) FILTER (WHERE gsd.is_active = false AND g.is_verified = true AND g.is_blocked = false) as should_enable_count
FROM girl_service_durations gsd
INNER JOIN service_durations sd ON sd.id = gsd.service_duration_id
INNER JOIN admin_girl_services ags ON ags.id = gsd.admin_girl_service_id
INNER JOIN girls g ON g.id = ags.girl_id
WHERE sd.duration_minutes = 120;

-- 诊断 7：检查是否有技师记录存在
SELECT
  '技师总数' as check_type,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE is_verified = true) as verified_count,
  COUNT(*) FILTER (WHERE is_blocked = false) as not_blocked_count,
  COUNT(*) FILTER (WHERE is_verified = true AND is_blocked = false) as qualified_count
FROM girls;

-- ========================================
-- 使用说明
-- ========================================
-- 1. 依次执行以上 7 个诊断查询
-- 2. 诊断 1-2：检查是否有 90/120 分钟的配置记录
-- 3. 诊断 3-4：查看具体记录及其被排除的原因
-- 4. 诊断 5-6：统计各种排除情况的数量
-- 5. 诊断 7：检查技师基础数据是否正常
--
-- 如果 should_enable_count = 0，说明：
-- - 要么所有记录已经是 is_active = true
-- - 要么所有技师都 is_verified = false 或 is_blocked = true
-- - 要么根本没有 90/120 分钟的配置记录
-- ========================================
