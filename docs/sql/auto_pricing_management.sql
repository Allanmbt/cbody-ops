-- ========================================
-- 自动定价与时长管理 - 批量定时任务
-- ========================================
-- 目的：
-- 1. 每 2 小时批量自动开启 90/120 分钟时长（如果已存在）
-- 2. 每 2 小时批量自动调整 90/120 分钟价格封顶（只封顶，不抬价）
-- 3. 只处理已认证且未封号的技师
-- 4. 不打扰技师，不影响正常使用
-- ========================================

-- ========================================
-- 定时任务 1：批量自动开启时长（每 2 小时执行）
-- ========================================

CREATE OR REPLACE FUNCTION cron_auto_enable_durations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 先自动创建缺失的 90/120 分钟时长记录（确保记录存在）
  PERFORM auto_create_missing_durations();

  -- 开启 90 分钟时长（只要服务中存在 90 分钟，就自动开启）
  UPDATE girl_service_durations
  SET is_active = true, updated_at = NOW()
  WHERE id IN (
    SELECT gsd_90.id
    FROM girl_service_durations gsd_90
    INNER JOIN service_durations sd_90 ON sd_90.id = gsd_90.service_duration_id
    INNER JOIN admin_girl_services ags ON ags.id = gsd_90.admin_girl_service_id
    INNER JOIN girls g ON g.id = ags.girl_id
    WHERE sd_90.duration_minutes = 90
      AND gsd_90.is_active = false
      AND g.is_verified = true
      AND g.is_blocked = false
  );

  -- 开启 120 分钟时长（只要服务中存在 120 分钟，就自动开启）
  UPDATE girl_service_durations
  SET is_active = true, updated_at = NOW()
  WHERE id IN (
    SELECT gsd_120.id
    FROM girl_service_durations gsd_120
    INNER JOIN service_durations sd_120 ON sd_120.id = gsd_120.service_duration_id
    INNER JOIN admin_girl_services ags ON ags.id = gsd_120.admin_girl_service_id
    INNER JOIN girls g ON g.id = ags.girl_id
    WHERE sd_120.duration_minutes = 120
      AND gsd_120.is_active = false
      AND g.is_verified = true
      AND g.is_blocked = false
  );
END;
$$;

COMMENT ON FUNCTION cron_auto_enable_durations() IS '定时任务：批量自动开启已认证且未封号技师的 90/120 分钟时长';

-- ========================================
-- 定时任务 2：批量自动调价（每 2 小时执行）
-- ========================================

CREATE OR REPLACE FUNCTION cron_auto_adjust_pricing()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 情况 A1: 90 ≤ 60×1.35
  UPDATE girl_service_durations
  SET custom_price = subq.new_price, updated_at = NOW()
  FROM (
    SELECT
      gsd_90.id,
      ROUND(COALESCE(gsd_60.custom_price, sd_60.default_price) * 1.35 / 100.0) * 100 AS new_price
    FROM girl_service_durations gsd_90
    INNER JOIN service_durations sd_90 ON sd_90.id = gsd_90.service_duration_id
    INNER JOIN admin_girl_services ags ON ags.id = gsd_90.admin_girl_service_id
    INNER JOIN girls g ON g.id = ags.girl_id
    INNER JOIN girl_service_durations gsd_60 ON gsd_60.admin_girl_service_id = ags.id
    INNER JOIN service_durations sd_60 ON sd_60.id = gsd_60.service_duration_id
    WHERE sd_90.duration_minutes = 90
      AND sd_60.duration_minutes = 60
      AND g.is_verified = true
      AND g.is_blocked = false
      AND COALESCE(gsd_90.custom_price, sd_90.default_price) > ROUND(COALESCE(gsd_60.custom_price, sd_60.default_price) * 1.35 / 100.0) * 100
  ) subq
  WHERE girl_service_durations.id = subq.id;

  -- 情况 A2: 120 ≤ 60×1.80
  UPDATE girl_service_durations
  SET custom_price = subq.new_price, updated_at = NOW()
  FROM (
    SELECT
      gsd_120.id,
      ROUND(COALESCE(gsd_60.custom_price, sd_60.default_price) * 1.80 / 100.0) * 100 AS new_price
    FROM girl_service_durations gsd_120
    INNER JOIN service_durations sd_120 ON sd_120.id = gsd_120.service_duration_id
    INNER JOIN admin_girl_services ags ON ags.id = gsd_120.admin_girl_service_id
    INNER JOIN girls g ON g.id = ags.girl_id
    INNER JOIN girl_service_durations gsd_60 ON gsd_60.admin_girl_service_id = ags.id
    INNER JOIN service_durations sd_60 ON sd_60.id = gsd_60.service_duration_id
    WHERE sd_120.duration_minutes = 120
      AND sd_60.duration_minutes = 60
      AND g.is_verified = true
      AND g.is_blocked = false
      AND COALESCE(gsd_120.custom_price, sd_120.default_price) > ROUND(COALESCE(gsd_60.custom_price, sd_60.default_price) * 1.80 / 100.0) * 100
  ) subq
  WHERE girl_service_durations.id = subq.id;

  -- 情况 B: 120 ≤ 90×1.35 (无60时)
  UPDATE girl_service_durations
  SET custom_price = subq.new_price, updated_at = NOW()
  FROM (
    SELECT
      gsd_120.id,
      ROUND(COALESCE(gsd_90.custom_price, sd_90.default_price) * 1.35 / 100.0) * 100 AS new_price
    FROM girl_service_durations gsd_120
    INNER JOIN service_durations sd_120 ON sd_120.id = gsd_120.service_duration_id
    INNER JOIN admin_girl_services ags ON ags.id = gsd_120.admin_girl_service_id
    INNER JOIN girls g ON g.id = ags.girl_id
    INNER JOIN girl_service_durations gsd_90 ON gsd_90.admin_girl_service_id = ags.id
    INNER JOIN service_durations sd_90 ON sd_90.id = gsd_90.service_duration_id
    WHERE sd_120.duration_minutes = 120
      AND sd_90.duration_minutes = 90
      AND g.is_verified = true
      AND g.is_blocked = false
      AND NOT EXISTS (
        SELECT 1 FROM girl_service_durations gsd2
        INNER JOIN service_durations sd2 ON sd2.id = gsd2.service_duration_id
        WHERE gsd2.admin_girl_service_id = ags.id AND sd2.duration_minutes = 60
      )
      AND COALESCE(gsd_120.custom_price, sd_120.default_price) > ROUND(COALESCE(gsd_90.custom_price, sd_90.default_price) * 1.35 / 100.0) * 100
  ) subq
  WHERE girl_service_durations.id = subq.id;
END;
$$;

COMMENT ON FUNCTION cron_auto_adjust_pricing() IS '定时任务：批量自动调整已认证且未封号技师的 90/120 分钟价格封顶';

-- ========================================
-- 创建 pg_cron 定时任务（需要 pg_cron 扩展）
-- ========================================
-- 注意：需要先启用 pg_cron 扩展
-- 在 Supabase Dashboard 的 SQL Editor 中执行：
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- ========================================

-- 删除旧的定时任务（如果存在）
SELECT cron.unschedule('auto_enable_durations_task')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'auto_enable_durations_task'
);

SELECT cron.unschedule('auto_adjust_pricing_task')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'auto_adjust_pricing_task'
);

-- 创建定时任务 1：每 2 小时自动开启时长
SELECT cron.schedule(
  'auto_enable_durations_task',
  '0 */2 * * *',  -- 每 2 小时的整点执行（如：00:00, 02:00, 04:00...）
  $$SELECT cron_auto_enable_durations();$$
);

-- 创建定时任务 2：每 2 小时自动调价
SELECT cron.schedule(
  'auto_adjust_pricing_task',
  '10 */2 * * *',  -- 每 2 小时的 10 分执行（如：00:10, 02:10, 04:10...）
  $$SELECT cron_auto_adjust_pricing();$$
);

-- ========================================
-- 使用说明
-- ========================================
-- 1. 定时任务 1 - 批量自动开启时长（每 2 小时执行）：
--    - 函数：cron_auto_enable_durations()
--    - 执行时间：每 2 小时的整点（00:00, 02:00, 04:00...）
--    - 批量开启所有已认证且未封号技师的 90/120 分钟时长
--    - 规则：如果服务中存在 90 或 120 分钟，确保它们都是开启状态
--
-- 2. 定时任务 2 - 批量自动调价（每 2 小时执行）：
--    - 函数：cron_auto_adjust_pricing()
--    - 执行时间：每 2 小时的 10 分（00:10, 02:10, 04:10...）
--    - 批量调整所有已认证且未封号技师的 90/120 分钟价格
--    - 规则：
--      * 存在 60 分钟 → 90 ≤ 60×1.35, 120 ≤ 60×1.80
--      * 不存在 60 但存在 90 → 120 ≤ 90×1.35
--      * 既无 60 也无 90 → 不处理
--      * 只在超过上限时才自动下调
--      * 所有价格四舍五入到 100 THB 的整数倍
--
-- 3. 执行频率：
--    - 定时任务 1：每 2 小时整点（cron）
--    - 定时任务 2：每 2 小时 10 分（cron）
--    - 两个任务错开 10 分钟执行，避免冲突
--
-- 4. 不影响技师操作：
--    - 后台自动执行，不弹窗、不提示、不打断
--    - 技师端可能感知到价格或状态被自动调整，但不影响正常使用
--
-- 5. 可追溯：
--    - 所有调整都会更新 updated_at 时间戳
--    - 管理员可通过查询 girl_service_durations 表的历史记录追溯变更
--
-- 6. 启用定时任务：
--    - 需要先在 Supabase 启用 pg_cron 扩展：CREATE EXTENSION IF NOT EXISTS pg_cron;
--    - 需要先执行 auto_create_missing_durations.sql 创建辅助函数
--    - 执行本 SQL 文件即可自动创建两个定时任务
--    - 可随时手动执行：
--      SELECT * FROM auto_create_missing_durations();  -- 手动创建缺失记录
--      SELECT cron_auto_enable_durations();  -- 手动开启时长（会自动调用创建函数）
--      SELECT cron_auto_adjust_pricing();    -- 手动调价
--
-- 7. 监控定时任务：
--    - 查看所有定时任务：SELECT * FROM cron.job;
--    - 查看执行历史：
--      SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'auto_enable_durations_task') ORDER BY start_time DESC LIMIT 10;
--      SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'auto_adjust_pricing_task') ORDER BY start_time DESC LIMIT 10;
-- ========================================
