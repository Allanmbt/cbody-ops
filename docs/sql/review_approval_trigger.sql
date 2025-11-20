-- ========================================
-- 评论审核触发器：自动更新技师评分和统计
-- ========================================
-- 功能：
-- 1. 状态锁定：approved/rejected 后不可再修改
-- 2. Bayesian 平滑评分重算（仅 approved 时）
-- 3. 更新技师 total_reviews 和 rating
-- ========================================

-- 1. 创建触发器函数：更新技师评分
CREATE OR REPLACE FUNCTION update_girl_rating_on_review_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_approved_count INTEGER;
    v_sum_rating NUMERIC;
    v_bayesian_rating NUMERIC;
    v_m CONSTANT NUMERIC := 4.5;  -- 先验平均分
    v_c CONSTANT NUMERIC := 25;   -- 先验权重
BEGIN
    -- ========================================
    -- 1. 状态锁定检查：已审核的评论不可再修改
    -- ========================================
    IF OLD.status IN ('approved', 'rejected') AND NEW.status != OLD.status THEN
        RAISE EXCEPTION '已审核的评论状态不可修改（当前状态：%）', OLD.status;
    END IF;

    -- ========================================
    -- 2. 仅当状态从 pending → approved 时执行评分重算
    -- ========================================
    IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
        -- 统计该技师已通过的评论数量和总分（包含当前这条）
        -- 注意：此时 NEW 记录状态已是 approved，但数据库中还是 OLD 状态
        -- 所以需要手动加上当前这条
        SELECT 
            COUNT(*),
            COALESCE(SUM(rating_overall), 0)
        INTO 
            v_approved_count,
            v_sum_rating
        FROM order_reviews
        WHERE girl_id = NEW.girl_id
          AND status = 'approved'
          AND id != NEW.id;  -- 排除当前记录（因为还未提交）

        -- 加上当前这条评论
        v_approved_count := v_approved_count + 1;
        v_sum_rating := v_sum_rating + NEW.rating_overall;

        -- Bayesian 平滑评分公式：
        -- final_rating = (C * m + sum(rating_overall)) / (C + n)
        -- 其中：
        --   m = 4.5 (先验平均分)
        --   C = 25 (先验权重)
        --   n = approved_count (已通过评论数)
        v_bayesian_rating := (v_c * v_m + v_sum_rating) / (v_c + v_approved_count);

        -- 更新技师表：评分 + 评论数
        UPDATE girls
        SET 
            rating = ROUND(v_bayesian_rating::NUMERIC, 2),
            total_reviews = v_approved_count,
            updated_at = NOW()
        WHERE id = NEW.girl_id;

        RAISE NOTICE '[评论审核] 技师 % 评分已更新：%.2f（共 % 条评论）', 
            NEW.girl_id, v_bayesian_rating, v_approved_count;
    END IF;

    -- ========================================
    -- 3. 当评论从 approved → rejected 时，重新计算评分（理论上不会发生，但保持逻辑完整）
    -- ========================================
    IF OLD.status = 'approved' AND NEW.status = 'rejected' THEN
        -- 重新统计（排除当前这条，因为它即将变为 rejected）
        SELECT 
            COUNT(*),
            COALESCE(SUM(rating_overall), 0)
        INTO 
            v_approved_count,
            v_sum_rating
        FROM order_reviews
        WHERE girl_id = NEW.girl_id
          AND status = 'approved'
          AND id != NEW.id;

        -- 如果没有任何已通过的评论，回到初始状态
        IF v_approved_count = 0 THEN
            v_bayesian_rating := 0;
        ELSE
            v_bayesian_rating := (v_c * v_m + v_sum_rating) / (v_c + v_approved_count);
        END IF;

        UPDATE girls
        SET 
            rating = ROUND(v_bayesian_rating::NUMERIC, 2),
            total_reviews = v_approved_count,
            updated_at = NOW()
        WHERE id = NEW.girl_id;

        RAISE NOTICE '[评论审核] 技师 % 评分已回退：%.2f（共 % 条评论）', 
            NEW.girl_id, v_bayesian_rating, v_approved_count;
    END IF;

    RETURN NEW;
END;
$$;

-- 2. 创建触发器（BEFORE UPDATE，确保状态锁定优先检查）
DROP TRIGGER IF EXISTS trg_review_approval ON order_reviews;

CREATE TRIGGER trg_review_approval
    BEFORE UPDATE ON order_reviews
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION update_girl_rating_on_review_approval();

-- ========================================
-- 3. 辅助函数：手动重算技师评分（用于修复数据）
-- ========================================
CREATE OR REPLACE FUNCTION recalculate_girl_rating(p_girl_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_approved_count INTEGER;
    v_sum_rating NUMERIC;
    v_bayesian_rating NUMERIC;
    v_m CONSTANT NUMERIC := 4.5;
    v_c CONSTANT NUMERIC := 25;
BEGIN
    -- 统计该技师已通过的评论
    SELECT 
        COUNT(*),
        COALESCE(SUM(rating_overall), 0)
    INTO 
        v_approved_count,
        v_sum_rating
    FROM order_reviews
    WHERE girl_id = p_girl_id
      AND status = 'approved';

    -- 计算 Bayesian 评分（处理0评论的情况）
    IF v_approved_count = 0 THEN
        v_bayesian_rating := 0;
    ELSE
        v_bayesian_rating := (v_c * v_m + v_sum_rating) / (v_c + v_approved_count);
    END IF;

    -- 更新技师表
    UPDATE girls
    SET 
        rating = ROUND(v_bayesian_rating::NUMERIC, 2),
        total_reviews = v_approved_count,
        updated_at = NOW()
    WHERE id = p_girl_id;

    RAISE NOTICE '[手动修复] 技师 % 评分已重算：%.2f（共 % 条评论）', 
        p_girl_id, v_bayesian_rating, v_approved_count;
END;
$$;

-- ========================================
-- 4. 授权（管理员可执行手动修复函数）
-- ========================================
GRANT EXECUTE ON FUNCTION recalculate_girl_rating(UUID) TO authenticated;

-- ========================================
-- 使用示例
-- ========================================
-- 1. 正常审核流程（自动触发）：
--    UPDATE order_reviews SET status = 'approved', reviewed_by = '...', reviewed_at = NOW() WHERE id = '...';
--
-- 2. 手动修复单个技师评分：
--    SELECT recalculate_girl_rating('girl_uuid_here');
--
-- 3. 批量修复所有技师评分：
--    SELECT recalculate_girl_rating(id) FROM girls WHERE id IN (SELECT DISTINCT girl_id FROM order_reviews WHERE status = 'approved');
-- ========================================
