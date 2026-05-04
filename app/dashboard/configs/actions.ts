"use server"

import { getSupabaseAdminClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { logAuditAction } from "@/lib/audit"
import { fareParamsSchema, bankAccountsConfigSchema, quickRepliesConfigSchema } from "@/lib/features/configs"
import type { AppConfig, FareParamsConfig, BankAccountsConfig, QuickRepliesConfig } from "@/lib/features/configs"

// 通用返回类型
type ActionResult<T = any> = {
  ok: boolean
  data?: T
  error?: string
}

const QUICK_REPLIES_DEFAULT_CONFIG: QuickRepliesConfig = {
  categories: [],
  items: [],
}

function normalizeQuickRepliesConfig(config: QuickRepliesConfig): QuickRepliesConfig {
  const categories = [...config.categories]
    .map((category) => ({
      ...category,
      code: category.code.trim(),
      label: {
        en: category.label.en,
        zh: category.label.zh,
        th: category.label.th,
      },
    }))
    .sort((a, b) => a.sort_order - b.sort_order || a.code.localeCompare(b.code))

  const categoryOrderMap = new Map(categories.map((category, index) => [category.code, index]))

  const items = [...config.items]
    .map((item) => ({
      ...item,
      id: item.id.trim(),
      category_code: item.category_code.trim(),
      text: {
        en: item.text.en,
        zh: item.text.zh,
        th: item.text.th,
      },
    }))
    .sort((a, b) => {
      const categoryCompare =
        (categoryOrderMap.get(a.category_code) ?? Number.MAX_SAFE_INTEGER) -
        (categoryOrderMap.get(b.category_code) ?? Number.MAX_SAFE_INTEGER)
      if (categoryCompare !== 0) return categoryCompare

      if (a.rank_weight !== b.rank_weight) return b.rank_weight - a.rank_weight
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order

      return a.id.localeCompare(b.id)
    })

  return { categories, items }
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

/**
 * 获取银行卡配置
 */
export async function getBankAccountsConfig(): Promise<ActionResult<AppConfig>> {
  try {
    await requireAdmin(['superadmin', 'admin'])
    const supabase = getSupabaseAdminClient()

    const { data, error } = await supabase
      .from("app_configs")
      .select("*")
      .eq("namespace", "settlement")
      .eq("config_key", "bank_accounts")
      .eq("scope", "global")
      .eq("is_active", true)
      .single()

    if (error) {
      console.error("[Configs] 获取银行卡配置失败:", error)
      return { ok: false, error: "获取配置失败" }
    }

    if (!data) {
      return { ok: false, error: "配置不存在" }
    }

    return { ok: true, data }
  } catch (error) {
    console.error("[Configs] 获取银行卡配置异常:", error)
    return { ok: false, error: "系统错误" }
  }
}

/**
 * 更新银行卡配置（仅更新 is_active 状态）
 */
export async function updateBankAccountsConfig(
  configId: string,
  bankAccountsConfig: BankAccountsConfig
): Promise<ActionResult> {
  try {
    await requireAdmin(['superadmin', 'admin'])
    const supabase = getSupabaseAdminClient()

    // 验证数据
    const validation = bankAccountsConfigSchema.safeParse(bankAccountsConfig)
    if (!validation.success) {
      const errors = validation.error.issues.map((e: any) => e.message).join(", ")
      return { ok: false, error: `数据验证失败: ${errors}` }
    }

    // 更新配置
    const { error: updateError } = await (supabase as any)
      .from("app_configs")
      .update({
        value_json: bankAccountsConfig,
        updated_at: new Date().toISOString(),
      })
      .eq("id", configId)

    if (updateError) {
      console.error("[Configs] 更新银行卡配置失败:", updateError)
      return { ok: false, error: "更新配置失败" }
    }

    revalidatePath("/dashboard/configs")
    revalidatePath("/dashboard/configs/bank-accounts")

    return { ok: true }
  } catch (error) {
    console.error("[Configs] 更新银行卡配置异常:", error)
    return { ok: false, error: "系统错误" }
  }
}

/**
 * 获取快捷回复配置
 */
export async function getQuickRepliesConfig(): Promise<ActionResult<AppConfig>> {
  try {
    await requireAdmin(['superadmin', 'admin'])
    const supabase = getSupabaseAdminClient()

    const { data, error } = await supabase
      .from("app_configs")
      .select("*")
      .eq("namespace", "chat")
      .eq("config_key", "quick_replies")
      .eq("scope", "global")
      .is("scope_id", null)
      .is("locale", null)
      .eq("dtype", "json")
      .eq("is_active", true)
      .single()

    if (data) {
      return { ok: true, data }
    }

    if (error && error.code !== "PGRST116") {
      console.error("[Configs] 获取快捷回复配置失败:", error)
      return { ok: false, error: "获取快捷回复配置失败" }
    }

    const { data: created, error: createError } = await (supabase as any)
      .from("app_configs")
      .insert({
        namespace: "chat",
        config_key: "quick_replies",
        scope: "global",
        scope_id: null,
        locale: null,
        dtype: "json",
        value_json: QUICK_REPLIES_DEFAULT_CONFIG,
        is_active: true,
      })
      .select("*")
      .single()

    if (createError || !created) {
      console.error("[Configs] 创建快捷回复配置失败:", createError)
      return { ok: false, error: "创建快捷回复配置失败" }
    }

    return { ok: true, data: created }
  } catch (error) {
    console.error("[Configs] 获取快捷回复配置异常:", error)
    return { ok: false, error: "系统错误" }
  }
}

/**
 * 更新快捷回复配置
 */
export async function updateQuickRepliesConfig(
  configId: string,
  quickRepliesConfig: QuickRepliesConfig
): Promise<ActionResult> {
  try {
    const admin = await requireAdmin(['superadmin', 'admin'])
    const supabase = getSupabaseAdminClient()

    const validation = quickRepliesConfigSchema.safeParse(quickRepliesConfig)
    if (!validation.success) {
      const errors = validation.error.issues.map((issue) => issue.message).join(", ")
      return { ok: false, error: `数据验证失败: ${errors}` }
    }

    const normalizedConfig = normalizeQuickRepliesConfig(validation.data)

    const { error: updateError } = await (supabase as any)
      .from("app_configs")
      .update({
        value_json: normalizedConfig,
        updated_at: new Date().toISOString(),
      })
      .eq("id", configId)

    if (updateError) {
      console.error("[Configs] 更新快捷回复配置失败:", updateError)
      return { ok: false, error: "更新快捷回复配置失败" }
    }

    await logAuditAction({
      actor_id: admin.id,
      action: "update_quick_replies_config",
      target: `app_configs:${configId}`,
      payload: {
        namespace: "chat",
        config_key: "quick_replies",
        category_count: normalizedConfig.categories.length,
        item_count: normalizedConfig.items.length,
      },
    })

    revalidatePath("/dashboard/configs")
    revalidatePath("/dashboard/configs/quick-replies")

    return { ok: true }
  } catch (error) {
    console.error("[Configs] 更新快捷回复配置异常:", error)
    return { ok: false, error: "系统错误" }
  }
}
