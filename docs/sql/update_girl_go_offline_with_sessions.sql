-- ============================================
-- 更新 girl_go_offline 函数
-- ============================================
-- 新增：下线时记录在线会话到 girl_work_sessions 表

CREATE OR REPLACE FUNCTION public.girl_go_offline(
  p_girl_id UUID,
  p_cooldown_hours INTEGER DEFAULT 6
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status TEXT;
  v_last_online_at TIMESTAMPTZ;
  v_session_seconds BIGINT;
  v_now TIMESTAMPTZ := NOW();
  v_cooldown_until TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  -- 获取当前状态
  SELECT status, last_online_at
  INTO v_current_status, v_last_online_at
  FROM girls_status
  WHERE girl_id = p_girl_id;

  -- 检查是否已经离线
  IF v_current_status = 'offline' THEN
    RAISE EXCEPTION 'Already offline';
  END IF;

  -- 计算本次在线时长（秒）
  IF v_last_online_at IS NOT NULL THEN
    v_session_seconds := EXTRACT(EPOCH FROM (v_now - v_last_online_at))::BIGINT;
  ELSE
    v_session_seconds := 0;
  END IF;

  -- 计算冷却截止时间
  v_cooldown_until := v_now + (p_cooldown_hours || ' hours')::INTERVAL;

  -- 更新状态为离线
  UPDATE girls_status
  SET 
    status = 'offline',
    last_offline_at = v_now,
    last_session_seconds = v_session_seconds,
    cooldown_until_at = v_cooldown_until,
    total_online_seconds = total_online_seconds + v_session_seconds,
    updated_at = v_now
  WHERE girl_id = p_girl_id;

  -- 【新增】记录在线会话到统计表（仅当会话时长>0时）
  IF v_session_seconds > 0 AND v_last_online_at IS NOT NULL THEN
    INSERT INTO public.girl_work_sessions (
      girl_id,
      session_type,
      started_at,
      ended_at,
      duration_seconds
    ) VALUES (
      p_girl_id,
      'online',
      v_last_online_at,
      v_now,
      v_session_seconds
    );
  END IF;

  v_result := jsonb_build_object(
    'success', TRUE,
    'status', 'offline',
    'last_offline_at', v_now,
    'cooldown_until_at', v_cooldown_until,
    'session_seconds', v_session_seconds
  );

  RETURN v_result;
END;
$$;

-- 注释
COMMENT ON FUNCTION public.girl_go_offline(UUID, INTEGER) IS '技师下线：更新状态、记录在线会话到统计表';

