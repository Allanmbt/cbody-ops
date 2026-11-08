-- 已安装首页幻灯片时只执行本文件；首次安装先执行 20261108_home_slides.sql。
-- 保留 image_path 供旧客户端作为默认封面，不改变已有图片、跳转或 RLS。
BEGIN;

ALTER TABLE public.home_slides ADD COLUMN image_paths JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.home_slides SET image_paths = jsonb_build_object('en', image_path);

CREATE FUNCTION public.valid_home_slide_images(slide_slot SMALLINT, paths JSONB)
RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE item record;
BEGIN
  IF jsonb_typeof(paths) IS DISTINCT FROM 'object' OR paths = '{}'::jsonb THEN RETURN false; END IF;
  FOR item IN SELECT key, value FROM jsonb_each(paths) LOOP
    IF item.key NOT IN ('en', 'zh', 'th') OR jsonb_typeof(item.value) IS DISTINCT FROM 'string' THEN RETURN false; END IF;
    IF (item.value #>> '{}') !~ '^[1-3]/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
       OR split_part(item.value #>> '{}', '/', 1) <> slide_slot::text THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END;
$$;

CREATE FUNCTION public.sync_home_slide_images()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.image_paths = '{}'::jsonb THEN
    NEW.image_paths := jsonb_build_object('en', NEW.image_path);
  ELSIF TG_OP = 'UPDATE' THEN
    -- 兼容旧后台只替换默认图的调用，保留其他语言。
    IF NEW.image_paths = OLD.image_paths AND NEW.image_path IS DISTINCT FROM OLD.image_path THEN
      NEW.image_paths := jsonb_set(NEW.image_paths, '{en}', to_jsonb(NEW.image_path));
    END IF;
  END IF;
  NEW.image_path := coalesce(NEW.image_paths->>'en', NEW.image_paths->>'zh', NEW.image_paths->>'th');
  RETURN NEW;
END;
$$;

CREATE TRIGGER home_slides_images BEFORE INSERT OR UPDATE ON public.home_slides
  FOR EACH ROW EXECUTE FUNCTION public.sync_home_slide_images();

ALTER TABLE public.home_slides ADD CONSTRAINT home_slides_image_paths_check
  CHECK (public.valid_home_slide_images(slot, image_paths));

COMMENT ON COLUMN public.home_slides.image_paths IS '多语言封面路径：en/zh/th；至少一种语言。缺失语言回退英文，再回退 image_path';
COMMENT ON COLUMN public.home_slides.image_path IS '兼容旧客户端的默认封面，由 en→zh→th 自动选取；图片仍在 home-slides 桶';

-- 仅新增 JSONB 字段、约束和新表触发器，不增加索引，不改变存储路径或策略。
COMMIT;
