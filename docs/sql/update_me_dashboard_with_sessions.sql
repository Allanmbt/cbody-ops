-- ============================================
-- 更新 get_me_dashboard RPC
-- ============================================
-- 使用新的统计表查询滚动时间窗口的在线时长和月度收入

CREATE OR REPLACE FUNCTION public.get_me_dashboard()
RETURNS TABLE (
    trust_score SMALLINT,
    total_sales INTEGER,
    weekly_online_seconds BIGINT,
    monthly_online_seconds BIGINT,
    total_online_seconds BIGINT,
    monthly_revenue JSONB  -- 新增：最近6个月收入统计
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_girl_id UUID;
    v_trust_score SMALLINT;
    v_total_sales INTEGER;
    v_weekly_online_seconds BIGINT;
    v_monthly_online_seconds BIGINT;
    v_total_online_seconds BIGINT;
    v_monthly_revenue JSONB;
BEGIN
    -- 通过 auth.uid() 获取当前用户对应的 girl_id
    SELECT g.id INTO v_girl_id
    FROM girls g
    WHERE g.user_id = auth.uid()
    LIMIT 1;

    -- 如果没有找到对应的技师，返回空结果
    IF v_girl_id IS NULL THEN
        RETURN;
    END IF;

    -- 获取基础数据
    SELECT 
        g.trust_score,
        g.total_sales,
        COALESCE(gs.total_online_seconds, 0)
    INTO 
        v_trust_score,
        v_total_sales,
        v_total_online_seconds
    FROM girls g
    LEFT JOIN girls_status gs ON gs.girl_id = g.id
    WHERE g.id = v_girl_id;

    -- 获取最近7天在线时长（滚动窗口）
    v_weekly_online_seconds := public.get_girl_online_hours_last_n_days(v_girl_id, 7);

    -- 获取最近30天在线时长（滚动窗口）
    v_monthly_online_seconds := public.get_girl_online_hours_last_n_days(v_girl_id, 30);

    -- 获取最近6个月收入统计
    SELECT json_agg(
        json_build_object(
            'month', TO_CHAR(month_start, 'Mon'),
            'value', ROUND(total_revenue / 1000, 1),  -- 转为K单位
            'orders', order_count
        ) ORDER BY month_start ASC
    )
    INTO v_monthly_revenue
    FROM public.get_girl_monthly_revenue(v_girl_id, 6);

    -- 如果没有收入数据，返回空数组
    IF v_monthly_revenue IS NULL THEN
        v_monthly_revenue := '[]'::JSONB;
    END IF;

    -- 返回统计数据
    trust_score := v_trust_score;
    total_sales := v_total_sales;
    weekly_online_seconds := v_weekly_online_seconds;
    monthly_online_seconds := v_monthly_online_seconds;
    total_online_seconds := v_total_online_seconds;
    monthly_revenue := v_monthly_revenue;

    RETURN NEXT;
END;
$$;

-- 权限设置：允许已认证用户调用
GRANT EXECUTE ON FUNCTION public.get_me_dashboard() TO authenticated;

-- 注释
COMMENT ON FUNCTION public.get_me_dashboard() IS '获取技师个人仪表盘数据：基础统计、滚动窗口在线时长、月度收入';

-- 示例调用
-- SELECT * FROM public.get_me_dashboard();

