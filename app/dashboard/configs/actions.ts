"use server"

import { getSupabaseAdminClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { fareParamsSchema } from "@/lib/features/configs"
import type { AppConfig, FareParamsConfig } from "@/lib/features/configs"

// 通用返回类型
type ActionResult<T = any> = {
  ok: boolean
  data?: T
  error?: string
}

/**
 * 获取车费计价配置
 */
export async function getFareConfig(): Promise<ActionResult<AppConfig>> {
  try {
    // 验证管理员权限（只有管理员和超级管理员可以查看配置）
    await requireAdmin(['superadmin', 'admin'])
    const supabase = getSupabaseAdminClient()

    // 查询车费计价配置
    const { data, error } = await supabase
      .from("app_configs")
      .select("*")
      .eq("namespace", "fare")
      .eq("config_key", "params.v1")
      .eq("scope", "app")
      .eq("scope_id", "cbody")
      .eq("is_active", true)
      .single()

    if (error) {
      console.error("获取车费配置失败:", error)
      return { ok: false, error: "获取配置失败" }
    }

    if (!data) {
      return { ok: false, error: "配置不存在" }
    }

    return { ok: true, data }
  } catch (error) {
    console.error("获取车费配置异常:", error)
    return { ok: false, error: "系统错误" }
  }
}

/**
 * 更新车费计价配置
 */
export async function updateFareConfig(
  configId: string,
  fareParams: FareParamsConfig
): Promise<ActionResult> {
  try {
    // 验证管理员权限（只有管理员和超级管理员可以更新配置）
    await requireAdmin(['superadmin', 'admin'])
    const supabase = getSupabaseAdminClient()

    // 验证数据
    const validation = fareParamsSchema.safeParse(fareParams)
    if (!validation.success) {
      const errors = validation.error.issues.map((e: any) => e.message).join(", ")
      return { ok: false, error: `数据验证失败: ${errors}` }
    }

    // 更新配置
    const { error: updateError } = await (supabase as any)
      .from("app_configs")
      .update({
        value_json: fareParams,
        updated_at: new Date().toISOString(),
      })
      .eq("id", configId)

    if (updateError) {
      console.error("更新车费配置失败:", updateError)
      return { ok: false, error: "更新配置失败" }
    }

    revalidatePath("/dashboard/configs")
    revalidatePath("/dashboard/configs/fare")

    return { ok: true }
  } catch (error) {
    console.error("更新车费配置异常:", error)
    return { ok: false, error: "系统错误" }
  }
}

/**
 * 获取所有配置列表（用于配置管理主页）
 */
export async function getConfigsList(): Promise<ActionResult<AppConfig[]>> {
  try {
    // 验证管理员权限（只有管理员和超级管理员可以查看配置列表）
    await requireAdmin(['superadmin', 'admin'])
    const supabase = getSupabaseAdminClient()

    // 查询所有活跃配置
    const { data, error } = await supabase
      .from("app_configs")
      .select("*")
      .eq("is_active", true)
      .order("namespace")
      .order("config_key")

    if (error) {
      console.error("获取配置列表失败:", error)
      return { ok: false, error: "获取配置列表失败" }
    }

    return { ok: true, data: data || [] }
  } catch (error) {
    console.error("获取配置列表异常:", error)
    return { ok: false, error: "系统错误" }
  }
}
