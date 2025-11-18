"use server"

import { getSupabaseServerClient } from "@/lib/supabase"
import type { AdminProfile } from "@/lib/types/admin"

/**
 * Server Action: 获取当前登录管理员信息
 * 由客户端组件调用，在服务端执行
 */
export async function getCurrentAdminAction(): Promise<{
  ok: boolean
  admin?: AdminProfile
  error?: string
}> {
  try {
    const supabase = await getSupabaseServerClient()

    // 获取当前用户
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return { ok: false, error: "未登录" }
    }

    // 查询管理员信息
    const { data: adminData, error: adminError } = await supabase
      .from('admin_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (adminError || !adminData) {
      return { ok: false, error: "无管理员权限" }
    }

    const admin = adminData as AdminProfile

    if (!admin.is_active) {
      return { ok: false, error: "账号已禁用" }
    }

    return { ok: true, admin }
  } catch (error) {
    console.error('[getCurrentAdminAction] 异常:', error)
    return { ok: false, error: "获取管理员信息失败" }
  }
}
