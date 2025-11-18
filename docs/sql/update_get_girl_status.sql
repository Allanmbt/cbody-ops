-- ============================================
-- 更新 get_girl_status RPC 以返回 cooldown_until_at
-- ============================================

-- 删除旧版本
DROP FUNCTION IF EXISTS public.get_girl_status(UUID);

-- 创建新版本（添加 cooldown_until_at 字段）
CREATE OR REPLACE FUNCTION public.get_girl_status(p_girl_id UUID)
RETURNS TABLE (
  status TEXT,
  current_lat DOUBLE PRECISION,
  current_lng DOUBLE PRECISION,
  is_blocked BOOLEAN,
  next_available_time TIMESTAMPTZ,
  active_orders_count INTEGER,
  cooldown_until_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    gs.status,
    gs.current_lat,
    gs.current_lng,
    g.is_blocked,
    gs.next_available_time,
    gs.active_orders_count,
    gs.cooldown_until_at
  FROM girls_status gs
  JOIN girls g ON g.id = gs.girl_id
  WHERE gs.girl_id = p_girl_id;
END;
$$;

-- 授予权限
GRANT EXECUTE ON FUNCTION public.get_girl_status(UUID) TO authenticated;

-- ============================================
-- 完成！请在 Supabase SQL Editor 中执行此脚本
-- ============================================

