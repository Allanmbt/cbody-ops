-- ============================================
-- RPC: get_me_dashboard
-- ============================================
-- 描述：获取当前技师的个人仪表盘数据（聚合统计）
-- 权限：SECURITY DEFINER，仅返回当前登录技师的数据
-- 返回：trust_score, total_sales, weekly_online_seconds, monthly_online_seconds, total_online_seconds

CREATE OR REPLACE FUNCTION get_me_dashboard()
RETURNS TABLE (
    trust_score SMALLINT,
    total_sales INTEGER,
    weekly_online_seconds BIGINT,
    monthly_online_seconds BIGINT,
    total_online_seconds BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_girl_id UUID;
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

    -- 返回聚合数据
    RETURN QUERY
    SELECT 
        g.trust_score,
        g.total_sales,
        COALESCE(gs.weekly_online_seconds, 0) AS weekly_online_seconds,
        COALESCE(gs.monthly_online_seconds, 0) AS monthly_online_seconds,
        COALESCE(gs.total_online_seconds, 0) AS total_online_seconds
    FROM girls g
    LEFT JOIN girls_status gs ON gs.girl_id = g.id
    WHERE g.id = v_girl_id;
END;
$$;

-- 权限设置：允许已认证用户调用
GRANT EXECUTE ON FUNCTION get_me_dashboard() TO authenticated;

-- 示例调用
-- SELECT * FROM get_me_dashboard();

