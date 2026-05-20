ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS admin_tags text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.user_profiles.admin_tags IS 'Admin-only user risk/history tags shown in ops backend.';

CREATE OR REPLACE VIEW public.v_report_monitoring AS
SELECT
  r.id,
  r.reporter_id,
  r.reporter_role,
  r.target_user_id,
  r.report_type,
  r.description,
  r.screenshot_urls,
  r.status,
  r.thread_id,
  r.order_id,
  r.reviewed_by,
  r.reviewed_at,
  r.admin_notes,
  r.created_at,
  r.updated_at,

  CASE
    WHEN reporter_girl.user_id IS NOT NULL THEN json_build_object(
      'user_id', reporter_girl.user_id,
      'display_name', reporter_girl.name,
      'avatar_url', reporter_girl.avatar_url,
      'admin_tags', COALESCE(reporter_user.admin_tags, '{}'::text[]),
      'girl_number', reporter_girl.girl_number,
      'girl_name', reporter_girl.name
    )
    ELSE json_build_object(
      'user_id', reporter_user.id,
      'display_name', reporter_user.display_name,
      'avatar_url', reporter_user.avatar_url,
      'admin_tags', COALESCE(reporter_user.admin_tags, '{}'::text[])
    )
  END AS reporter_profile,

  CASE
    WHEN target_girl.user_id IS NOT NULL THEN json_build_object(
      'user_id', target_girl.user_id,
      'display_name', target_girl.name,
      'avatar_url', target_girl.avatar_url,
      'admin_tags', COALESCE(target_user.admin_tags, '{}'::text[]),
      'girl_number', target_girl.girl_number,
      'girl_name', target_girl.name
    )
    ELSE json_build_object(
      'user_id', target_user.id,
      'display_name', target_user.display_name,
      'avatar_url', target_user.avatar_url,
      'admin_tags', COALESCE(target_user.admin_tags, '{}'::text[])
    )
  END AS target_profile,

  CASE
    WHEN o.id IS NOT NULL THEN json_build_object(
      'id', o.id,
      'order_number', o.order_number
    )
    ELSE NULL
  END AS order_info

FROM public.reports r
LEFT JOIN public.user_profiles reporter_user ON r.reporter_id = reporter_user.id
LEFT JOIN public.girls reporter_girl ON r.reporter_id = reporter_girl.user_id
LEFT JOIN public.user_profiles target_user ON r.target_user_id = target_user.id
LEFT JOIN public.girls target_girl ON r.target_user_id = target_girl.user_id
LEFT JOIN public.orders o ON r.order_id = o.id;
