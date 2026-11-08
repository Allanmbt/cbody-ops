-- 媒体平台展示设置：先执行迁移，再部署后台和客户端。
BEGIN;

ALTER TABLE public.girls_media
  ADD COLUMN visible_on_ios BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN visible_on_android BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.girls_media.visible_on_ios IS '是否在 iOS App 展示；与审核状态、会员等级条件叠加';
COMMENT ON COLUMN public.girls_media.visible_on_android IS '是否在 Android App 展示；Web 始终可见';

-- 只在原视图末尾追加字段，保留原列顺序和权限。
CREATE OR REPLACE VIEW public.v_admin_media_list AS
SELECT
  m.id, m.girl_id, m.kind, m.status, m.storage_key, m.thumb_key,
  m.provider, m.meta, m.min_user_level, m.sort_order,
  m.reviewed_by, m.reviewed_at, m.reject_reason, m.created_by,
  m.created_at, m.updated_at,
  g.girl_number, g.username AS girl_username, g.name AS girl_name,
  reviewer.display_name AS reviewer_name,
  m.visible_on_ios, m.visible_on_android
FROM public.girls_media m
LEFT JOIN public.girls g ON m.girl_id = g.id
LEFT JOIN public.user_profiles reviewer ON m.reviewed_by = reviewer.id;

-- 不增加索引，不修改 RLS、Storage、meta 或媒体文件。
COMMIT;
