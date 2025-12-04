-- ========================================
-- 系统消息推送 RPC 函数
-- 用于管理后台推送系统消息给技师或客户
-- ========================================

-- 函数1：推送系统消息给单个技师
CREATE OR REPLACE FUNCTION send_system_notification_to_girl(
  p_girl_id UUID,
  p_content TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_thread_id UUID;
  v_message_id UUID;
  v_system_account_id TEXT;
BEGIN
  -- 1. 获取系统账号ID
  SELECT value_text INTO v_system_account_id
  FROM app_configs
  WHERE namespace = 'system'
    AND config_key = 'notification_account_id'
    AND scope = 'global'
    AND is_active = true
  LIMIT 1;

  -- 如果没有配置，使用默认值
  IF v_system_account_id IS NULL THEN
    v_system_account_id := 'd4342410-4f10-45d3-8d60-9f9846ba87e1';
  END IF;

  -- 2. 查找或创建系统通知线程（s2g 类型）
  -- 先尝试查找现有线程
  SELECT id INTO v_thread_id
  FROM chat_threads
  WHERE thread_type = 's2g'
    AND support_id = v_system_account_id::UUID
    AND girl_id = p_girl_id;

  -- 如果不存在则创建
  IF v_thread_id IS NULL THEN
    INSERT INTO chat_threads (
      thread_type,
      support_id,
      girl_id,
      customer_id,
      is_locked,
      last_message_at
    )
    VALUES (
      's2g',
      v_system_account_id::UUID,
      p_girl_id,
      NULL,
      false,
      NOW()
    )
    RETURNING id INTO v_thread_id;
  ELSE
    -- 更新现有线程
    UPDATE chat_threads
    SET
      last_message_at = NOW(),
      updated_at = NOW()
    WHERE id = v_thread_id;
  END IF;

  -- 3. 插入系统消息
  INSERT INTO chat_messages (
    thread_id,
    sender_id,
    sender_role,
    content_type,
    text_content,
    client_msg_id
  )
  VALUES (
    v_thread_id,
    v_system_account_id::UUID,
    'support',
    'text',
    p_content,
    gen_random_uuid()
  )
  RETURNING id INTO v_message_id;

  -- 4. 更新线程的最后消息文本
  UPDATE chat_threads
  SET
    last_message_text = p_content,
    last_message_at = NOW()
  WHERE id = v_thread_id;

  RETURN v_message_id;
END;
$$;

-- 函数2：推送系统消息给单个客户
CREATE OR REPLACE FUNCTION send_system_notification_to_customer(
  p_customer_id UUID,
  p_content TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_thread_id UUID;
  v_message_id UUID;
  v_system_account_id TEXT;
BEGIN
  -- 1. 获取系统账号ID
  SELECT value_text INTO v_system_account_id
  FROM app_configs
  WHERE namespace = 'system'
    AND config_key = 'notification_account_id'
    AND scope = 'global'
    AND is_active = true
  LIMIT 1;

  -- 如果没有配置，使用默认值
  IF v_system_account_id IS NULL THEN
    v_system_account_id := 'd4342410-4f10-45d3-8d60-9f9846ba87e1';
  END IF;

  -- 2. 查找或创建系统通知线程（s2c 类型）
  -- 先尝试查找现有线程
  SELECT id INTO v_thread_id
  FROM chat_threads
  WHERE thread_type = 's2c'
    AND support_id = v_system_account_id::UUID
    AND customer_id = p_customer_id;

  -- 如果不存在则创建
  IF v_thread_id IS NULL THEN
    INSERT INTO chat_threads (
      thread_type,
      support_id,
      customer_id,
      girl_id,
      is_locked,
      last_message_at
    )
    VALUES (
      's2c',
      v_system_account_id::UUID,
      p_customer_id,
      NULL,
      false,
      NOW()
    )
    RETURNING id INTO v_thread_id;
  ELSE
    -- 更新现有线程
    UPDATE chat_threads
    SET
      last_message_at = NOW(),
      updated_at = NOW()
    WHERE id = v_thread_id;
  END IF;

  -- 3. 插入系统消息
  INSERT INTO chat_messages (
    thread_id,
    sender_id,
    sender_role,
    content_type,
    text_content,
    client_msg_id
  )
  VALUES (
    v_thread_id,
    v_system_account_id::UUID,
    'support',
    'text',
    p_content,
    gen_random_uuid()
  )
  RETURNING id INTO v_message_id;

  -- 4. 更新线程的最后消息文本
  UPDATE chat_threads
  SET
    last_message_text = p_content,
    last_message_at = NOW()
  WHERE id = v_thread_id;

  RETURN v_message_id;
END;
$$;

-- ========================================
-- 添加注释
-- ========================================
COMMENT ON FUNCTION send_system_notification_to_girl IS '推送系统消息给单个技师';
COMMENT ON FUNCTION send_system_notification_to_customer IS '推送系统消息给单个客户';
