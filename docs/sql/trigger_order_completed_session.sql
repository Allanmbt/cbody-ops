-- ============================================
-- 订单完成触发器：记录订单会话到统计表
-- ============================================
-- 当订单状态变为 'completed' 时，自动插入订单会话记录

CREATE OR REPLACE FUNCTION public.record_order_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_started_at TIMESTAMPTZ;
    v_ended_at TIMESTAMPTZ;
    v_duration_seconds BIGINT;
BEGIN
    -- 仅在状态从非completed变为completed时触发
    IF (TG_OP = 'UPDATE' AND OLD.status != 'completed' AND NEW.status = 'completed') THEN
        
        -- 确定会话开始时间（服务开始时间或确认时间）
        v_started_at := COALESCE(NEW.service_started_at, NEW.confirmed_at, NEW.created_at);
        
        -- 会话结束时间为当前时间
        v_ended_at := NOW();
        
        -- 计算时长
        v_duration_seconds := EXTRACT(EPOCH FROM (v_ended_at - v_started_at))::BIGINT;
        
        -- 插入订单会话记录（仅当时长>0时）
        IF v_duration_seconds > 0 THEN
            INSERT INTO public.girl_work_sessions (
                girl_id,
                session_type,
                started_at,
                ended_at,
                duration_seconds,
                amount,
                order_id
            ) VALUES (
                NEW.girl_id,
                'order',
                v_started_at,
                v_ended_at,
                v_duration_seconds,
                NEW.total_amount,
                NEW.id
            )
            ON CONFLICT DO NOTHING;  -- 防止重复插入
        END IF;
        
    END IF;
    
    RETURN NEW;
END;
$$;

-- 删除旧触发器（如果存在）
DROP TRIGGER IF EXISTS trigger_order_completed_session ON public.orders;

-- 创建触发器
CREATE TRIGGER trigger_order_completed_session
    AFTER UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.record_order_session();

-- 注释
COMMENT ON FUNCTION public.record_order_session() IS '订单完成时自动记录订单会话到统计表';
COMMENT ON TRIGGER trigger_order_completed_session ON public.orders IS '订单状态变为completed时触发，记录订单会话';

