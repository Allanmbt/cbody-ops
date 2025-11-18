-- =============================================
-- 订单状态更新 RPC 函数（V2 - 增强版）
-- =============================================
-- 新增功能：
-- 1. 订单确认时（pending → confirmed）自动发送技师消息给顾客
-- 2. 保持原有的鉴权和并发控制逻辑
-- 3. 触发器自动维护 active_orders_count 和 next_available_time
--
-- 重要说明：
-- - 本函数不再直接维护 girls_status 的 next_available_time 和 active_orders_count
-- - 这些字段由 order_status_trigger.sql 中的触发器统一重算维护
-- - 触发器采用串行排队逻辑，确保队列时间计算的准确性和一致性
-- - 技师手动下线后，触发器不会覆盖 offline 状态，但会继续维护队列信息
--
-- Bug 修复（2025-10-27）：
-- - 修复了 next_available_time 使用历史时间而非实时时间的问题
-- - 当订单从 pending → confirmed 时，设置 estimated_arrival_at = NOW() + eta_minutes
-- - 这确保了触发器使用技师确认订单时的实时时间来计算排队时间
-- - 之前的逻辑使用 created_at，导致如果订单创建很久后才确认，会基于过去的时间计算
--
-- Bug 修复（2025-11-07）：
-- - 在estimated_arrival_at计算中增加10分钟缓冲时间
-- - ETA基于Google路线API的最短时间，额外增加10分钟确保技师准时到达
-- - 修改：estimated_arrival_at = NOW() + (eta_minutes + 10)
-- =============================================

CREATE OR REPLACE FUNCTION public.update_order_status(
    p_order_id UUID,
    p_new_status TEXT,
    p_eta_minutes INTEGER DEFAULT NULL,
    p_extra_fee DECIMAL(10,2) DEFAULT NULL,
    p_discount_amount DECIMAL(10,2) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_girl_id UUID;
    v_customer_id UUID;
    v_current_status TEXT;
    v_order_girl_id UUID;
    v_order_service_id INTEGER;
    v_is_admin BOOLEAN;
    v_updated_rows INTEGER;
    v_auto_msg_result JSONB;
    v_eta_text TEXT;
    v_new_total_amount DECIMAL(10,2);
    v_order_eta_minutes INTEGER;
BEGIN
    -- 1. 检查认证
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'UNAUTHORIZED'
        );
    END IF;

    -- 2. 检查是否为管理员
    v_is_admin := public.is_admin();

    -- 3. 获取当前用户的技师ID（如果是技师）
    IF NOT v_is_admin THEN
        SELECT id INTO v_girl_id 
        FROM public.girls 
        WHERE user_id = auth.uid() 
        LIMIT 1;

        IF v_girl_id IS NULL THEN
            RETURN jsonb_build_object(
                'ok', false,
                'error', 'UNAUTHORIZED'
            );
        END IF;
    END IF;

    -- 4. 获取订单信息（FOR UPDATE 确保事务锁）
    SELECT status, girl_id, user_id, service_id
    INTO v_current_status, v_order_girl_id, v_customer_id, v_order_service_id
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    -- 5. 检查订单是否存在
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'ORDER_NOT_FOUND'
        );
    END IF;

    -- 6. 鉴权：检查订单是否属于该技师（管理员可跳过）
    IF NOT v_is_admin AND v_order_girl_id != v_girl_id THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'UNAUTHORIZED'
        );
    END IF;

    -- 7. 检查订单是否已终结
    IF v_current_status IN ('completed', 'cancelled') THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'ALREADY_TERMINATED'
        );
    END IF;

    -- 8. 幂等性检查：如果当前状态等于目标状态，直接返回成功
    IF v_current_status = p_new_status THEN
        RETURN jsonb_build_object(
            'ok', true,
            'order_id', p_order_id,
            'from_status', v_current_status,
            'to_status', p_new_status
        );
    END IF;

    -- 9. 验证状态流转合法性
    IF NOT (
        (v_current_status = 'pending' AND p_new_status = 'confirmed') OR
        (v_current_status = 'confirmed' AND p_new_status = 'en_route') OR
        (v_current_status = 'en_route' AND p_new_status = 'arrived') OR
        (v_current_status = 'arrived' AND p_new_status = 'in_service') OR
        (v_current_status = 'in_service' AND p_new_status = 'completed') OR
        (p_new_status = 'cancelled' AND v_current_status NOT IN ('completed', 'cancelled'))
    ) THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'ILLEGAL_TRANSITION'
        );
    END IF;

    -- 10. 条件更新（并发安全）
    -- 特殊处理：
    -- a. pending → confirmed：设置 estimated_arrival_at 为当前时间 + eta_minutes（使用实时确认时间）
    -- b. arrived → in_service：记录服务实际开始时间 service_started_at
    -- c. confirmed → en_route：更新 eta_minutes 和 estimated_arrival_at
    -- d. in_service → completed：记录完成时间 completed_at，更新 total_amount（可选），增加销量计数
    IF v_current_status = 'pending' AND p_new_status = 'confirmed' THEN
        -- 获取订单的 eta_minutes（如果有的话）
        SELECT eta_minutes INTO v_order_eta_minutes
        FROM public.orders
        WHERE id = p_order_id;

        -- 设置 estimated_arrival_at = NOW() + eta_minutes + 10分钟缓冲（基于实时确认时间）
        IF v_order_eta_minutes IS NOT NULL THEN
            UPDATE public.orders
            SET
                status = p_new_status,
                estimated_arrival_at = NOW() + ((v_order_eta_minutes + 10) || ' minutes')::INTERVAL,
                updated_at = NOW()
            WHERE id = p_order_id
              AND status = v_current_status;
        ELSE
            -- 如果没有 eta_minutes，使用默认值 30 + 10 = 40 分钟
            UPDATE public.orders
            SET
                status = p_new_status,
                estimated_arrival_at = NOW() + INTERVAL '40 minutes',
                updated_at = NOW()
            WHERE id = p_order_id
              AND status = v_current_status;
        END IF;
    ELSIF v_current_status = 'arrived' AND p_new_status = 'in_service' THEN
        UPDATE public.orders
        SET 
            status = p_new_status,
            service_started_at = NOW(),
            updated_at = NOW()
        WHERE id = p_order_id
          AND status = v_current_status;
    ELSIF v_current_status = 'confirmed' AND p_new_status = 'en_route' AND p_eta_minutes IS NOT NULL THEN
        UPDATE public.orders
        SET 
            status = p_new_status,
            eta_minutes = p_eta_minutes,
            estimated_arrival_at = NOW() + ((p_eta_minutes + 10) || ' minutes')::INTERVAL,
            updated_at = NOW()
        WHERE id = p_order_id
          AND status = v_current_status;
    ELSIF v_current_status = 'in_service' AND p_new_status = 'completed' THEN
        -- 如果提供了 extra_fee 或 discount_amount，重新计算 total_amount
        IF p_extra_fee IS NOT NULL OR p_discount_amount IS NOT NULL THEN
            SELECT 
                service_fee + travel_fee + COALESCE(p_extra_fee, extra_fee) - COALESCE(p_discount_amount, discount_amount)
            INTO v_new_total_amount
            FROM public.orders
            WHERE id = p_order_id;
            
            UPDATE public.orders
            SET 
                status = p_new_status,
                completed_at = NOW(),
                extra_fee = COALESCE(p_extra_fee, extra_fee),
                discount_amount = COALESCE(p_discount_amount, discount_amount),
                total_amount = v_new_total_amount,
                updated_at = NOW()
            WHERE id = p_order_id
              AND status = v_current_status;
        ELSE
            UPDATE public.orders
            SET 
                status = p_new_status,
                completed_at = NOW(),
                updated_at = NOW()
            WHERE id = p_order_id
              AND status = v_current_status;
        END IF;
        
        -- 增加技师销量
        UPDATE public.girls
        SET total_sales = total_sales + 1
        WHERE id = v_order_girl_id;
        
        -- 增加服务销量
        UPDATE public.services
        SET total_sales = total_sales + 1
        WHERE id = v_order_service_id;
    ELSE
        UPDATE public.orders
        SET 
            status = p_new_status,
            updated_at = NOW()
        WHERE id = p_order_id
          AND status = v_current_status;
    END IF;

    GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

    -- 11. 检查更新结果
    IF v_updated_rows = 0 THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'CONFLICT_RETRY'
        );
    END IF;

    -- 12. 【新增】订单状态变更时发送自动消息
    
    -- a. 订单确认时（pending → confirmed）
    IF v_current_status = 'pending' AND p_new_status = 'confirmed' THEN
        BEGIN
            v_auto_msg_result := public.send_girl_auto_message(
                v_customer_id,
                v_order_girl_id,
                p_order_id,
                'confirm_order',
                'Hi! I''ve confirmed your booking.'
            );

            IF NOT (v_auto_msg_result->>'ok')::BOOLEAN THEN
                RAISE WARNING 'Failed to send auto message for order %: %', 
                    p_order_id, v_auto_msg_result->>'error';
            ELSE
                RAISE NOTICE 'Auto message sent for order %: message_id=%', 
                    p_order_id, v_auto_msg_result->>'message_id';
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE WARNING 'Exception in send_girl_auto_message: %', SQLERRM;
        END;
    END IF;

    -- b. 技师出发时（confirmed → en_route）
    IF v_current_status = 'confirmed' AND p_new_status = 'en_route' AND p_eta_minutes IS NOT NULL THEN
        BEGIN
            -- 生成友好的 ETA 消息
            IF p_eta_minutes <= 10 THEN
                v_eta_text := 'I''m on my way! I''ll be there in about ' || p_eta_minutes || ' minutes. See you soon! 😊';
            ELSIF p_eta_minutes <= 30 THEN
                v_eta_text := 'On my way to you! I''ll arrive in approximately ' || p_eta_minutes || ' minutes. 🚗';
            ELSE
                v_eta_text := 'I''ve started my journey to you! Estimated arrival in ' || p_eta_minutes || ' minutes. Thanks for your patience! 🛣️';
            END IF;

            v_auto_msg_result := public.send_girl_auto_message(
                v_customer_id,
                v_order_girl_id,
                p_order_id,
                'en_route',
                v_eta_text
            );

            IF NOT (v_auto_msg_result->>'ok')::BOOLEAN THEN
                RAISE WARNING 'Failed to send en_route message for order %: %', 
                    p_order_id, v_auto_msg_result->>'error';
            ELSE
                RAISE NOTICE 'En_route message sent for order %: message_id=%', 
                    p_order_id, v_auto_msg_result->>'message_id';
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE WARNING 'Exception in send_girl_auto_message (en_route): %', SQLERRM;
        END;
    END IF;

    -- c. 技师到达时（en_route → arrived）
    IF v_current_status = 'en_route' AND p_new_status = 'arrived' THEN
        BEGIN
            v_auto_msg_result := public.send_girl_auto_message(
                v_customer_id,
                v_order_girl_id,
                p_order_id,
                'arrived',
                'Hey! I''ve just arrived.'
            );

            IF NOT (v_auto_msg_result->>'ok')::BOOLEAN THEN
                RAISE WARNING 'Failed to send arrived message for order %: %', 
                    p_order_id, v_auto_msg_result->>'error';
            ELSE
                RAISE NOTICE 'Arrived message sent for order %: message_id=%', 
                    p_order_id, v_auto_msg_result->>'message_id';
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE WARNING 'Exception in send_girl_auto_message (arrived): %', SQLERRM;
        END;
    END IF;

    -- d. 服务完成时（in_service → completed）
    IF v_current_status = 'in_service' AND p_new_status = 'completed' THEN
        BEGIN
            v_auto_msg_result := public.send_girl_auto_message(
                v_customer_id,
                v_order_girl_id,
                p_order_id,
                'completed',
                'Thank you for your time ❤️ Hope you enjoyed the session! Please leave a short review if you''re satisfied 🙏'
            );

            IF NOT (v_auto_msg_result->>'ok')::BOOLEAN THEN
                RAISE WARNING 'Failed to send completed message for order %: %', 
                    p_order_id, v_auto_msg_result->>'error';
            ELSE
                RAISE NOTICE 'Completed message sent for order %: message_id=%', 
                    p_order_id, v_auto_msg_result->>'message_id';
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE WARNING 'Exception in send_girl_auto_message (completed): %', SQLERRM;
        END;
    END IF;

    -- 13. 返回成功
    -- 注意：
    -- - 触发器（maintain_girl_order_stats）会自动维护以下字段：
    --   * girls_status.active_orders_count
    --   * girls_status.next_available_time
    --   * girls_status.status（但不覆盖手动 offline）
    --   * orders.scheduled_start_at（预计开始服务时间）
    --   * orders.queue_position（排队位置）
    -- - 触发器采用串行重算逻辑，每次订单状态变化时重新计算完整排队链
    -- - 确保技师队列信息的准确性和一致性
    RETURN jsonb_build_object(
        'ok', true,
        'order_id', p_order_id,
        'from_status', v_current_status,
        'to_status', p_new_status
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', SQLERRM
        );
END;
$$;


DROP FUNCTION IF EXISTS public.update_order_status(UUID, TEXT, INTEGER);

-- 授权给已认证用户（匹配完整签名）
GRANT EXECUTE ON FUNCTION public.update_order_status(UUID, TEXT, INTEGER, DECIMAL, DECIMAL) TO authenticated;

-- 添加注释
COMMENT ON FUNCTION public.update_order_status(UUID, TEXT, INTEGER, DECIMAL, DECIMAL) IS '更新订单状态（V2增强版）- 支持自动发送技师消息、销量统计、价格调整。技师队列信息由触发器统一维护（串行重算逻辑）';

-- 使用示例：
-- SELECT public.update_order_status('order-uuid-here', 'confirmed', NULL, NULL, NULL);
-- SELECT public.update_order_status('order-uuid-here', 'en_route', 20, NULL, NULL);
-- SELECT public.update_order_status('order-uuid-here', 'completed', NULL, 50.00, 10.00); -- 额外费用50，优惠10

