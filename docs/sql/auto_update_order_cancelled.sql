-- =============================================
-- 订单取消触发器：自动更新订单状态为cancelled
-- =============================================
-- 功能：
-- 1. 当向order_cancellations插入记录时，自动更新orders.status为'cancelled'
-- 2. 防止重复取消
-- 3. 记录取消前状态
-- 
-- 注意：
-- - orders表只有status字段，没有cancelled_at和cancelled_by字段
-- - 取消详情（时间、人员、原因）都存在order_cancellations表中
-- - 触发器会自动触发maintain_girl_order_stats更新技师统计
-- =============================================

CREATE OR REPLACE FUNCTION public.auto_update_order_cancelled()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_status TEXT;
BEGIN
    -- 获取订单当前状态
    SELECT status INTO v_current_status
    FROM public.orders
    WHERE id = NEW.order_id;
    
    -- 如果订单不存在，抛出异常
    IF v_current_status IS NULL THEN
        RAISE EXCEPTION 'Order not found: %', NEW.order_id;
    END IF;
    
    -- 如果订单已经是取消状态，不允许重复取消
    IF v_current_status = 'cancelled' THEN
        RAISE EXCEPTION 'Order % is already cancelled', NEW.order_id;
    END IF;
    
    -- 记录取消前状态
    NEW.previous_status := v_current_status;
    
    -- 更新订单状态为 cancelled（只更新status字段）
    UPDATE public.orders
    SET 
        status = 'cancelled',
        updated_at = NOW()
    WHERE id = NEW.order_id;
    
    -- 触发器会自动调用 maintain_girl_order_stats 更新技师统计
    -- 包括：active_orders_count, next_available_time, queue等
    
    RETURN NEW;
END;
$$;

-- 创建触发器
DROP TRIGGER IF EXISTS trg_order_cancellations_update_order ON public.order_cancellations;

CREATE TRIGGER trg_order_cancellations_update_order
    BEFORE INSERT
    ON public.order_cancellations
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_update_order_cancelled();

-- 添加注释
COMMENT ON FUNCTION public.auto_update_order_cancelled IS '订单取消时自动更新orders.status为cancelled，并记录previous_status';
COMMENT ON TRIGGER trg_order_cancellations_update_order ON public.order_cancellations IS '插入取消记录时自动更新订单状态';

-- 测试示例：
-- INSERT INTO public.order_cancellations (order_id, cancelled_by_role, cancelled_by_user_id, reason_code, reason_note)
-- VALUES ('order-uuid-here', 'therapist', 'user-uuid-here', 'CLIENT_CANCEL', 'Customer requested cancellation');

