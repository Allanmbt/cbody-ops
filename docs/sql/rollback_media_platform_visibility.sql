-- 先回退后台及客户端的平台字段读写，再执行回滚。
-- PostgreSQL 替换视图不能删除列，须在事务内重建；不使用 CASCADE。
BEGIN;

DO $rollback$
DECLARE
  view_owner text;
  view_options text;
  view_comment text;
  saved_grants text[];
  grant_sql text;
  acl record;
BEGIN
  SELECT pg_get_userbyid(c.relowner), array_to_string(c.reloptions, ', '),
         obj_description(c.oid, 'pg_class')
  INTO view_owner, view_options, view_comment
  FROM pg_class c WHERE c.oid = 'public.v_admin_media_list'::regclass;

  SELECT array_agg(statement) INTO saved_grants FROM (
    SELECT format('GRANT %s ON public.v_admin_media_list TO %s%s',
      a.privilege_type,
      CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END,
      CASE WHEN a.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END) AS statement
    FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
    WHERE c.oid = 'public.v_admin_media_list'::regclass
    UNION ALL
    SELECT format('GRANT %s (%I) ON public.v_admin_media_list TO %s%s',
      a.privilege_type, col.attname,
      CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END,
      CASE WHEN a.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END)
    FROM pg_attribute col CROSS JOIN LATERAL aclexplode(col.attacl) a
    WHERE col.attrelid = 'public.v_admin_media_list'::regclass
      AND col.attname NOT IN ('visible_on_ios', 'visible_on_android')
  ) grants;

  DROP VIEW public.v_admin_media_list;
  EXECUTE $view$
    CREATE VIEW public.v_admin_media_list AS
    SELECT
      m.id, m.girl_id, m.kind, m.status, m.storage_key, m.thumb_key,
      m.provider, m.meta, m.min_user_level, m.sort_order,
      m.reviewed_by, m.reviewed_at, m.reject_reason, m.created_by,
      m.created_at, m.updated_at,
      g.girl_number, g.username AS girl_username, g.name AS girl_name,
      reviewer.display_name AS reviewer_name
    FROM public.girls_media m
    LEFT JOIN public.girls g ON m.girl_id = g.id
    LEFT JOIN public.user_profiles reviewer ON m.reviewed_by = reviewer.id
  $view$;

  IF view_options IS NOT NULL THEN
    EXECUTE format('ALTER VIEW public.v_admin_media_list SET (%s)', view_options);
  END IF;
  EXECUTE format('COMMENT ON VIEW public.v_admin_media_list IS %L', view_comment);

  -- 清除重建时默认权限产生的授权，再恢复原表级和列级授权。
  FOR acl IN
    SELECT DISTINCT a.grantee FROM pg_class c
    CROSS JOIN LATERAL aclexplode(c.relacl) a
    WHERE c.oid = 'public.v_admin_media_list'::regclass AND a.grantee <> c.relowner
  LOOP
    EXECUTE format('REVOKE ALL ON public.v_admin_media_list FROM %s',
      CASE WHEN acl.grantee = 0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(acl.grantee)) END);
  END LOOP;
  FOREACH grant_sql IN ARRAY coalesce(saved_grants, ARRAY[]::text[]) LOOP
    EXECUTE grant_sql;
  END LOOP;
  EXECUTE format('ALTER VIEW public.v_admin_media_list OWNER TO %I', view_owner);
END;
$rollback$;

ALTER TABLE public.girls_media
  DROP COLUMN visible_on_ios,
  DROP COLUMN visible_on_android;

COMMIT;
