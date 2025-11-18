-- =============================================
-- 技师自动消息发送函数
-- =============================================
-- 功能：以技师身份自动发送聊天消息给顾客
-- 用于：订单确认、出发通知、到达通知等自动化场景
-- 特性：幂等、防重复、自动创建线程
-- =============================================

CREATE OR REPLACE FUNCTION public.send_girl_auto_message(
    p_customer_id UUID,
    p_girl_id UUID,
    p_order_id UUID,
    p_message_type TEXT,
    p_text TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_thread_id UUID;
    v_message_id UUID;
    v_existing_message_id UUID;
    v_client_msg_id UUID;
    v_girl_user_id UUID;
BEGIN
    -- 1. 检查是否已发送过该类型消息（幂等性）
    SELECT cm.id INTO v_existing_message_id
    FROM public.chat_threads ct
    INNER JOIN public.chat_messages cm ON cm.thread_id = ct.id
    WHERE ct.thread_type = 'c2g'
      AND ct.customer_id = p_customer_id
      AND ct.girl_id = p_girl_id
      AND cm.order_id = p_order_id
      AND cm.sender_role = 'girl'
      AND cm.attachment_meta->>'auto_type' = p_message_type
    LIMIT 1;

    IF v_existing_message_id IS NOT NULL THEN
        -- 已发送过，直接返回
        SELECT thread_id INTO v_thread_id
        FROM public.chat_messages
        WHERE id = v_existing_message_id;

        RETURN jsonb_build_object(
            'ok', true,
            'message_id', v_existing_message_id,
            'thread_id', v_thread_id,
            'already_sent', true
        );
    END IF;

    -- 2. 获取技师的 user_id
    SELECT user_id INTO v_girl_user_id
    FROM public.girls
    WHERE id = p_girl_id;

    IF v_girl_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'GIRL_USER_NOT_FOUND'
        );
    END IF;

    -- 3. 查找或创建 c2g 线程
    SELECT id INTO v_thread_id
    FROM public.chat_threads
    WHERE thread_type = 'c2g'
      AND customer_id = p_customer_id
      AND girl_id = p_girl_id;

    IF v_thread_id IS NULL THEN
        -- 创建新线程
        INSERT INTO public.chat_threads (
            thread_type,
            customer_id,
            girl_id,
            last_message_at,
            last_message_text
        ) VALUES (
            'c2g',
            p_customer_id,
            p_girl_id,
            NOW(),
            p_text
        )
        RETURNING id INTO v_thread_id;
    END IF;

    -- 4. 生成客户端消息 ID（用于去重）
    v_client_msg_id := gen_random_uuid();

    -- 5. 插入聊天消息（以技师身份）
    INSERT INTO public.chat_messages (
        thread_id,
        sender_id,
        sender_role,
        content_type,
        text_content,
        client_msg_id,
        order_id,
        attachment_meta,
        created_at
    ) VALUES (
        v_thread_id,
        v_girl_user_id,
        'girl',
        'text',
        p_text,
        v_client_msg_id,
        p_order_id,
        jsonb_build_object('auto_type', p_message_type, 'auto', true),
        NOW()
    )
    RETURNING id INTO v_message_id;

    -- 6. 更新线程最后消息信息
    UPDATE public.chat_threads
    SET 
        last_message_at = NOW(),
        last_message_text = p_text,
        updated_at = NOW()
    WHERE id = v_thread_id;

    -- 7. 返回成功
    RETURN jsonb_build_object(
        'ok', true,
        'message_id', v_message_id,
        'thread_id', v_thread_id,
        'already_sent', false
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', SQLERRM
        );
END;
$$;

-- 授权给已认证用户（实际只在 RPC 内部调用）
GRANT EXECUTE ON FUNCTION public.send_girl_auto_message(UUID, UUID, UUID, TEXT, TEXT) TO authenticated;

-- 添加注释
COMMENT ON FUNCTION public.send_girl_auto_message IS '以技师身份自动发送聊天消息给顾客（用于订单确认等自动通知）';

-- 使用示例：
-- SELECT public.send_girl_auto_message(
--     'customer-uuid',
--     'girl-uuid',
--     'order-uuid',
--     'confirm_order',
--     'Hi! I''ve confirmed your booking. I''ll contact you shortly to coordinate the details.'
-- );

