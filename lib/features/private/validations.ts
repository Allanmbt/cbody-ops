import { z } from "zod"

const optionalHttpsUrl = z.string().refine(
  (value) => value === "" || /^https:\/\//i.test(value),
  "必须为空或使用 HTTPS 地址"
)

const httpsUrl = z.string().url("请输入有效 URL").refine(
  (value) => /^https:\/\//i.test(value),
  "必须使用 HTTPS 地址"
)

export const privateProfileFormSchema = z.object({
  introduction_en: z.string().max(240, "短介绍最多 240 字"),
  introduction_zh: z.string().max(240).optional(),
  introduction_th: z.string().max(240).optional(),
  bio_en: z.string().max(3000, "详情介绍最多 3000 字"),
  bio_zh: z.string().max(3000).optional(),
  bio_th: z.string().max(3000).optional(),
  personal_tags_en: z.string(),
  skin_tone_en: z.string().max(80),
  body_type_en: z.string().max(80),
  display_age: z.coerce.number().int().min(20).max(99).nullable(),
  badge: z.enum(["none", "hot", "new", "signature", "vip"]),
  sort_order: z.coerce.number().int().min(0),
  is_published: z.boolean(),
  health_certified: z.boolean(),
  booking_url: optionalHttpsUrl,
})

export const privateMediaFormSchema = z.object({
  kind: z.enum(["image", "video"]),
  role: z.enum(["cover", "gallery"]),
  url: httpsUrl,
  poster_url: z.string(),
  mime_type: z.string().max(120),
  alt_en: z.string().max(240),
  sort_order: z.coerce.number().int().min(0),
  is_active: z.boolean(),
}).superRefine((value, ctx) => {
  if (value.kind === "video" && !value.poster_url) {
    ctx.addIssue({ code: "custom", path: ["poster_url"], message: "视频必须填写封面地址" })
  }
  if (value.poster_url && !/^https:\/\//i.test(value.poster_url)) {
    ctx.addIssue({ code: "custom", path: ["poster_url"], message: "必须使用 HTTPS 地址" })
  }
})

export const privateAlbumSettingsFormSchema = z.object({
  background_audio_url: optionalHttpsUrl,
  background_audio_object_key: z.string().max(500),
  background_audio_mime_type: z.string().max(120),
  background_audio_title: z.string().max(160),
  background_volume: z.coerce.number().min(0).max(1),
  background_loop: z.boolean(),
  is_audio_enabled: z.boolean(),
  slide_duration_seconds: z.coerce.number().int().min(3).max(10),
}).superRefine((value, ctx) => {
  if (value.is_audio_enabled && !value.background_audio_url) {
    ctx.addIssue({
      code: "custom",
      path: ["background_audio_url"],
      message: "启用背景音乐前必须填写音频地址",
    })
  }
})

export const privateAvailabilityFormSchema = z.object({
  is_available: z.boolean(),
  start_time: z.string(),
  end_time: z.string(),
  ends_next_day: z.boolean(),
  note_en: z.string().max(240),
}).superRefine((value, ctx) => {
  if (Boolean(value.start_time) !== Boolean(value.end_time)) {
    ctx.addIssue({ code: "custom", path: ["end_time"], message: "开始和结束时间必须同时填写" })
  }
  if (value.ends_next_day && (!value.start_time || !value.end_time)) {
    ctx.addIssue({ code: "custom", path: ["ends_next_day"], message: "跨午夜排班必须填写时间" })
  }
})

export const privateServiceSettingFormSchema = z.object({
  is_incall_enabled: z.boolean(),
  supports_attire: z.boolean(),
  display_category: z.enum(["wellness", "yoga", "screening"]),
  description_en: z.string().max(2000),
  description_zh: z.string().max(2000).optional(),
  description_th: z.string().max(2000).optional(),
  sort_order: z.coerce.number().int().min(0),
})

export const privateProviderServiceFormSchema = z.object({
  is_published: z.boolean(),
  sort_order: z.coerce.number().int().min(0),
  description_en: z.string().max(2000),
  includes_en: z.string(),
  attire_ids: z.array(z.string()),
})

export const privateAttireFormSchema = z.object({
  code: z.string().trim().min(1, "制服编号不能为空").max(40),
  name_en: z.string().trim().min(1, "英文名称不能为空").max(120),
  name_zh: z.string().max(120).optional(),
  name_th: z.string().max(120).optional(),
  note_en: z.string().max(500),
  image_url: httpsUrl,
  sort_order: z.coerce.number().int().min(0),
  is_active: z.boolean(),
})

export const privateLocationFormSchema = z.object({
  name: z.string().trim().min(1, "地点名称不能为空").max(200),
  address: z.string().trim().min(1, "内部地址不能为空").max(500),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  place_id: z.string().max(300),
  city_id: z.coerce.number().int().nullable(),
  photos: z.array(httpsUrl).max(9, "最多上传 9 张环境图片"),
  floor: z.string().max(100),
  entrance_note: z.string().max(500),
  parking: z.string().max(300),
  is_active: z.boolean(),
  public_name_en: z.string().max(200),
  public_name_zh: z.string().max(200).optional(),
  public_name_th: z.string().max(200).optional(),
  district_en: z.string().max(120),
  district_zh: z.string().max(120).optional(),
  district_th: z.string().max(120).optional(),
  is_published: z.boolean(),
})

export type PrivateProfileFormData = z.infer<typeof privateProfileFormSchema>
export type PrivateMediaFormData = z.infer<typeof privateMediaFormSchema>
export type PrivateAlbumSettingsFormData = z.infer<typeof privateAlbumSettingsFormSchema>
export type PrivateAvailabilityFormData = z.infer<typeof privateAvailabilityFormSchema>
export type PrivateServiceSettingFormData = z.infer<typeof privateServiceSettingFormSchema>
export type PrivateProviderServiceFormData = z.infer<typeof privateProviderServiceFormSchema>
export type PrivateAttireFormData = z.infer<typeof privateAttireFormSchema>
export type PrivateLocationFormData = z.infer<typeof privateLocationFormSchema>
