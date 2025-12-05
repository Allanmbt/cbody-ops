-- ========================================
-- 视频访问量自动增长：批量更新方案
-- ========================================

-- 1. 创建更新函数
CREATE OR REPLACE FUNCTION auto_increment_video_views()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    -- 批量更新所有符合条件的视频
    UPDATE girls_media
    SET 
        meta = jsonb_set(
            jsonb_set(
                meta,
                '{view_count}',
                to_jsonb((COALESCE((meta->>'view_count')::INTEGER, 0) + floor(random() * 101 + 100)::INTEGER))
            ),
            '{last_view_update}',
            to_jsonb(NOW()::TEXT)
        ),
        updated_at = NOW()
    WHERE 
        kind = 'video'
        AND status = 'approved'
        AND meta ? 'cloudflare'
        AND meta ? 'view_count'
        AND (meta->'cloudflare'->>'ready')::BOOLEAN = true;
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    RAISE NOTICE '[视频访问量] 成功更新 % 条视频', v_updated_count;
    
    RETURN v_updated_count;
END;
$$;

-- 2. 创建定时任务触发器（每天泰国时间早上9点执行）
-- 使用 pg_cron 扩展（需要先启用）
-- Supabase 默认已启用 pg_cron

-- 删除旧任务（如果存在）
SELECT cron.unschedule('auto_increment_video_views_daily');

-- 创建新任务：每天泰国时间 09:00 执行（UTC+7 = 02:00 UTC）
SELECT cron.schedule(
    'auto_increment_video_views_daily',
    '0 2 * * *',  -- 每天 UTC 02:00 = 泰国时间 09:00
    $$SELECT auto_increment_video_views();$$
);

-- 3. 手动测试执行（可选）
-- SELECT auto_increment_video_views();

-- 4. 查看定时任务状态
-- SELECT * FROM cron.job WHERE jobname = 'auto_increment_video_views_daily';

-- 5. 查看执行历史
-- SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'auto_increment_video_views_daily') ORDER BY start_time DESC LIMIT 10;