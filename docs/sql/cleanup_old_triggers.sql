-- ========================================
-- 清理旧的触发器和函数
-- ========================================
-- 目的：删除不小心创建的单记录触发器
-- ========================================

-- 1. 删除触发器
DROP TRIGGER IF EXISTS trigger_auto_enable_duration ON girl_service_durations;
DROP TRIGGER IF EXISTS trigger_auto_adjust_pricing ON girl_service_durations;

-- 2. 删除函数
DROP FUNCTION IF EXISTS auto_enable_duration_for_girl();
DROP FUNCTION IF EXISTS auto_adjust_pricing_for_girl();

-- 完成
SELECT '已删除旧的触发器和函数' AS status;
