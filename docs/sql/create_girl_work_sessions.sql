-- ============================================
-- 技师工作会话统计表
-- ============================================
-- 用途：记录技师的所有工作会话，支持滚动时间窗口统计
-- 包括：在线时长、订单收入、业绩统计等

-- 创建会话类型枚举
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_type') THEN
        CREATE TYPE session_type AS ENUM ('online', 'order');
    END IF;
END $$;

-- 创建统计表
CREATE TABLE IF NOT EXISTS public.girl_work_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    girl_id UUID NOT NULL REFERENCES public.girls(id) ON DELETE CASCADE,
    session_type session_type NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ NOT NULL,
    duration_seconds BIGINT NOT NULL CHECK (duration_seconds >= 0),
    amount DECIMAL(10,2) DEFAULT NULL CHECK (amount IS NULL OR amount >= 0),
    order_id UUID DEFAULT NULL REFERENCES public.orders(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- 约束：ended_at 必须大于 started_at
    CONSTRAINT chk_session_time_order CHECK (ended_at > started_at),
    
    -- 约束：在线会话不应有订单和金额
    CONSTRAINT chk_online_session CHECK (
        session_type != 'online' OR (order_id IS NULL AND amount IS NULL)
    ),
    
    -- 约束：订单会话必须有订单ID
    CONSTRAINT chk_order_session CHECK (
        session_type != 'order' OR order_id IS NOT NULL
    )
);

-- 索引：按技师+结束时间查询（最常用）
CREATE INDEX IF NOT EXISTS idx_sessions_girl_ended 
ON public.girl_work_sessions(girl_id, ended_at DESC);

-- 索引：按技师+会话类型+结束时间查询
CREATE INDEX IF NOT EXISTS idx_sessions_girl_type_ended 
ON public.girl_work_sessions(girl_id, session_type, ended_at DESC);

-- 索引：按订单ID查询（用于验证和关联）
CREATE INDEX IF NOT EXISTS idx_sessions_order 
ON public.girl_work_sessions(order_id) WHERE order_id IS NOT NULL;

-- 索引：按创建时间查询（用于数据清理和归档）
CREATE INDEX IF NOT EXISTS idx_sessions_created 
ON public.girl_work_sessions(created_at DESC);

-- 注释
COMMENT ON TABLE public.girl_work_sessions IS '技师工作会话记录表，支持在线时长和业绩统计的滚动时间窗口查询';
COMMENT ON COLUMN public.girl_work_sessions.session_type IS '会话类型：online=在线会话, order=订单会话';
COMMENT ON COLUMN public.girl_work_sessions.started_at IS '会话开始时间';
COMMENT ON COLUMN public.girl_work_sessions.ended_at IS '会话结束时间';
COMMENT ON COLUMN public.girl_work_sessions.duration_seconds IS '会话时长（秒）';
COMMENT ON COLUMN public.girl_work_sessions.amount IS '订单金额（仅订单会话有值）';
COMMENT ON COLUMN public.girl_work_sessions.order_id IS '关联订单ID（仅订单会话有值）';

-- ============================================
-- 查询辅助函数
-- ============================================

-- 1. 获取技师最近N天的在线时长（秒）
CREATE OR REPLACE FUNCTION public.get_girl_online_hours_last_n_days(
    p_girl_id UUID,
    p_days INTEGER DEFAULT 7
)
RETURNS BIGINT
LANGUAGE SQL
STABLE
AS $$
    SELECT COALESCE(SUM(duration_seconds), 0)
    FROM public.girl_work_sessions
    WHERE girl_id = p_girl_id
      AND session_type = 'online'
      AND ended_at >= (NOW() - (p_days || ' days')::INTERVAL);
$$;

-- 2. 获取技师最近N个月的每月收入统计
CREATE OR REPLACE FUNCTION public.get_girl_monthly_revenue(
    p_girl_id UUID,
    p_months INTEGER DEFAULT 6
)
RETURNS TABLE (
    month_start DATE,
    total_revenue DECIMAL(10,2),
    order_count BIGINT
)
LANGUAGE SQL
STABLE
AS $$
    SELECT 
        date_trunc('month', ended_at)::DATE AS month_start,
        COALESCE(SUM(amount), 0) AS total_revenue,
        COUNT(*) AS order_count
    FROM public.girl_work_sessions
    WHERE girl_id = p_girl_id
      AND session_type = 'order'
      AND ended_at >= (NOW() - (p_months || ' months')::INTERVAL)
    GROUP BY date_trunc('month', ended_at)
    ORDER BY month_start ASC;
$$;

-- 3. 获取技师最近N天的每日收入统计
CREATE OR REPLACE FUNCTION public.get_girl_daily_revenue(
    p_girl_id UUID,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    day_date DATE,
    total_revenue DECIMAL(10,2),
    order_count BIGINT,
    online_seconds BIGINT
)
LANGUAGE SQL
STABLE
AS $$
    WITH daily_orders AS (
        SELECT 
            ended_at::DATE AS day_date,
            SUM(amount) AS revenue,
            COUNT(*) AS orders
        FROM public.girl_work_sessions
        WHERE girl_id = p_girl_id
          AND session_type = 'order'
          AND ended_at >= (NOW() - (p_days || ' days')::INTERVAL)
        GROUP BY ended_at::DATE
    ),
    daily_online AS (
        SELECT 
            ended_at::DATE AS day_date,
            SUM(duration_seconds) AS online_secs
        FROM public.girl_work_sessions
        WHERE girl_id = p_girl_id
          AND session_type = 'online'
          AND ended_at >= (NOW() - (p_days || ' days')::INTERVAL)
        GROUP BY ended_at::DATE
    )
    SELECT 
        COALESCE(o.day_date, ol.day_date) AS day_date,
        COALESCE(o.revenue, 0) AS total_revenue,
        COALESCE(o.orders, 0) AS order_count,
        COALESCE(ol.online_secs, 0) AS online_seconds
    FROM daily_orders o
    FULL OUTER JOIN daily_online ol ON o.day_date = ol.day_date
    ORDER BY day_date ASC;
$$;

-- 授权
GRANT SELECT ON public.girl_work_sessions TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_girl_online_hours_last_n_days(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_girl_monthly_revenue(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_girl_daily_revenue(UUID, INTEGER) TO authenticated;

-- ============================================
-- 使用示例
-- ============================================
/*
-- 查询最近7天在线时长
SELECT public.get_girl_online_hours_last_n_days('girl-uuid', 7);

-- 查询最近30天在线时长
SELECT public.get_girl_online_hours_last_n_days('girl-uuid', 30);

-- 查询最近6个月收入
SELECT * FROM public.get_girl_monthly_revenue('girl-uuid', 6);

-- 查询最近30天每日统计
SELECT * FROM public.get_girl_daily_revenue('girl-uuid', 30);
*/

