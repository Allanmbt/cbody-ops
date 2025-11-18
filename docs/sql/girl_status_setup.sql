-- ============================================
-- 技师状态管理 SQL 安装脚本
-- ============================================
-- 本脚本包含：
-- 1. RPC 函数（获取状态、上下线、更新位置）
-- 2. 在线时长统计与冷却期管理
-- 3. 上下线自动管理定位追踪（通过前端实现）
-- ============================================

-- 1. 获取技师当前状态
create or replace function public.get_girl_status(p_girl_id uuid)
returns table (
  status text,
  current_lat double precision,
  current_lng double precision,
  is_blocked boolean,
  next_available_time timestamptz,
  active_orders_count integer,
  cooldown_until_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select 
    gs.status,
    gs.current_lat,
    gs.current_lng,
    g.is_blocked,
    gs.next_available_time,
    gs.active_orders_count,
    gs.cooldown_until_at
  from girls_status gs
  join girls g on g.id = gs.girl_id
  where gs.girl_id = p_girl_id;
end;
$$;

-- 2. 刷新当前位置
create or replace function public.update_current_location(
  p_girl_id uuid,
  p_lat double precision,
  p_lng double precision
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  -- 验证坐标
  if p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'Invalid coordinates';
  end if;

  -- 更新当前位置
  update girls_status
  set 
    current_lat = p_lat,
    current_lng = p_lng,
    updated_at = now()
  where girl_id = p_girl_id;

  -- 如果没有找到记录，创建一个
  if not found then
    insert into girls_status (girl_id, current_lat, current_lng)
    values (p_girl_id, p_lat, p_lng);
  end if;

  v_result := jsonb_build_object(
    'success', true,
    'current_lat', p_lat,
    'current_lng', p_lng
  );

  return v_result;
end;
$$;

-- 3. 上线（Go Online）
create or replace function public.girl_go_online(
  p_girl_id uuid,
  p_lat double precision default null,
  p_lng double precision default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_status text;
  v_is_blocked boolean;
  v_cooldown_until timestamptz;
  v_now timestamptz := now();
  v_result jsonb;
begin
  -- 获取当前状态和封禁状态
  select gs.status, g.is_blocked, gs.cooldown_until_at
  into v_current_status, v_is_blocked, v_cooldown_until
  from girls_status gs
  join girls g on g.id = gs.girl_id
  where gs.girl_id = p_girl_id;

  -- 检查是否被封禁
  if v_is_blocked = true then
    raise exception 'Account is blocked';
  end if;

  -- 检查是否已经在线
  if v_current_status != 'offline' then
    raise exception 'Already online';
  end if;

  -- 检查冷却期
  if v_cooldown_until is not null and v_cooldown_until > v_now then
    -- 转换为泰国时间并格式化为 YYYY-MM-DD HH24:MI:SS
    raise exception 'Still in cooldown period. Please wait until: %', 
      to_char(v_cooldown_until at time zone 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI:SS');
  end if;

  -- 更新状态为上线
  update girls_status
  set 
    status = 'available',
    last_online_at = v_now,
    current_lat = coalesce(p_lat, current_lat),
    current_lng = coalesce(p_lng, current_lng),
    cooldown_until_at = null,
    updated_at = v_now
  where girl_id = p_girl_id;

  v_result := jsonb_build_object(
    'success', true,
    'status', 'available',
    'last_online_at', v_now
  );

  return v_result;
end;
$$;

-- 4. 下线（Go Offline）
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

  -- 记录在线会话到统计表（仅当会话时长>0时）
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

-- ============================================
-- 安装完成
-- ============================================
-- 使用方法：
--
-- 上线：
-- SELECT public.girl_go_online('girl-uuid', 13.7563, 100.5018);
--
-- 下线（使用默认6小时冷却）：
-- SELECT public.girl_go_offline('girl-uuid');
--
-- 下线（自定义冷却时间）：
-- SELECT public.girl_go_offline('girl-uuid', 12);
--
-- 查询状态：
-- SELECT * FROM public.get_girl_status('girl-uuid');
--
-- 更新当前位置：
-- SELECT public.update_current_location('girl-uuid', 13.7563, 100.5018);
-- ============================================

-- ============================================
-- 授予权限
-- ============================================
-- 允许所有已认证用户调用这些 RPC 函数
GRANT EXECUTE ON FUNCTION public.get_girl_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_current_location(UUID, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
GRANT EXECUTE ON FUNCTION public.girl_go_online(UUID, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
GRANT EXECUTE ON FUNCTION public.girl_go_offline(UUID, INTEGER) TO authenticated;

-- ============================================
-- Realtime 配置
-- ============================================
-- 启用 Realtime 发布（确保 girls_status 表可以发送实时更新）
-- 注意：在 Supabase Dashboard 中也需要启用该表的 Realtime
-- Dashboard -> Database -> Replication -> 勾选 girls_status 表

-- 设置 REPLICA IDENTITY 为 FULL，确保 Realtime payload 包含所有字段
-- 这样客户端可以在 payload.new 中获取完整的行数据
ALTER TABLE public.girls_status REPLICA IDENTITY FULL;

-- 验证配置：
-- SELECT relname, relreplident 
-- FROM pg_class 
-- WHERE relname = 'girls_status';
-- 
-- relreplident 值说明：
-- 'd' = default (只发送主键)
-- 'f' = full (发送所有字段) ✓
-- 'i' = index (发送索引字段)
-- 'n' = nothing

