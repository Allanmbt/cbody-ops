-- CBODY Private 持续生效的常规排班设置。
-- 每名 Incall 技师一条记录；旧 private_availability 每日记录保留用于历史与回滚。

CREATE TABLE IF NOT EXISTS public.private_availability_settings (
  girl_id UUID PRIMARY KEY REFERENCES public.girls(id) ON DELETE CASCADE,
  is_available BOOLEAN NOT NULL DEFAULT false,
  start_time TIME NOT NULL DEFAULT '15:00',
  end_time TIME NOT NULL DEFAULT '02:00',
  ends_next_day BOOLEAN NOT NULL DEFAULT true,
  note JSONB NOT NULL DEFAULT '{"en":""}'::jsonb,
  created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT private_availability_settings_time_range_check
    CHECK (start_time <> end_time),
  CONSTRAINT private_availability_settings_note_object_check
    CHECK (jsonb_typeof(note) = 'object')
);

CREATE INDEX IF NOT EXISTS private_availability_settings_available_idx
  ON public.private_availability_settings (girl_id)
  WHERE is_available = true;

-- 从每名技师最新的每日排班初始化常规设置，不覆盖已经创建的常规设置。
INSERT INTO public.private_availability_settings (
  girl_id,
  is_available,
  start_time,
  end_time,
  ends_next_day,
  note,
  created_by,
  updated_by,
  created_at,
  updated_at
)
SELECT DISTINCT ON (daily.girl_id)
  daily.girl_id,
  daily.is_available,
  COALESCE(daily.start_time, '15:00'::time),
  CASE
    WHEN COALESCE(daily.end_time, '02:00'::time) =
         COALESCE(daily.start_time, '15:00'::time)
      THEN '02:00'::time
    ELSE COALESCE(daily.end_time, '02:00'::time)
  END,
  CASE
    WHEN daily.start_time IS NULL OR daily.end_time IS NULL THEN true
    ELSE daily.ends_next_day
  END,
  COALESCE(daily.note, '{"en":""}'::jsonb),
  daily.created_by,
  daily.updated_by,
  daily.created_at,
  daily.updated_at
FROM public.private_availability AS daily
ORDER BY daily.girl_id, daily.service_date DESC, daily.updated_at DESC
ON CONFLICT (girl_id) DO NOTHING;

DROP TRIGGER IF EXISTS private_availability_settings_set_updated_at
  ON public.private_availability_settings;

CREATE TRIGGER private_availability_settings_set_updated_at
  BEFORE UPDATE ON public.private_availability_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.private_set_updated_at();

ALTER TABLE public.private_availability_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.private_availability_settings FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.private_availability_settings
  TO authenticated;

DROP POLICY IF EXISTS private_availability_settings_admin_select
  ON public.private_availability_settings;
CREATE POLICY private_availability_settings_admin_select
  ON public.private_availability_settings
  FOR SELECT TO authenticated
  USING (
    public.private_is_active_admin(ARRAY['superadmin', 'admin', 'support'])
  );

DROP POLICY IF EXISTS private_availability_settings_admin_insert
  ON public.private_availability_settings;
CREATE POLICY private_availability_settings_admin_insert
  ON public.private_availability_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.private_is_active_admin(ARRAY['superadmin', 'admin', 'support'])
  );

DROP POLICY IF EXISTS private_availability_settings_admin_update
  ON public.private_availability_settings;
CREATE POLICY private_availability_settings_admin_update
  ON public.private_availability_settings
  FOR UPDATE TO authenticated
  USING (
    public.private_is_active_admin(ARRAY['superadmin', 'admin', 'support'])
  )
  WITH CHECK (
    public.private_is_active_admin(ARRAY['superadmin', 'admin', 'support'])
  );

DROP POLICY IF EXISTS private_availability_settings_admin_delete
  ON public.private_availability_settings;
CREATE POLICY private_availability_settings_admin_delete
  ON public.private_availability_settings
  FOR DELETE TO authenticated
  USING (
    public.private_is_active_admin(ARRAY['superadmin', 'admin'])
  );

REVOKE ALL ON TABLE public.private_availability_settings FROM anon;
