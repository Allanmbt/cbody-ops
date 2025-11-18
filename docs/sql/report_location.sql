-- ============================================
-- RPC: report_location
-- ============================================
-- 描述：上报技师当前位置（带完整权限检查）
-- 权限要求：
--   1. 用户必须已登录
--   2. 用户必须绑定到 girls 表
--   3. 技师未被屏蔽
--   4. 技师当前不是下线状态
-- ============================================

CREATE OR REPLACE FUNCTION public.report_location(
  p_girl_id UUID,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_is_blocked BOOLEAN;
  v_status TEXT;
  v_result JSONB;
BEGIN
  -- 1. 验证坐标范围
  IF p_lat < -90 OR p_lat > 90 OR p_lng < -180 OR p_lng > 180 THEN
    RAISE EXCEPTION 'Invalid coordinates: lat must be -90 to 90, lng must be -180 to 180';
  END IF;

  -- 2. 检查用户是否登录
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User not authenticated';
  END IF;

  -- 3. 检查 girl_id 是否属于当前用户
  SELECT user_id, is_blocked 
  INTO v_user_id, v_is_blocked
  FROM girls
  WHERE id = p_girl_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Girl not found';
  END IF;

  IF v_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: This girl account does not belong to you';
  END IF;

  -- 4. 检查技师是否被屏蔽
  IF v_is_blocked THEN
    RAISE EXCEPTION 'Account blocked: Cannot report location';
  END IF;

  -- 5. 检查技师状态（不允许下线状态上报）
  SELECT status INTO v_status
  FROM girls_status
  WHERE girl_id = p_girl_id;

  IF v_status = 'offline' THEN
    RAISE EXCEPTION 'Offline status: Cannot report location when offline';
  END IF;

  -- 6. 更新位置
  UPDATE girls_status
  SET 
    current_lat = p_lat,
    current_lng = p_lng,
    reported_at = NOW(),
    updated_at = NOW()
  WHERE girl_id = p_girl_id;

  -- 如果没有找到记录（不应该发生，但作为兜底）
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Girl status not found';
  END IF;

  -- 7. 返回成功结果
  v_result := jsonb_build_object(
    'success', true,
    'girl_id', p_girl_id,
    'current_lat', p_lat,
    'current_lng', p_lng,
    'status', v_status,
    'reported_at', NOW()
  );

  RETURN v_result;
END;
$$;

-- 授予权限
GRANT EXECUTE ON FUNCTION public.report_location(UUID, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

-- 注释
COMMENT ON FUNCTION public.report_location IS '上报技师位置（带完整权限检查：登录、绑定、未屏蔽、非下线状态）';

-- ============================================
-- 示例调用
-- ============================================
-- SELECT * FROM report_location('girl-uuid', 13.7563, 100.5018);

