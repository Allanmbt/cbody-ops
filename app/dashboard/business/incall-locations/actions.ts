"use server"

import { getSupabaseAdminClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/auth"
import { incallLocationListParamsSchema, createIncallLocationSchema } from "@/lib/features/incall-locations"
import type {
  ApiResponse,
  PaginatedResponse,
  IncallLocation,
  IncallLocationListParams,
  CreateIncallLocationData,
} from "@/lib/features/incall-locations"

export async function getIncallLocations(
  params: IncallLocationListParams
): Promise<ApiResponse<PaginatedResponse<IncallLocation>>> {
  try {
    await requireAdmin(["superadmin", "admin"])
    const { page, limit, search, city_id, is_active } =
      incallLocationListParamsSchema.parse(params)

    const supabase = getSupabaseAdminClient()
    let query = supabase
      .from("incall_locations")
      .select(
        `*, city:cities(id, code, name)`,
        { count: "exact" }
      )

    if (search) {
      query = query.or(
        `name.ilike.%${search}%,address.ilike.%${search}%`
      )
    }
    if (city_id) {
      query = query.eq("city_id", city_id)
    }
    if (typeof is_active === "boolean") {
      query = query.eq("is_active", is_active)
    }

    query = query.order("created_at", { ascending: false })

    const from = (page - 1) * limit
    query = query.range(from, from + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error("[到店地址] 查询失败:", error)
      return { ok: false, error: "获取地址列表失败" }
    }

    return {
      ok: true,
      data: {
        data: (data || []) as IncallLocation[],
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    }
  } catch (error) {
    console.error("[到店地址] 查询异常:", error)
    return { ok: false, error: "获取地址列表异常" }
  }
}

export async function getCities(): Promise<
  ApiResponse<{ id: number; code: string; name: { en: string; zh: string; th: string } }[]>
> {
  try {
    await requireAdmin(["superadmin", "admin"])
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("cities")
      .select("id, code, name")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })

    if (error) {
      return { ok: false, error: "获取城市列表失败" }
    }
    return { ok: true, data: data || [] }
  } catch (error) {
    console.error("[城市] 查询异常:", error)
    return { ok: false, error: "获取城市列表异常" }
  }
}

export async function toggleIncallLocationStatus(
  id: string
): Promise<ApiResponse<IncallLocation>> {
  try {
    await requireAdmin(["superadmin", "admin"])
    const supabase = getSupabaseAdminClient()

    const { data: current, error: fetchErr } = await supabase
      .from("incall_locations")
      .select("is_active")
      .eq("id", id)
      .single()

    if (fetchErr || !current) {
      return { ok: false, error: "地址不存在" }
    }

    const db = supabase as any
    const { data, error } = await db
      .from("incall_locations")
      .update({ is_active: !(current as any).is_active, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select(`*, city:cities(id, code, name)`)
      .single()

    if (error) {
      console.error("[到店地址] 切换状态失败:", error)
      return { ok: false, error: "切换状态失败" }
    }

    return { ok: true, data: data as IncallLocation }
  } catch (error) {
    console.error("[到店地址] 切换状态异常:", error)
    return { ok: false, error: "切换状态异常" }
  }
}

export async function createIncallLocation(
  payload: CreateIncallLocationData
): Promise<ApiResponse<IncallLocation>> {
  try {
    const admin = await requireAdmin(["superadmin", "admin"])
    const validated = createIncallLocationSchema.parse(payload)
    const supabase = getSupabaseAdminClient()
    const db = supabase as any

    const { data, error } = await db
      .from("incall_locations")
      .insert({
        name: validated.name,
        address: validated.address,
        lat: validated.lat,
        lng: validated.lng,
        place_id: validated.place_id ?? null,
        city_id: validated.city_id ?? null,
        photos: validated.photos,
        meta: validated.meta ?? {},
        is_active: true,
        created_by: admin.id,
      })
      .select(`*, city:cities(id, code, name)`)
      .single()

    if (error) {
      console.error("[到店地址] 创建失败:", error)
      return { ok: false, error: "创建地址失败" }
    }

    return { ok: true, data: data as IncallLocation }
  } catch (error) {
    console.error("[到店地址] 创建异常:", error)
    return { ok: false, error: error instanceof Error ? error.message : "创建异常" }
  }
}

export async function updateIncallLocation(
  id: string,
  payload: CreateIncallLocationData
): Promise<ApiResponse<IncallLocation>> {
  try {
    await requireAdmin(["superadmin", "admin"])
    const validated = createIncallLocationSchema.parse(payload)
    const db = getSupabaseAdminClient() as any

    const { data, error } = await db
      .from("incall_locations")
      .update({
        name: validated.name,
        address: validated.address,
        lat: validated.lat,
        lng: validated.lng,
        place_id: validated.place_id ?? null,
        city_id: validated.city_id ?? null,
        photos: validated.photos,
        meta: validated.meta ?? {},
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(`*, city:cities(id, code, name)`)
      .single()

    if (error) {
      console.error("[到店地址] 更新失败:", error)
      return { ok: false, error: "更新地址失败" }
    }
    return { ok: true, data: data as IncallLocation }
  } catch (error) {
    console.error("[到店地址] 更新异常:", error)
    return { ok: false, error: error instanceof Error ? error.message : "更新异常" }
  }
}

export async function deleteIncallLocation(
  id: string
): Promise<ApiResponse<void>> {
  try {
    await requireAdmin(["superadmin", "admin"])
    const supabase = getSupabaseAdminClient()
    const db = supabase as any

    // 先取出 photos 路径，用于删除存储桶文件
    const { data: loc, error: fetchErr } = await db
      .from("incall_locations")
      .select("photos")
      .eq("id", id)
      .single()

    if (fetchErr || !loc) return { ok: false, error: "地址不存在" }

    // 删除存储桶中的图片
    const photos: string[] = (loc as any).photos || []
    if (photos.length > 0) {
      const paths = photos.map((url: string) => {
        const match = url.match(/incall-locations\/[^?]+/)
        return match ? match[0] : null
      }).filter(Boolean) as string[]

      if (paths.length > 0) {
        await supabase.storage.from("upload").remove(paths)
      }
    }

    const { error } = await db.from("incall_locations").delete().eq("id", id)
    if (error) {
      console.error("[到店地址] 删除失败:", error)
      return { ok: false, error: "删除地址失败" }
    }
    return { ok: true }
  } catch (error) {
    console.error("[到店地址] 删除异常:", error)
    return { ok: false, error: "删除异常" }
  }
}

export async function uploadIncallPhoto(
  formData: FormData
): Promise<ApiResponse<string>> {
  try {
    await requireAdmin(["superadmin", "admin"])
    const file = formData.get("file") as File | null
    if (!file) return { ok: false, error: "未收到文件" }

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg"
    const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const path = `incall-locations/${filename}`

    const supabase = getSupabaseAdminClient()
    const { error } = await supabase.storage
      .from("upload")
      .upload(path, file, { contentType: file.type, upsert: false })

    if (error) {
      console.error("[到店地址] 图片上传失败:", error)
      return { ok: false, error: "图片上传失败" }
    }

    const { data: urlData } = supabase.storage.from("upload").getPublicUrl(path)
    return { ok: true, data: urlData.publicUrl }
  } catch (error) {
    console.error("[到店地址] 图片上传异常:", error)
    return { ok: false, error: "图片上传异常" }
  }
}
