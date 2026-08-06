-- Private 服务介绍、包含内容与排序统一由服务目录维护。
-- 技师服务关系只保留发布状态；制服仍通过关联表按技师服务单独绑定。

ALTER TABLE public.private_service_settings
  ADD COLUMN IF NOT EXISTS includes_override JSONB NOT NULL DEFAULT '{"en":[]}'::JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'private_service_settings_includes_object_check'
      AND conrelid = 'public.private_service_settings'::REGCLASS
  ) THEN
    ALTER TABLE public.private_service_settings
      ADD CONSTRAINT private_service_settings_includes_object_check
      CHECK (jsonb_typeof(includes_override) = 'object');
  END IF;
END;
$$;

-- 每项服务选取一份已有包含内容作为公共初始值，避免迁移后全部变空。
UPDATE public.private_service_settings AS setting
SET includes_override = COALESCE((
  SELECT provider.includes_override
  FROM public.private_provider_services AS provider
  JOIN public.admin_girl_services AS relation
    ON relation.id = provider.admin_girl_service_id
  WHERE relation.service_id = setting.service_id
    AND jsonb_typeof(provider.includes_override) = 'object'
    AND provider.includes_override <> '{"en":[]}'::JSONB
  ORDER BY provider.sort_order, provider.admin_girl_service_id
  LIMIT 1
), setting.includes_override)
WHERE setting.includes_override = '{"en":[]}'::JSONB;

CREATE OR REPLACE FUNCTION public.private_enforce_shared_service_content()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  shared_setting public.private_service_settings%ROWTYPE;
BEGIN
  SELECT setting.*
  INTO shared_setting
  FROM public.private_service_settings AS setting
  JOIN public.admin_girl_services AS relation
    ON relation.service_id = setting.service_id
  WHERE relation.id = NEW.admin_girl_service_id;

  IF FOUND THEN
    NEW.sort_order := shared_setting.sort_order;
    NEW.description_override := shared_setting.description_override;
    NEW.includes_override := shared_setting.includes_override;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS private_provider_services_enforce_shared_content
  ON public.private_provider_services;

CREATE TRIGGER private_provider_services_enforce_shared_content
BEFORE INSERT OR UPDATE ON public.private_provider_services
FOR EACH ROW
EXECUTE FUNCTION public.private_enforce_shared_service_content();

CREATE OR REPLACE FUNCTION public.private_sync_shared_service_content()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  UPDATE public.private_provider_services AS provider
  SET sort_order = NEW.sort_order,
      description_override = NEW.description_override,
      includes_override = NEW.includes_override,
      updated_by = NEW.updated_by,
      updated_at = NOW()
  FROM public.admin_girl_services AS relation
  WHERE relation.id = provider.admin_girl_service_id
    AND relation.service_id = NEW.service_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS private_service_settings_sync_shared_content
  ON public.private_service_settings;

CREATE TRIGGER private_service_settings_sync_shared_content
AFTER INSERT OR UPDATE OF description_override, includes_override, sort_order
ON public.private_service_settings
FOR EACH ROW
EXECUTE FUNCTION public.private_sync_shared_service_content();

-- 立即统一现有技师服务记录；公共介绍与包含内容已先完成回填。
UPDATE public.private_provider_services AS provider
SET sort_order = setting.sort_order,
    description_override = setting.description_override,
    includes_override = setting.includes_override,
    updated_at = NOW()
FROM public.admin_girl_services AS relation
JOIN public.private_service_settings AS setting
  ON setting.service_id = relation.service_id
WHERE relation.id = provider.admin_girl_service_id;

REVOKE ALL ON FUNCTION public.private_enforce_shared_service_content()
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.private_sync_shared_service_content()
  FROM PUBLIC, anon, authenticated;
