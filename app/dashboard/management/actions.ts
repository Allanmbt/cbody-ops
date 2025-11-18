"use server"

import { getSupabaseServerClient, getSupabaseAdminClient } from "@/lib/supabase"
import type { AdminProfile } from "@/lib/types/admin"

/**
 * 验证当前用户是否为超级管理员
 */
export async function verifySuperAdmin(): Promise<{
  ok: boolean
  admin?: AdminProfile
  error?: string
}> {
  try {
    const supabase = await getSupabaseServerClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return { ok: false, error: "未登录" }
    }

    // 使用 admin 客户端查询
    const adminClient = getSupabaseAdminClient()
    const { data: adminData, error: adminError } = await adminClient
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

    if (admin.role !== 'superadmin') {
      return { ok: false, error: "需要超级管理员权限" }
    }

    return { ok: true, admin }
  } catch (error) {
    console.error('[verifySuperAdmin] 异常:', error)
    return { ok: false, error: "验证失败" }
  }
}

/**
 * 获取所有管理员列表
 */
export async function getAdminsList(): Promise<{
  ok: boolean
  data?: AdminProfile[]
  error?: string
}> {
  try {
    // 先验证权限
    const verification = await verifySuperAdmin()
    if (!verification.ok) {
      return { ok: false, error: verification.error }
    }

    const adminClient = getSupabaseAdminClient()
    const { data, error } = await adminClient
      .from('admin_profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return { ok: false, error: "查询失败" }
    }

    return { ok: true, data: data || [] }
  } catch (error) {
    console.error('[getAdminsList] 异常:', error)
    return { ok: false, error: "查询异常" }
  }
}
