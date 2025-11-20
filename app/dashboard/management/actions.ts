"use server"

import { getSupabaseServerClient, getSupabaseAdminClient } from "@/lib/supabase"
import type { AdminProfile, AdminRole } from "@/lib/types/admin"
import { requireAdmin } from "@/lib/auth"

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

/**
 * 管理员管理首屏初始化数据
 * 合并：当前管理员信息 + 管理员列表
 * ✅ 优化：使用 requireAdmin 减少重复查询
 */
export async function getAdminManagementInit(): Promise<{
  ok: boolean
  currentAdmin?: AdminProfile
  admins?: AdminProfile[]
  error?: string
}> {
  try {
    // ✅ 优化：使用 requireAdmin 一次性获取当前管理员（内部已做权限验证）
    const currentAdmin = await requireAdmin(['superadmin'])

    const adminClient = getSupabaseAdminClient()
    const { data, error } = await adminClient
      .from('admin_profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[getAdminManagementInit] 查询失败:', error)
      return { ok: false, error: '查询失败' }
    }

    return {
      ok: true,
      currentAdmin,
      admins: data || []
    }
  } catch (error) {
    console.error('[getAdminManagementInit] 异常:', error)
    return { ok: false, error: error instanceof Error ? error.message : '查询异常' }
  }
}

/**
 * 更新管理员显示名
 */
export async function updateAdminDisplayName(payload: {
  adminId: string
  displayName: string
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const actor = await requireAdmin(['superadmin'])

    const displayName = payload.displayName.trim()
    if (!displayName) {
      return { ok: false, error: '显示名不能为空' }
    }

    const supabase = getSupabaseAdminClient()
    const { error } = await (supabase as any)
      .from('admin_profiles')
      .update({
        display_name: displayName,
        updated_by: actor.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.adminId)

    if (error) {
      console.error('[updateAdminDisplayName] 更新失败:', error)
      return { ok: false, error: '更新显示名称失败' }
    }

    return { ok: true }
  } catch (error) {
    console.error('[updateAdminDisplayName] 操作异常:', error)
    return { ok: false, error: error instanceof Error ? error.message : '操作异常' }
  }
}

/**
 * 重置管理员密码
 */
export async function resetAdminPassword(payload: {
  adminId: string
  newPassword: string
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const actor = await requireAdmin(['superadmin'])

    const password = payload.newPassword.trim()
    if (!password) {
      return { ok: false, error: '新密码不能为空' }
    }

    const supabaseAdmin = getSupabaseAdminClient()
    const { error } = await supabaseAdmin.auth.admin.updateUserById(payload.adminId, {
      password,
    })

    if (error) {
      console.error('[resetAdminPassword] 重置失败:', error)
      return { ok: false, error: '重置密码失败' }
    }

    return { ok: true }
  } catch (error) {
    console.error('[resetAdminPassword] 操作异常:', error)
    return { ok: false, error: error instanceof Error ? error.message : '操作异常' }
  }
}

/**
 * 启用 / 禁用管理员账号
 */
export async function toggleAdminStatus(payload: {
  adminId: string
  currentStatus: boolean
}): Promise<{ ok: boolean; newStatus?: boolean; error?: string }> {
  try {
    const actor = await requireAdmin(['superadmin'])

    if (payload.adminId === actor.id && payload.currentStatus) {
      return { ok: false, error: '不能禁用自己的账号' }
    }

    const newStatus = !payload.currentStatus

    const supabase = getSupabaseAdminClient()
    const { error } = await (supabase as any)
      .from('admin_profiles')
      .update({
        is_active: newStatus,
        updated_by: actor.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.adminId)

    if (error) {
      console.error('[toggleAdminStatus] 更新失败:', error)
      return { ok: false, error: '更改状态失败' }
    }

    return { ok: true, newStatus }
  } catch (error) {
    console.error('[toggleAdminStatus] 操作异常:', error)
    return { ok: false, error: error instanceof Error ? error.message : '操作异常' }
  }
}

/**
 * 创建新的管理员账号
 */
export async function createAdminAccount(payload: {
  email: string
  password: string
  display_name: string
  role: AdminRole
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const actor = await requireAdmin(['superadmin'])

    const email = payload.email.trim()
    const password = payload.password.trim()
    const displayName = payload.display_name.trim()

    if (!email || !password || !displayName) {
      return { ok: false, error: '邮箱、密码和显示名不能为空' }
    }

    const supabaseAdmin = getSupabaseAdminClient()

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError || !authData?.user) {
      console.error('[createAdminAccount] 创建用户失败:', authError)
      return { ok: false, error: '创建用户失败' }
    }

    const userId = authData.user.id

    const { error: profileError } = await (supabaseAdmin as any)
      .from('admin_profiles')
      .insert({
        id: userId,
        display_name: displayName,
        role: payload.role,
        is_active: true,
        created_by: actor.id,
      })

    if (profileError) {
      console.error('[createAdminAccount] 创建管理员资料失败，回滚用户:', profileError)
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return { ok: false, error: '创建管理员资料失败' }
    }

    return { ok: true }
  } catch (error) {
    console.error('[createAdminAccount] 操作异常:', error)
    return { ok: false, error: error instanceof Error ? error.message : '操作异常' }
  }
}
