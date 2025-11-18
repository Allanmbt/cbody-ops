-- ============================================
-- RPC: update_max_travel_distance
-- ============================================
-- 描述：更新技师的最大服务距离
-- 权限：SECURITY DEFINER，仅允许技师更新自己的数据
-- 参数：
--   p_girl_id: 技师ID
--   p_distance: 最大服务距离（公里），范围 10-100
-- 返回：更新后的距离值

CREATE OR REPLACE FUNCTION update_max_travel_distance(
  p_girl_id UUID,
  p_distance INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_updated_distance INTEGER;
BEGIN
  -- 验证距离范围
  IF p_distance < 10 OR p_distance > 100 THEN
    RAISE EXCEPTION 'Distance must be between 10 and 100 km';
  END IF;

  -- 验证当前用户是否有权限修改（通过 user_id 关联）
  SELECT user_id INTO v_user_id
  FROM girls
  WHERE id = p_girl_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Girl not found';
  END IF;

  IF v_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: You can only update your own settings';
  END IF;

  -- 更新最大服务距离
  UPDATE girls
  SET 
    max_travel_distance = p_distance,
    updated_at = NOW()
  WHERE id = p_girl_id
  RETURNING max_travel_distance INTO v_updated_distance;

  -- 返回结果
  RETURN jsonb_build_object(
    'success', true,
    'max_travel_distance', v_updated_distance
  );
END;
$$;

-- 权限设置：允许已认证用户调用
GRANT EXECUTE ON FUNCTION update_max_travel_distance(UUID, INTEGER) TO authenticated;

-- 示例调用
-- SELECT * FROM update_max_travel_distance('girl-uuid', 25);


-- ============================================
-- RPC: update_girl_visibility_to_thai
-- ============================================
-- 描述：更新技师对泰文用户的可见性
-- 权限：SECURITY DEFINER，仅允许技师更新自己的数据
-- 参数：
--   p_girl_id: 技师ID
--   p_is_visible: 是否对泰文用户可见（true=可见, false=隐藏）
-- 返回：JSONB 包含成功状态和消息
-- 注意：此功能可屏蔽大部分使用泰文的顾客，但不是100%有效

CREATE OR REPLACE FUNCTION update_girl_visibility_to_thai(
    p_girl_id UUID,
    p_is_visible BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_auth_uid UUID;
    v_girl_user_id UUID;
BEGIN
    -- 获取当前认证用户ID
    v_auth_uid := auth.uid();

    -- 检查认证
    IF v_auth_uid IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Authentication required'
        );
    END IF;

    -- 获取该技师档案关联的 user_id
    SELECT user_id INTO v_girl_user_id
    FROM girls
    WHERE id = p_girl_id;

    -- 检查技师档案是否存在
    IF v_girl_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Girl profile not found'
        );
    END IF;

    -- 验证当前用户是否拥有该技师档案
    IF v_girl_user_id != v_auth_uid THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Permission denied: You can only update your own profile'
        );
    END IF;

    -- 更新可见性设置
    UPDATE girls
    SET
        is_visible_to_thai = p_is_visible,
        updated_at = NOW()
    WHERE id = p_girl_id;

    -- 检查更新是否成功
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Failed to update visibility setting'
        );
    END IF;

    -- 返回成功结果
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Visibility setting updated successfully',
        'is_visible_to_thai', p_is_visible,
        'updated_at', NOW()
    );

EXCEPTION
    WHEN OTHERS THEN
        -- 处理任何未预期的错误
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Error: ' || SQLERRM
        );
END;
$$;

-- 授予执行权限给已认证用户
GRANT EXECUTE ON FUNCTION update_girl_visibility_to_thai(UUID, BOOLEAN) TO authenticated;

-- 添加函数注释
COMMENT ON FUNCTION update_girl_visibility_to_thai(UUID, BOOLEAN) IS
'更新技师对泰文用户的可见性。设置为false时可屏蔽大部分泰国顾客，但不是100%有效。必须由技师本人调用以更新自己的档案。';

-- 示例调用
-- SELECT * FROM update_girl_visibility_to_thai('girl-uuid', false);
