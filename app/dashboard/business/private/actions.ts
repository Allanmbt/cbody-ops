"use server"

import { z } from "zod"

import { logAuditAction } from "@/lib/audit"
import { requireAdmin } from "@/lib/auth"
import {
  bangkokDate,
  privateAlbumSettingsFormSchema,
  privateAttireFormSchema,
  privateAvailabilityFormSchema,
  privateLocationFormSchema,
  privateMediaFormSchema,
  privateProfileFormSchema,
  privateProviderServiceFormSchema,
  privateServiceSettingFormSchema,
  type PrivateAlbumSettings,
  type PrivateAttire,
  type PrivateAvailability,
  type PrivateDataset,
  type PrivateIncallLocation,
  type PrivateLocationContent,
  type PrivateMedia,
  type PrivateMutationAction,
  type PrivateProfile,
  type PrivateProviderService,
  type PrivateProviderServiceAttire,
  type PrivateServiceSetting,
} from "@/lib/features/private"
import { getSupabaseAdminClient } from "@/lib/supabase"

type ActionResponse<T> = { ok: true; data: T } | { ok: false; error: string }

const uuidSchema = z.string().uuid("记录 ID 无效")
const localizedTextSchema = z.record(z.string(), z.string())
const localizedListSchema = z.record(z.string(), z.array(z.string()))

const profileRecordSchema = z.object({
  girl_id: uuidSchema,
  introduction: localizedTextSchema,
  bio: localizedTextSchema,
  personal_tags: localizedListSchema,
  skin_tone: localizedTextSchema,
  body_type: localizedTextSchema,
  display_age: z.number().int().min(20).max(99).nullable(),
  badge: z.enum(["hot", "new", "signature", "vip"]).nullable(),
  sort_order: z.number().int().min(0),
  is_published: z.boolean(),
  health_certified: z.boolean(),
  booking_url: z.string(),
})

const mediaRecordSchema = z.object({
  id: uuidSchema,
  girl_id: uuidSchema,
  kind: z.enum(["image", "video"]),
  role: z.enum(["cover", "gallery"]),
  url: z.string(),
  poster_url: z.string().nullable(),
  mime_type: z.string().nullable(),
  alt: localizedTextSchema,
  sort_order: z.number().int().min(0),
  is_active: z.boolean(),
})

const availabilityRecordSchema = z.object({
  id: uuidSchema,
  girl_id: uuidSchema,
  service_date: z.iso.date(),
  is_available: z.boolean(),
  start_time: z.string().nullable(),
  end_time: z.string().nullable(),
  ends_next_day: z.boolean(),
  note: localizedTextSchema,
})

const serviceSettingRecordSchema = z.object({
  service_id: z.number().int().positive(),
  is_incall_enabled: z.boolean(),
  supports_attire: z.boolean(),
  display_category: z.enum(["wellness", "yoga", "screening"]),
  name_override: localizedTextSchema,
  description_override: localizedTextSchema,
  sort_order: z.number().int().min(0),
})

const providerServiceRecordSchema = z.object({
  admin_girl_service_id: uuidSchema,
  is_published: z.boolean(),
  sort_order: z.number().int().min(0),
  badge: z.enum(["popular", "trending", "new", "signature", "recommended"]).nullable(),
  description_override: localizedTextSchema,
  includes_override: localizedListSchema,
})

const attireRecordSchema = z.object({
  id: uuidSchema,
  code: z.string().trim().min(1).max(40),
  name: localizedTextSchema,
  note: localizedTextSchema,
  image_url: z.string(),
  sort_order: z.number().int().min(0),
  is_active: z.boolean(),
})

const locationRecordSchema = z.object({
  id: uuidSchema,
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().min(1).max(500),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  place_id: z.string().nullable(),
  city_id: z.number().int().nullable(),
  city_name: z.string(),
  photos: z.array(z.string()).max(9),
  meta: z.object({
    floor: z.string().optional(),
    entrance_note: z.string().optional(),
    parking: z.string().optional(),
  }).catchall(z.unknown()),
  is_active: z.boolean(),
})

const locationContentRecordSchema = z.object({
  incall_location_id: uuidSchema,
  public_name: localizedTextSchema,
  district: localizedTextSchema,
  is_published: z.boolean(),
})

const albumSettingsRecordSchema = z.object({
  girl_id: uuidSchema,
  background_audio_url: z.string().nullable(),
  background_audio_object_key: z.string().nullable(),
  background_audio_mime_type: z.string().nullable(),
  background_audio_title: z.string().nullable(),
  background_volume: z.number().min(0).max(1),
  background_loop: z.boolean(),
  is_audio_enabled: z.boolean(),
  slide_duration_seconds: z.number().int().min(3).max(10),
})

function firstIssue(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues[0]?.message || "数据格式错误"
  return error instanceof Error ? error.message : "操作失败"
}

function textMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { en: "" }
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  )
}

function listMap(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { en: [] }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, Array.isArray(item) ? item.filter((v): v is string => typeof v === "string") : []])
  )
}

function displayName(value: unknown): string {
  const names = textMap(value)
  return names.zh || names.en || names.th || "未命名城市"
}

function assertQuery(label: string, result: { error: { message: string } | null }): void {
  if (result.error) throw new Error(`${label}读取失败：${result.error.message}`)
}

async function assertIncallGirl(db: any, girlId: string): Promise<void> {
  const { data, error } = await db
    .from("girls")
    .select("id")
    .eq("id", girlId)
    .eq("incall_enabled", true)
    .is("deleted_at", null)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error("该技师未开启 Incall，不能维护 Private 扩展")
}

export async function getPrivateManagementData(): Promise<ActionResponse<PrivateDataset>> {
  try {
    await requireAdmin(["superadmin", "admin", "support"])
    const db = getSupabaseAdminClient() as any

    const [
      girlsResult,
      profilesResult,
      availabilityResult,
      mediaResult,
      servicesResult,
      settingsResult,
      adminServicesResult,
      girlDurationsResult,
      durationsResult,
      providerServicesResult,
      attiresResult,
      bindingsResult,
      locationsResult,
      locationContentResult,
      citiesResult,
      girlCategoriesResult,
      categoriesResult,
      albumSettingsResult,
    ] = await Promise.all([
      db.from("girls").select("id,girl_number,username,name,avatar_url,incall_enabled,incall_location_id,is_verified,is_blocked,deleted_at").eq("incall_enabled", true).is("deleted_at", null).order("girl_number").limit(1000),
      db.from("private_profiles").select("*").order("sort_order").limit(1000),
      db.from("private_availability").select("*").eq("service_date", bangkokDate()).limit(1000),
      db.from("private_media").select("*").order("sort_order").limit(5000),
      db.from("services").select("id,code,title,badge,is_active").order("sort_order").limit(1000),
      db.from("private_service_settings").select("*").order("sort_order").limit(1000),
      db.from("admin_girl_services").select("id,girl_id,service_id,is_qualified").eq("is_qualified", true).limit(5000),
      db.from("girl_service_durations").select("admin_girl_service_id,service_duration_id,custom_price,is_active").eq("is_active", true).limit(10000),
      db.from("service_durations").select("id,duration_minutes,default_price,is_active").eq("is_active", true).limit(5000),
      db.from("private_provider_services").select("*").order("sort_order").limit(5000),
      db.from("private_attires").select("*").order("sort_order").limit(1000),
      db.from("private_provider_service_attires").select("*").order("sort_order").limit(5000),
      db.from("incall_locations").select("id,name,address,lat,lng,place_id,city_id,photos,meta,is_active,created_by,created_at,updated_at").order("created_at", { ascending: false }).limit(1000),
      db.from("private_location_content").select("*").limit(1000),
      db.from("cities").select("id,code,name").eq("is_active", true).order("sort_order").limit(1000),
      db.from("girls_categories").select("girl_id,category_id").limit(10000),
      db.from("categories").select("id,name").eq("is_active", true).limit(1000),
      db.from("private_album_settings").select("*").limit(1000),
    ])

    const requiredResults: [string, { error: { message: string } | null }][] = [
      ["技师", girlsResult], ["Private 资料", profilesResult], ["排班", availabilityResult],
      ["媒体", mediaResult], ["服务", servicesResult], ["Private 服务目录", settingsResult],
      ["技师服务", adminServicesResult], ["技师服务时长", girlDurationsResult],
      ["服务时长", durationsResult], ["技师 Private 服务", providerServicesResult],
      ["制服", attiresResult], ["制服绑定", bindingsResult], ["场所", locationsResult],
      ["场所公开内容", locationContentResult], ["城市", citiesResult],
      ["技师分类", girlCategoriesResult], ["分类", categoriesResult],
    ]
    requiredResults.forEach(([label, result]) => assertQuery(label, result))

    const albumSettingsAvailable = !albumSettingsResult.error
    if (albumSettingsResult.error && !/private_album_settings|schema cache/i.test(albumSettingsResult.error.message)) {
      throw new Error(`相册音乐设置读取失败：${albumSettingsResult.error.message}`)
    }

    const cities = new Map((citiesResult.data || []).map((item: any) => [item.id, displayName(item.name)]))
    const categories = new Map((categoriesResult.data || []).map((item: any) => [item.id, displayName(item.name)]))
    const categoryIdsByGirl = new Map<string, number[]>()
    for (const item of girlCategoriesResult.data || []) {
      categoryIdsByGirl.set(item.girl_id, [...(categoryIdsByGirl.get(item.girl_id) || []), item.category_id])
    }

    const durationById = new Map<number, any>((durationsResult.data || []).map((item: any) => [item.id, item]))
    const validDurationsByAdminService = new Map<string, any[]>()
    for (const item of girlDurationsResult.data || []) {
      const duration = durationById.get(item.service_duration_id)
      if (!duration?.is_active) continue
      const current = validDurationsByAdminService.get(item.admin_girl_service_id) || []
      current.push({
        duration_minutes: Number(duration.duration_minutes),
        price: Number(item.custom_price ?? duration.default_price),
      })
      validDurationsByAdminService.set(item.admin_girl_service_id, current)
    }

    const data: PrivateDataset = {
      girls: (girlsResult.data || []).map((item: any) => ({
        ...item,
        girl_number: Number(item.girl_number || 0),
        category_names: (categoryIdsByGirl.get(item.id) || []).map((id) => categories.get(id)).filter(Boolean),
      })),
      profiles: (profilesResult.data || []).map((item: any) => ({
        ...item,
        introduction: textMap(item.introduction), bio: textMap(item.bio), personal_tags: listMap(item.personal_tags),
        skin_tone: textMap(item.skin_tone), body_type: textMap(item.body_type),
      })) as PrivateProfile[],
      availability: (availabilityResult.data || []).map((item: any) => ({ ...item, note: textMap(item.note) })) as PrivateAvailability[],
      media: (mediaResult.data || []).map((item: any) => ({ ...item, alt: textMap(item.alt) })) as PrivateMedia[],
      albumSettings: albumSettingsAvailable ? (albumSettingsResult.data || []).map((item: any) => ({
        ...item,
        background_volume: Number(item.background_volume),
        slide_duration_seconds: Number(item.slide_duration_seconds),
      })) as PrivateAlbumSettings[] : [],
      services: (servicesResult.data || []).map((item: any) => ({ ...item, title: textMap(item.title) })),
      serviceSettings: (settingsResult.data || []).map((item: any) => ({
        ...item, name_override: textMap(item.name_override), description_override: textMap(item.description_override),
      })) as PrivateServiceSetting[],
      adminGirlServices: (adminServicesResult.data || []).map((item: any) => {
        const durations = (validDurationsByAdminService.get(item.id) || []).sort((a, b) => a.duration_minutes - b.duration_minutes)
        return {
          ...item,
          duration_minutes: durations[0]?.duration_minutes || 0,
          price: durations[0]?.price || 0,
          duration_active: durations.length > 0,
        }
      }),
      providerServices: (providerServicesResult.data || []).map((item: any) => ({
        ...item, description_override: textMap(item.description_override), includes_override: listMap(item.includes_override),
      })) as PrivateProviderService[],
      attires: (attiresResult.data || []).map((item: any) => ({ ...item, name: textMap(item.name), note: textMap(item.note) })) as PrivateAttire[],
      providerServiceAttires: (bindingsResult.data || []) as PrivateProviderServiceAttire[],
      cities: (citiesResult.data || []).map((item: any) => ({
        id: Number(item.id),
        code: item.code,
        name: textMap(item.name),
        display_name: displayName(item.name),
      })),
      locations: (locationsResult.data || []).map((item: any) => ({
        ...item,
        lat: Number(item.lat), lng: Number(item.lng), photos: item.photos || [], meta: item.meta || {},
        city_name: item.city_id ? cities.get(item.city_id) || "未知城市" : "未选择城市",
      })) as PrivateIncallLocation[],
      locationContent: (locationContentResult.data || []).map((item: any) => ({
        ...item, public_name: textMap(item.public_name), district: textMap(item.district),
      })) as PrivateLocationContent[],
      capabilities: { albumSettings: albumSettingsAvailable },
    }

    return { ok: true, data }
  } catch (error) {
    console.error("[到店管理] 读取真实数据失败:", error)
    return { ok: false, error: firstIssue(error) }
  }
}

export async function getPrivateAvailabilityForDate(
  serviceDate: string
): Promise<ActionResponse<PrivateAvailability[]>> {
  try {
    await requireAdmin(["superadmin", "admin", "support"])
    const date = z.iso.date().parse(serviceDate)
    const db = getSupabaseAdminClient() as any
    const { data, error } = await db
      .from("private_availability")
      .select("*")
      .eq("service_date", date)
      .order("girl_id")
      .limit(1000)
    if (error) throw new Error(error.message)
    return {
      ok: true,
      data: (data || []).map((item: any) => ({ ...item, note: textMap(item.note) })) as PrivateAvailability[],
    }
  } catch (error) {
    console.error("[到店管理] 按日期读取排班失败:", error)
    return { ok: false, error: firstIssue(error) }
  }
}

async function audit(actorId: string, action: string, target: string, payload?: Record<string, unknown>) {
  await logAuditAction({ actor_id: actorId, action, target, payload })
}

export async function applyPrivateMutation(
  action: PrivateMutationAction
): Promise<ActionResponse<PrivateMutationAction>> {
  try {
    const availabilityAction = action.type === "UPSERT_AVAILABILITY" || action.type === "UPSERT_AVAILABILITY_BATCH" || action.type === "DELETE_AVAILABILITY"
    const admin = await requireAdmin(
      availabilityAction ? ["superadmin", "admin", "support"] : ["superadmin", "admin"]
    )
    if (action.type === "DELETE_AVAILABILITY" && admin.role === "support") {
      return { ok: false, error: "support 不能删除排班" }
    }

    const db = getSupabaseAdminClient() as any
    const now = new Date().toISOString()

    switch (action.type) {
      case "UPSERT_PROFILE": {
        const value = profileRecordSchema.parse(action.value)
        await assertIncallGirl(db, value.girl_id)
        privateProfileFormSchema.parse({
          introduction_en: value.introduction.en || "", introduction_zh: value.introduction.zh || "", introduction_th: value.introduction.th || "",
          bio_en: value.bio.en || "", bio_zh: value.bio.zh || "", bio_th: value.bio.th || "",
          personal_tags_en: (value.personal_tags.en || []).join(","), skin_tone_en: value.skin_tone.en || "",
          body_type_en: value.body_type.en || "", display_age: value.display_age, badge: value.badge || "none",
          sort_order: value.sort_order, is_published: value.is_published, health_certified: value.health_certified,
          booking_url: value.booking_url,
        })
        const { data: existing } = await db.from("private_profiles").select("girl_id").eq("girl_id", value.girl_id).maybeSingle()
        const payload = { ...value, updated_by: admin.id, updated_at: now, ...(!existing ? { created_by: admin.id } : {}) }
        const query = existing
          ? db.from("private_profiles").update(payload).eq("girl_id", value.girl_id)
          : db.from("private_profiles").insert(payload)
        const { data, error } = await query.select("*").single()
        if (error) throw new Error(error.message)
        await audit(admin.id, existing ? "private_profile_update" : "private_profile_create", value.girl_id)
        return { ok: true, data: { type: "UPSERT_PROFILE", value: data as PrivateProfile } }
      }
      case "DELETE_PROFILE": {
        uuidSchema.parse(action.girlId)
        await assertIncallGirl(db, action.girlId)
        const { error } = await db.from("private_profiles").delete().eq("girl_id", action.girlId)
        if (error) throw new Error(error.message)
        await audit(admin.id, "private_profile_delete", action.girlId)
        return { ok: true, data: action }
      }
      case "UPSERT_MEDIA": {
        const value = mediaRecordSchema.parse(action.value)
        await assertIncallGirl(db, value.girl_id)
        privateMediaFormSchema.parse({
          kind: value.kind, role: value.role, url: value.url, poster_url: value.poster_url || "",
          mime_type: value.mime_type || "", alt_en: value.alt.en || "", sort_order: value.sort_order,
          is_active: value.is_active,
        })
        const { data: existing } = await db.from("private_media").select("id").eq("id", value.id).maybeSingle()
        if (!existing) {
          const { count, error: countError } = await db.from("private_media").select("id", { count: "exact", head: true }).eq("girl_id", value.girl_id)
          if (countError) throw new Error(countError.message)
          if ((count || 0) >= 5) return { ok: false, error: "每名技师最多维护 5 项相册媒体" }
        }
        let previousCoverIds: string[] = []
        const replaceCover = value.role === "cover" && value.is_active
        if (replaceCover) {
          const { data: covers, error: coverReadError } = await db.from("private_media").select("id").eq("girl_id", value.girl_id).eq("role", "cover").eq("is_active", true).neq("id", value.id)
          if (coverReadError) throw new Error(coverReadError.message)
          previousCoverIds = (covers || []).map((item: any) => item.id)
          if (previousCoverIds.length) {
            const { error: disableError } = await db.from("private_media").update({ is_active: false, updated_by: admin.id, updated_at: now }).in("id", previousCoverIds)
            if (disableError) throw new Error(disableError.message)
          }
        }
        const payload = { ...value, updated_by: admin.id, updated_at: now, ...(!existing ? { created_by: admin.id } : {}) }
        const query = existing ? db.from("private_media").update(payload).eq("id", value.id) : db.from("private_media").insert(payload)
        const { data, error } = await query.select("*").single()
        if (error) {
          if (previousCoverIds.length) await db.from("private_media").update({ is_active: true, updated_by: admin.id, updated_at: now }).in("id", previousCoverIds)
          throw new Error(error.message)
        }
        await audit(admin.id, existing ? "private_media_update" : "private_media_create", value.id, { girl_id: value.girl_id, kind: value.kind, role: value.role })
        return { ok: true, data: { type: "UPSERT_MEDIA", value: data as PrivateMedia, replaceActiveCover: previousCoverIds.length > 0 } }
      }
      case "DELETE_MEDIA": {
        uuidSchema.parse(action.id)
        const { data: mediaRow, error: mediaReadError } = await db.from("private_media").select("girl_id").eq("id", action.id).maybeSingle()
        if (mediaReadError) throw new Error(mediaReadError.message)
        if (!mediaRow) return { ok: false, error: "媒体记录不存在" }
        await assertIncallGirl(db, mediaRow.girl_id)
        const { error } = await db.from("private_media").delete().eq("id", action.id)
        if (error) throw new Error(error.message)
        await audit(admin.id, "private_media_delete", action.id)
        return { ok: true, data: action }
      }
      case "UPSERT_ALBUM_SETTINGS": {
        const value = albumSettingsRecordSchema.parse(action.value)
        await assertIncallGirl(db, value.girl_id)
        privateAlbumSettingsFormSchema.parse({
          background_audio_url: value.background_audio_url || "",
          background_audio_object_key: value.background_audio_object_key || "",
          background_audio_mime_type: value.background_audio_mime_type || "",
          background_audio_title: value.background_audio_title || "",
          background_volume: value.background_volume,
          background_loop: value.background_loop,
          is_audio_enabled: value.is_audio_enabled,
          slide_duration_seconds: value.slide_duration_seconds,
        })
        const { data: existing, error: readError } = await db.from("private_album_settings").select("girl_id").eq("girl_id", value.girl_id).maybeSingle()
        if (readError) throw new Error("背景音乐表尚未部署，请先应用本次 Supabase migration")
        const payload = { ...value, updated_by: admin.id, updated_at: now, ...(!existing ? { created_by: admin.id } : {}) }
        const query = existing
          ? db.from("private_album_settings").update(payload).eq("girl_id", value.girl_id)
          : db.from("private_album_settings").insert(payload)
        const { data, error } = await query.select("*").single()
        if (error) throw new Error(error.message)
        await audit(admin.id, existing ? "private_album_settings_update" : "private_album_settings_create", value.girl_id)
        return { ok: true, data: { type: "UPSERT_ALBUM_SETTINGS", value: { ...data, background_volume: Number(data.background_volume) } as PrivateAlbumSettings } }
      }
      case "UPSERT_AVAILABILITY":
      case "UPSERT_AVAILABILITY_BATCH": {
        const inputValues = action.type === "UPSERT_AVAILABILITY" ? [action.value] : action.values
        const values = inputValues.map((item) => availabilityRecordSchema.parse(item))
        await Promise.all([...new Set(values.map((item) => item.girl_id))].map((girlId) => assertIncallGirl(db, girlId)))
        values.forEach((value) => privateAvailabilityFormSchema.parse({
          is_available: value.is_available, start_time: value.start_time || "", end_time: value.end_time || "",
          ends_next_day: value.ends_next_day, note_en: value.note.en || "",
        }))
        const payloads = values.map(({ id: _id, ...value }) => ({ ...value, updated_by: admin.id, updated_at: now }))
        const { data, error } = await db.from("private_availability").upsert(payloads, { onConflict: "girl_id,service_date" }).select("*")
        if (error) throw new Error(error.message)
        await audit(admin.id, "private_availability_upsert", values.map((item) => item.girl_id).join(","), { count: values.length })
        const records = (data || []).map((item: any) => ({ ...item, note: textMap(item.note) })) as PrivateAvailability[]
        return { ok: true, data: records.length === 1 && action.type === "UPSERT_AVAILABILITY" ? { type: "UPSERT_AVAILABILITY", value: records[0] } : { type: "UPSERT_AVAILABILITY_BATCH", values: records } }
      }
      case "DELETE_AVAILABILITY": {
        uuidSchema.parse(action.id)
        const { data: availabilityRow, error: availabilityReadError } = await db.from("private_availability").select("girl_id").eq("id", action.id).maybeSingle()
        if (availabilityReadError) throw new Error(availabilityReadError.message)
        if (!availabilityRow) return { ok: false, error: "排班记录不存在" }
        await assertIncallGirl(db, availabilityRow.girl_id)
        const { error } = await db.from("private_availability").delete().eq("id", action.id)
        if (error) throw new Error(error.message)
        await audit(admin.id, "private_availability_delete", action.id)
        return { ok: true, data: action }
      }
      case "UPSERT_SERVICE_SETTING": {
        const value = serviceSettingRecordSchema.parse(action.value)
        privateServiceSettingFormSchema.parse({
          is_incall_enabled: value.is_incall_enabled, supports_attire: value.supports_attire,
          display_category: value.display_category, description_en: value.description_override.en || "",
          description_zh: value.description_override.zh || "", description_th: value.description_override.th || "",
          sort_order: value.sort_order,
        })
        const { data: existing } = await db.from("private_service_settings").select("service_id").eq("service_id", value.service_id).maybeSingle()
        const payload = { ...value, updated_by: admin.id, updated_at: now, ...(!existing ? { created_by: admin.id } : {}) }
        const query = existing ? db.from("private_service_settings").update(payload).eq("service_id", value.service_id) : db.from("private_service_settings").insert(payload)
        const { data, error } = await query.select("*").single()
        if (error) throw new Error(error.message)
        await audit(admin.id, existing ? "private_service_setting_update" : "private_service_setting_create", String(value.service_id))
        return { ok: true, data: { type: "UPSERT_SERVICE_SETTING", value: data as PrivateServiceSetting } }
      }
      case "DELETE_SERVICE_SETTING": {
        z.number().int().positive().parse(action.serviceId)
        const { error } = await db.from("private_service_settings").delete().eq("service_id", action.serviceId)
        if (error) throw new Error(error.message)
        await audit(admin.id, "private_service_setting_delete", String(action.serviceId))
        return { ok: true, data: action }
      }
      case "UPSERT_PROVIDER_SERVICE": {
        const value = providerServiceRecordSchema.parse(action.value)
        const attireIds = action.attireBindings.map((item) => uuidSchema.parse(item.attire_id))
        privateProviderServiceFormSchema.parse({
          is_published: value.is_published, sort_order: value.sort_order,
          description_en: value.description_override.en || "", includes_en: (value.includes_override.en || []).join("\n"),
          attire_ids: attireIds,
        })
        const { data: relation, error: relationError } = await db.from("admin_girl_services").select("id,girl_id,service_id,is_qualified").eq("id", value.admin_girl_service_id).maybeSingle()
        if (relationError || !relation?.is_qualified) return { ok: false, error: "只能维护已审核合格的技师服务" }
        await assertIncallGirl(db, relation.girl_id)
        const { data: setting } = await db.from("private_service_settings").select("is_incall_enabled,supports_attire").eq("service_id", relation.service_id).maybeSingle()
        if (!setting?.is_incall_enabled) return { ok: false, error: "该服务尚未启用 Private Incall" }
        if (attireIds.length && !setting.supports_attire) return { ok: false, error: "该服务未开启制服支持" }
        const { data: existing } = await db.from("private_provider_services").select("admin_girl_service_id").eq("admin_girl_service_id", value.admin_girl_service_id).maybeSingle()
        const payload = { ...value, updated_by: admin.id, updated_at: now, ...(!existing ? { created_by: admin.id } : {}) }
        const query = existing ? db.from("private_provider_services").update(payload).eq("admin_girl_service_id", value.admin_girl_service_id) : db.from("private_provider_services").insert(payload)
        const { data, error } = await query.select("*").single()
        if (error) throw new Error(error.message)
        const { error: deleteBindingsError } = await db.from("private_provider_service_attires").delete().eq("admin_girl_service_id", value.admin_girl_service_id)
        if (deleteBindingsError) throw new Error(deleteBindingsError.message)
        let bindings: PrivateProviderServiceAttire[] = []
        if (attireIds.length) {
          const rows = attireIds.map((attireId, index) => ({
            admin_girl_service_id: value.admin_girl_service_id, attire_id: attireId,
            sort_order: (index + 1) * 10, is_active: true, created_by: admin.id, updated_by: admin.id,
          }))
          const { data: inserted, error: insertError } = await db.from("private_provider_service_attires").insert(rows).select("*")
          if (insertError) throw new Error(insertError.message)
          bindings = inserted as PrivateProviderServiceAttire[]
        }
        await audit(admin.id, existing ? "private_provider_service_update" : "private_provider_service_create", value.admin_girl_service_id, { attire_count: attireIds.length })
        return { ok: true, data: { type: "UPSERT_PROVIDER_SERVICE", value: { ...data, description_override: textMap(data.description_override), includes_override: listMap(data.includes_override) } as PrivateProviderService, attireBindings: bindings } }
      }
      case "DELETE_PROVIDER_SERVICE": {
        uuidSchema.parse(action.adminGirlServiceId)
        const { data: serviceRelation, error: serviceRelationError } = await db.from("admin_girl_services").select("girl_id").eq("id", action.adminGirlServiceId).maybeSingle()
        if (serviceRelationError) throw new Error(serviceRelationError.message)
        if (!serviceRelation) return { ok: false, error: "技师服务关系不存在" }
        await assertIncallGirl(db, serviceRelation.girl_id)
        const { error } = await db.from("private_provider_services").delete().eq("admin_girl_service_id", action.adminGirlServiceId)
        if (error) throw new Error(error.message)
        await audit(admin.id, "private_provider_service_delete", action.adminGirlServiceId)
        return { ok: true, data: action }
      }
      case "UPSERT_ATTIRE": {
        const value = attireRecordSchema.parse(action.value)
        privateAttireFormSchema.parse({
          code: value.code, name_en: value.name.en || "", name_zh: value.name.zh || "", name_th: value.name.th || "",
          note_en: value.note.en || "", image_url: value.image_url, sort_order: value.sort_order, is_active: value.is_active,
        })
        const { data: existing } = await db.from("private_attires").select("id").eq("id", value.id).maybeSingle()
        const payload = { ...value, updated_by: admin.id, updated_at: now, ...(!existing ? { created_by: admin.id } : {}) }
        const query = existing ? db.from("private_attires").update(payload).eq("id", value.id) : db.from("private_attires").insert(payload)
        const { data, error } = await query.select("*").single()
        if (error) throw new Error(error.message)
        await audit(admin.id, existing ? "private_attire_update" : "private_attire_create", value.id)
        return { ok: true, data: { type: "UPSERT_ATTIRE", value: data as PrivateAttire } }
      }
      case "DELETE_ATTIRE": {
        uuidSchema.parse(action.id)
        const { error } = await db.from("private_attires").delete().eq("id", action.id)
        if (error) throw new Error(error.message)
        await audit(admin.id, "private_attire_delete", action.id)
        return { ok: true, data: action }
      }
      case "UPSERT_LOCATION": {
        const location = locationRecordSchema.parse(action.location)
        const content = action.content ? locationContentRecordSchema.parse(action.content) : null
        privateLocationFormSchema.parse({
          name: location.name, address: location.address, lat: location.lat, lng: location.lng,
          place_id: location.place_id || "", city_id: location.city_id, photos: location.photos,
          floor: typeof location.meta.floor === "string" ? location.meta.floor : "",
          entrance_note: typeof location.meta.entrance_note === "string" ? location.meta.entrance_note : "",
          parking: typeof location.meta.parking === "string" ? location.meta.parking : "",
          is_active: location.is_active, public_name_en: content?.public_name.en || "",
          public_name_zh: content?.public_name.zh || "", public_name_th: content?.public_name.th || "",
          district_en: content?.district.en || "", district_zh: content?.district.zh || "", district_th: content?.district.th || "",
          is_published: content?.is_published || false,
        })
        const { data: existing } = await db.from("incall_locations").select("id").eq("id", location.id).maybeSingle()
        const locationPayload = {
          id: location.id, name: location.name, address: location.address, lat: location.lat, lng: location.lng,
          place_id: location.place_id, city_id: location.city_id, photos: location.photos, meta: location.meta,
          is_active: location.is_active, updated_at: now, ...(!existing ? { created_by: admin.id } : {}),
        }
        const locationQuery = existing ? db.from("incall_locations").update(locationPayload).eq("id", location.id) : db.from("incall_locations").insert(locationPayload)
        const { data: savedLocation, error: locationError } = await locationQuery.select("id,name,address,lat,lng,place_id,city_id,photos,meta,is_active,created_by,created_at,updated_at").single()
        if (locationError) throw new Error(locationError.message)
        let savedContent: PrivateLocationContent | null = null
        if (content) {
          const { data: existingContent } = await db.from("private_location_content").select("incall_location_id").eq("incall_location_id", location.id).maybeSingle()
          const contentPayload = { ...content, updated_by: admin.id, updated_at: now, ...(!existingContent ? { created_by: admin.id } : {}) }
          const contentQuery = existingContent ? db.from("private_location_content").update(contentPayload).eq("incall_location_id", location.id) : db.from("private_location_content").insert(contentPayload)
          const { data: row, error: contentError } = await contentQuery.select("*").single()
          if (contentError) throw new Error(contentError.message)
          savedContent = row as PrivateLocationContent
        } else {
          const { error: contentDeleteError } = await db.from("private_location_content").delete().eq("incall_location_id", location.id)
          if (contentDeleteError) throw new Error(contentDeleteError.message)
        }
        await audit(admin.id, existing ? "private_location_update" : "private_location_create", location.id)
        return { ok: true, data: { type: "UPSERT_LOCATION", location: { ...savedLocation, lat: Number(savedLocation.lat), lng: Number(savedLocation.lng), city_name: location.city_name } as PrivateIncallLocation, content: savedContent } }
      }
      case "DELETE_LOCATION": {
        uuidSchema.parse(action.id)
        const { count, error: referenceError } = await db.from("girls").select("id", { count: "exact", head: true }).eq("incall_location_id", action.id)
        if (referenceError) throw new Error(referenceError.message)
        if ((count || 0) > 0) return { ok: false, error: `该场所仍被 ${count} 名技师引用，请先在技师管理解除关联` }
        const { error } = await db.from("incall_locations").delete().eq("id", action.id)
        if (error) throw new Error(error.message)
        await audit(admin.id, "private_location_delete", action.id)
        return { ok: true, data: action }
      }
    }
  } catch (error) {
    console.error("[到店管理] 写入真实数据失败:", error)
    return { ok: false, error: firstIssue(error) }
  }
}
