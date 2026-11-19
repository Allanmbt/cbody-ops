"use server"

import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { logAuditAction } from "@/lib/audit"
import { requireAdmin } from "@/lib/auth"
import { iosIncallConfigSchema } from "@/lib/features/configs"
import { IOS_INCALL_CONFIG } from "@/lib/features/configs/visit"
import { getSupabaseAdminClient } from "@/lib/supabase"

export async function saveIOSIncallConfig(enabled: boolean) {
  try {
    const admin = await requireAdmin(["superadmin", "admin"])
    const parsed = iosIncallConfigSchema.safeParse({ enabled })
    if (!parsed.success) {
      return { ok: false, error: "开关状态无效" }
    }

    const supabase = getSupabaseAdminClient() as SupabaseClient
    const { locale, ...identity } = IOS_INCALL_CONFIG
    const values = {
      value_json: parsed.data,
      updated_by: admin.id,
      updated_at: new Date().toISOString(),
    }

    let result = await supabase
      .from("app_configs")
      .update(values)
      .match(identity)
      .is("locale", locale)
      .select("id")
      .maybeSingle()

    if (!result.error && !result.data) {
      result = await supabase
        .from("app_configs")
        .insert({ ...IOS_INCALL_CONFIG, ...values, description: "iOS 客户端 Visit / Incall 展示开关" })
        .select("id")
        .single()
    }

    const { data, error } = result
    if (error || !data) {
      if (error?.code === "23505") {
        return { ok: false, error: "配置已被其他管理员新增，请刷新后重试" }
      }
      console.error("保存 iOS Visit 配置失败:", error)
      return { ok: false, error: "保存 iOS Visit 配置失败" }
    }

    await logAuditAction({
      actor_id: admin.id,
      action: "update_ios_incall_config",
      target: `app_configs:${data.id}`,
      payload: parsed.data,
    })

    revalidatePath("/dashboard/configs")
    return { ok: true }
  } catch (error) {
    console.error("保存 iOS Visit 配置异常:", error)
    return { ok: false, error: "保存 iOS Visit 配置失败" }
  }
}
