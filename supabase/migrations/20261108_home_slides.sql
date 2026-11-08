-- 首页幻灯片：新增独立表和公开桶，不修改现有业务表或存储桶。
BEGIN;

CREATE TABLE public.home_slides (
  slot SMALLINT PRIMARY KEY CHECK (slot BETWEEN 1 AND 3),
  image_path TEXT NOT NULL,
  link_type TEXT NOT NULL DEFAULT 'none' CHECK (link_type IN ('none', 'internal', 'external')),
  link_target TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT home_slides_image_path_check CHECK (
    image_path ~ '^[1-3]/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
    AND split_part(image_path, '/', 1) = slot::text
  ),
  CONSTRAINT home_slides_link_check CHECK (
    (link_type = 'none' AND link_target IS NULL)
    OR (
      link_type IN ('internal', 'external')
      AND link_target IS NOT NULL AND length(link_target) BETWEEN 1 AND 2048
      AND link_target !~ $regex$[[:space:]\\[:cntrl:]]$regex$
      AND link_target !~* '%(0[0-9a-f]|1[0-9a-f]|7f|5c)'
      AND (
        (link_type = 'internal' AND left(link_target, 1) = '/'
          AND link_target !~* '^/(/|%2f)')
        OR (link_type = 'external'
          AND link_target ~ $regex$^https://[^/?#@[:space:]\\]+([/?#][^[:space:]\\]*)?$$regex$)
      )
    )
  )
);

COMMENT ON TABLE public.home_slides IS '首页幻灯片，位置 1–3；没有记录时客户端隐藏轮播区域';
COMMENT ON COLUMN public.home_slides.image_path IS 'home-slides 公开桶内路径：{slot}/{随机UUID}.jpg|png|webp';
COMMENT ON COLUMN public.home_slides.link_type IS 'none 不跳转，internal 客户端内路由，external 外部 HTTPS';
COMMENT ON COLUMN public.home_slides.updated_at IS '并发修改标记，修改和删除须匹配读取时的原值';

-- 确保同一位置每次修改都会产生新的版本时间，保护并发编辑。
CREATE FUNCTION public.touch_home_slide_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.created_at := OLD.created_at;
  NEW.updated_at := greatest(clock_timestamp(), OLD.updated_at + interval '1 microsecond');
  RETURN NEW;
END;
$$;
CREATE TRIGGER home_slides_updated_at
  BEFORE UPDATE ON public.home_slides
  FOR EACH ROW EXECUTE FUNCTION public.touch_home_slide_updated_at();

ALTER TABLE public.home_slides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.home_slides FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.home_slides TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.home_slides TO authenticated;
GRANT ALL ON public.home_slides TO service_role;

CREATE POLICY home_slides_public_select ON public.home_slides
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY home_slides_admin_insert ON public.home_slides
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY home_slides_admin_update ON public.home_slides
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY home_slides_admin_delete ON public.home_slides
  FOR DELETE TO authenticated USING (public.is_admin());

-- 独立公开桶；若同名桶已被手动创建则核对其设置，绝不改动其他桶。
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('home-slides', 'home-slides', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'home-slides' AND public = true AND file_size_limit = 5242880
      AND allowed_mime_types @> ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
      AND allowed_mime_types <@ ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
  ) THEN
    RAISE EXCEPTION 'home-slides 存储桶设置不匹配：请设为公开、最大 5 MiB、仅允许 JPEG/PNG/WebP，再执行安装';
  END IF;
END;
$$;

-- 公开图片下载依赖桶的 public 设置；不开放匿名列表及写入。
CREATE POLICY home_slides_storage_admin_select ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'home-slides' AND public.is_admin());
CREATE POLICY home_slides_storage_admin_insert ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'home-slides' AND public.is_admin()
    AND name ~ '^[1-3]/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
  );
CREATE POLICY home_slides_storage_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'home-slides' AND public.is_admin())
  WITH CHECK (
    bucket_id = 'home-slides' AND public.is_admin()
    AND name ~ '^[1-3]/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
  );
CREATE POLICY home_slides_storage_admin_delete ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'home-slides' AND public.is_admin());

COMMIT;
