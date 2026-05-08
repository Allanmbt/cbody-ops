"use server"

import { getSupabaseAdminClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { logAuditAction } from "@/lib/audit"
import { fareParamsSchema, bankAccountsConfigSchema, quickRepliesConfigSchema } from "@/lib/features/configs"
import type { AppConfig, FareParamsConfig, BankAccount, BankAccountsConfig, QuickRepliesConfig } from "@/lib/features/configs"
import { THAILAND_BANKS } from "@/types/banks"

// 通用返回类型
type ActionResult<T = any> = {
  ok: boolean
  data?: T
  error?: string
  warning?: string
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
const BANK_QR_BUCKET = "upload"

function getBankByCode(code: string) {
  return THAILAND_BANKS.find((bank) => bank.code === code)
}

function normalizeBankAccountsConfig(config: BankAccountsConfig): BankAccountsConfig {
  return {
    accounts: [...(config.accounts || [])]
      .map((account) => {
        const bank = getBankByCode(account.code)
        return {
          ...account,
          code: account.code.trim(),
          bank_name: bank?.name ?? account.bank_name.trim(),
          account_holder: account.account_holder.trim(),
          account_number: account.account_number.trim(),
        }
      })
      .sort((a, b) => a.sort_order - b.sort_order || a.code.localeCompare(b.code)),
  }
}

function slugifyBankQrPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "bank"
}

function getAccountLast4(accountNumber: string): string {
  const compact = accountNumber.replace(/[^a-zA-Z0-9]/g, "")
  return compact.slice(-4) || "0000"
}

function getRequiredFormString(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

function parsePositiveInt(value: FormDataEntryValue | null, fallback: number): number {
  if (typeof value !== "string" || value.trim() === "") return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function getOptionalImageFile(formData: FormData): File | null {
  const file = formData.get("qr_code_file")
  if (!(file instanceof File) || file.size <= 0) return null
  return file
}

function extractUploadObjectPath(url: string): string | null {
  try {
    const parsed = new URL(url)
    const marker = `/object/public/${BANK_QR_BUCKET}/`
    const markerIndex = parsed.pathname.indexOf(marker)
    if (markerIndex === -1) return null

    const objectPath = decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length))
    return objectPath && !objectPath.includes("..") ? objectPath : null
  } catch {
    return null
  }
}

async function deleteUploadObjectByUrl(url: string): Promise<string | null> {
  const path = extractUploadObjectPath(url)
  if (!path) return "二维码地址不是 upload 存储桶公开 URL，未删除文件"

  const supabase = getSupabaseAdminClient()
  const { error } = await supabase.storage.from(BANK_QR_BUCKET).remove([path])
  if (error) {
    console.error("[Configs] 删除银行卡二维码失败:", error)
    return "配置已更新，但旧二维码文件删除失败，请在 Supabase Storage 中手动检查"
  }

  return null
}

async function uploadBankQrCode(
  file: File,
  bankName: string,
  accountHolder: string,
  accountNumber: string
): Promise<ActionResult<string>> {
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "请上传图片文件" }
  }

  const filename = [
    slugifyBankQrPart(bankName),
    slugifyBankQrPart(accountHolder),
    getAccountLast4(accountNumber),
    Date.now().toString(),
  ].join("-") + ".jpg"

  const supabase = getSupabaseAdminClient()
  const { error } = await supabase.storage
    .from(BANK_QR_BUCKET)
    .upload(filename, file, {
      contentType: "image/jpeg",
      upsert: false,
    })

  if (error) {
    console.error("[Configs] 上传银行卡二维码失败:", error)
    return { ok: false, error: "二维码上传失败" }
  }

  const { data } = supabase.storage.from(BANK_QR_BUCKET).getPublicUrl(filename)
  return { ok: true, data: data.publicUrl }
}

async function fetchBankAccountsConfigById(configId: string): Promise<ActionResult<AppConfig>> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("app_configs")
    .select("*")
    .eq("id", configId)
    .eq("namespace", "settlement")
    .eq("config_key", "bank_accounts")
    .eq("is_active", true)
    .single()

  if (error || !data) {
    console.error("[Configs] 获取银行卡配置失败:", error)
    return { ok: false, error: "银行卡配置不存在" }
  }

  return { ok: true, data }
}

async function saveBankAccountsConfig(
  configId: string,
  config: BankAccountsConfig
): Promise<ActionResult<BankAccountsConfig>> {
  const normalized = normalizeBankAccountsConfig(config)
  const validation = bankAccountsConfigSchema.safeParse(normalized)
  if (!validation.success) {
    const errors = validation.error.issues.map((issue) => issue.message).join(", ")
    return { ok: false, error: `数据验证失败: ${errors}` }
  }

  const supabase = getSupabaseAdminClient()
  const { error } = await (supabase as any)
    .from("app_configs")
    .update({
      value_json: normalized,
      updated_at: new Date().toISOString(),
    })
    .eq("id", configId)

  if (error) {
    console.error("[Configs] 保存银行卡配置失败:", error)
    return { ok: false, error: "保存银行卡配置失败" }
  }

  revalidatePath("/dashboard/configs")
  revalidatePath("/dashboard/configs/bank-accounts")

  return { ok: true, data: normalized }
}

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
): Promise<ActionResult<BankAccountsConfig>> {
  try {
    const admin = await requireAdmin(['superadmin', 'admin'])
    const result = await saveBankAccountsConfig(configId, bankAccountsConfig)
    if (!result.ok) return result

    await logAuditAction({
      actor_id: admin.id,
      action: "update_bank_accounts_config",
      target: `app_configs:${configId}`,
      payload: {
        account_count: result.data?.accounts.length ?? 0,
      },
    })

    return result
  } catch (error) {
    console.error("[Configs] 更新银行卡配置异常:", error)
    return { ok: false, error: "系统错误" }
  }
}

export async function createBankAccount(
  configId: string,
  formData: FormData
): Promise<ActionResult<BankAccountsConfig>> {
  let uploadedQrUrl: string | null = null

  try {
    const admin = await requireAdmin(['superadmin', 'admin'])
    const currentResult = await fetchBankAccountsConfigById(configId)
    if (!currentResult.ok || !currentResult.data) return { ok: false, error: currentResult.error }

    const currentConfig = (currentResult.data.value_json || { accounts: [] }) as BankAccountsConfig
    const accounts = normalizeBankAccountsConfig(currentConfig).accounts
    const code = getRequiredFormString(formData, "code")
    const bank = getBankByCode(code)
    if (!bank) return { ok: false, error: "请选择有效的银行" }

    const accountHolder = getRequiredFormString(formData, "account_holder")
    const accountNumber = getRequiredFormString(formData, "account_number")
    if (!accountHolder) return { ok: false, error: "账户持有人不能为空" }
    if (!accountNumber) return { ok: false, error: "账号不能为空" }

    const file = getOptionalImageFile(formData)
    if (!file) return { ok: false, error: "请上传收款二维码" }

    const uploadResult = await uploadBankQrCode(file, bank.name, accountHolder, accountNumber)
    if (!uploadResult.ok || !uploadResult.data) return { ok: false, error: uploadResult.error }
    uploadedQrUrl = uploadResult.data

    const nextSortOrder = accounts.reduce((max, account) => Math.max(max, account.sort_order), 0) + 1
    const newAccount: BankAccount = {
      id: `bank_${globalThis.crypto.randomUUID()}`,
      code: bank.code,
      bank_name: bank.name,
      account_holder: accountHolder,
      account_number: accountNumber,
      qr_code_url: uploadedQrUrl,
      is_active: formData.get("is_active") === "true",
      sort_order: nextSortOrder,
    }

    const saveResult = await saveBankAccountsConfig(configId, { accounts: [...accounts, newAccount] })
    if (!saveResult.ok) {
      await deleteUploadObjectByUrl(uploadedQrUrl)
      return saveResult
    }

    await logAuditAction({
      actor_id: admin.id,
      action: "create_bank_account",
      target: `app_configs:${configId}`,
      payload: { account_id: newAccount.id, code: newAccount.code },
    })

    return saveResult
  } catch (error) {
    if (uploadedQrUrl) await deleteUploadObjectByUrl(uploadedQrUrl)
    console.error("[Configs] 新增银行卡异常:", error)
    return { ok: false, error: "新增银行卡失败" }
  }
}

export async function updateBankAccount(
  configId: string,
  accountId: string,
  formData: FormData
): Promise<ActionResult<BankAccountsConfig>> {
  let uploadedQrUrl: string | null = null

  try {
    const admin = await requireAdmin(['superadmin', 'admin'])
    const currentResult = await fetchBankAccountsConfigById(configId)
    if (!currentResult.ok || !currentResult.data) return { ok: false, error: currentResult.error }

    const currentConfig = (currentResult.data.value_json || { accounts: [] }) as BankAccountsConfig
    const accounts = normalizeBankAccountsConfig(currentConfig).accounts
    const existing = accounts.find((account) => account.id === accountId)
    if (!existing) return { ok: false, error: "银行卡不存在" }

    const code = getRequiredFormString(formData, "code")
    const bank = getBankByCode(code)
    if (!bank) return { ok: false, error: "请选择有效的银行" }

    const accountHolder = getRequiredFormString(formData, "account_holder")
    const accountNumber = getRequiredFormString(formData, "account_number")
    if (!accountHolder) return { ok: false, error: "账户持有人不能为空" }
    if (!accountNumber) return { ok: false, error: "账号不能为空" }

    const file = getOptionalImageFile(formData)
    if (file) {
      const uploadResult = await uploadBankQrCode(file, bank.name, accountHolder, accountNumber)
      if (!uploadResult.ok || !uploadResult.data) return { ok: false, error: uploadResult.error }
      uploadedQrUrl = uploadResult.data
    }

    const updatedAccount: BankAccount = {
      ...existing,
      code: bank.code,
      bank_name: bank.name,
      account_holder: accountHolder,
      account_number: accountNumber,
      qr_code_url: uploadedQrUrl ?? existing.qr_code_url,
      is_active: formData.get("is_active") === "true",
      sort_order: parsePositiveInt(formData.get("sort_order"), existing.sort_order),
    }

    const saveResult = await saveBankAccountsConfig(configId, {
      accounts: accounts.map((account) => account.id === accountId ? updatedAccount : account),
    })

    if (!saveResult.ok) {
      if (uploadedQrUrl) await deleteUploadObjectByUrl(uploadedQrUrl)
      return saveResult
    }

    let warning: string | null = null
    if (uploadedQrUrl && existing.qr_code_url !== uploadedQrUrl) {
      warning = await deleteUploadObjectByUrl(existing.qr_code_url)
    }

    await logAuditAction({
      actor_id: admin.id,
      action: "update_bank_account",
      target: `app_configs:${configId}`,
      payload: { account_id: accountId, code: updatedAccount.code, replaced_qr: Boolean(uploadedQrUrl) },
    })

    return { ...saveResult, warning: warning ?? undefined }
  } catch (error) {
    if (uploadedQrUrl) await deleteUploadObjectByUrl(uploadedQrUrl)
    console.error("[Configs] 编辑银行卡异常:", error)
    return { ok: false, error: "编辑银行卡失败" }
  }
}

export async function deleteBankAccount(
  configId: string,
  accountId: string
): Promise<ActionResult<BankAccountsConfig>> {
  try {
    const admin = await requireAdmin(['superadmin', 'admin'])
    const currentResult = await fetchBankAccountsConfigById(configId)
    if (!currentResult.ok || !currentResult.data) return { ok: false, error: currentResult.error }

    const currentConfig = (currentResult.data.value_json || { accounts: [] }) as BankAccountsConfig
    const accounts = normalizeBankAccountsConfig(currentConfig).accounts
    const account = accounts.find((item) => item.id === accountId)
    if (!account) return { ok: false, error: "银行卡不存在" }

    const saveResult = await saveBankAccountsConfig(configId, {
      accounts: accounts.filter((item) => item.id !== accountId),
    })
    if (!saveResult.ok) return saveResult

    const warning = await deleteUploadObjectByUrl(account.qr_code_url)

    await logAuditAction({
      actor_id: admin.id,
      action: "delete_bank_account",
      target: `app_configs:${configId}`,
      payload: { account_id: accountId, code: account.code },
    })

    return { ...saveResult, warning: warning ?? undefined }
  } catch (error) {
    console.error("[Configs] 删除银行卡异常:", error)
    return { ok: false, error: "删除银行卡失败" }
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
