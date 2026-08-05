-- CBODY Private 混合相册：每名技师一份独立背景音乐与轮播设置。
-- 只新增 Private 扩展表，不修改 girls、girls_media 或其他原 CBODY 表。

CREATE TABLE IF NOT EXISTS public.private_album_settings (
  girl_id UUID PRIMARY KEY REFERENCES public.girls(id) ON DELETE CASCADE,
  background_audio_url TEXT NULL,
  background_audio_object_key TEXT NULL,
  background_audio_mime_type TEXT NULL,
  background_audio_title TEXT NULL,
  background_volume NUMERIC(3, 2) NOT NULL DEFAULT 0.35,
  background_loop BOOLEAN NOT NULL DEFAULT true,
  is_audio_enabled BOOLEAN NOT NULL DEFAULT false,
  slide_duration_seconds SMALLINT NOT NULL DEFAULT 5,
  created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT private_album_settings_audio_url_check CHECK (
    background_audio_url IS NULL OR background_audio_url ~* '^https://'
  ),
  CONSTRAINT private_album_settings_volume_check CHECK (
    background_volume >= 0 AND background_volume <= 1
  ),
  CONSTRAINT private_album_settings_slide_duration_check CHECK (
    slide_duration_seconds BETWEEN 3 AND 10
  ),
  CONSTRAINT private_album_settings_enabled_audio_check CHECK (
    is_audio_enabled = false OR background_audio_url IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS private_album_settings_enabled_idx
  ON public.private_album_settings (girl_id)
  WHERE is_audio_enabled = true;

DROP TRIGGER IF EXISTS private_album_settings_set_updated_at
  ON public.private_album_settings;

CREATE TRIGGER private_album_settings_set_updated_at
  BEFORE UPDATE ON public.private_album_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.private_set_updated_at();

ALTER TABLE public.private_album_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.private_album_settings FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.private_album_settings TO authenticated;

DROP POLICY IF EXISTS private_album_settings_admin_select
  ON public.private_album_settings;
CREATE POLICY private_album_settings_admin_select
  ON public.private_album_settings
  FOR SELECT TO authenticated
  USING (public.private_is_active_admin(ARRAY['superadmin', 'admin', 'support']));

DROP POLICY IF EXISTS private_album_settings_admin_insert
  ON public.private_album_settings;
CREATE POLICY private_album_settings_admin_insert
  ON public.private_album_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.private_is_active_admin(ARRAY['superadmin', 'admin']));

DROP POLICY IF EXISTS private_album_settings_admin_update
  ON public.private_album_settings;
CREATE POLICY private_album_settings_admin_update
  ON public.private_album_settings
  FOR UPDATE TO authenticated
  USING (public.private_is_active_admin(ARRAY['superadmin', 'admin']))
  WITH CHECK (public.private_is_active_admin(ARRAY['superadmin', 'admin']));

DROP POLICY IF EXISTS private_album_settings_admin_delete
  ON public.private_album_settings;
CREATE POLICY private_album_settings_admin_delete
  ON public.private_album_settings
  FOR DELETE TO authenticated
  USING (public.private_is_active_admin(ARRAY['superadmin', 'admin']));

REVOKE ALL ON TABLE public.private_album_settings FROM anon;
