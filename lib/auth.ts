import { getSupabaseClient, getSupabaseServerClient, getSupabaseAdminClient } from "./supabase"
import type { AdminProfile, AdminRole } from "./types/admin"

export const AUTH_COOKIE_KEY = "cbody-ops-auth-token" as const

type AuthCookieKey = typeof AUTH_COOKIE_KEY

export function getAuthCookieKey(): AuthCookieKey {
  return AUTH_COOKIE_KEY
}

// Server-side auth check (to be used in server components/actions)
export async function hasAuthSession(): Promise<boolean> {
  if (typeof window !== 'undefined') {
    // Client-side: check localStorage or other client storage
    return false
  }

  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    return Boolean(cookieStore.get(getAuthCookieKey())?.value)
  } catch {
    return false
  }
}

export async function getCurrentUser() {
  const supabase = getSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  return { user, error }
}

export async function getCurrentUserFromServerAction() {
  // 在 Server Action 中使用，通过 cookies 获取用户 session
  const supabase = await getSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  return { user, error }
}

export async function getAdminProfile(userId: string): Promise<AdminProfile | null> {
  const supabase = getSupabaseAdminClient()

  const { data, error } = await supabase
    .from('admin_profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    console.error('[getAdminProfile] 查询失败:', error)
    return null
  }

  const profile = data as AdminProfile

  if (!profile.is_active) {
    return null
  }

  return profile
}

export async function getCurrentAdminProfile(): Promise<AdminProfile | null> {
  const { user, error } = await getCurrentUser()

  if (error || !user) {
    return null
  }

  return getAdminProfile(user.id)
}

export async function getCurrentAdmin(): Promise<AdminProfile | null> {
  return getCurrentAdminProfile()
}

export async function getCurrentAdminFromServerAction(): Promise<AdminProfile | null> {
  const { user, error } = await getCurrentUserFromServerAction()

  if (error || !user) {
    return null
  }

  return getAdminProfile(user.id)
}

export function hasRole(userRole: AdminRole, requiredRole: AdminRole[]): boolean {
  return requiredRole.includes(userRole)
}

export function isSuperAdmin(role: AdminRole): boolean {
  return role === 'superadmin'
}

/**
 * 统一的权限验证函数 - 用于 Server Actions
 * 验证当前用户是否为活跃的管理员，并可选择性地验证角色
 *
 * @param requiredRoles - 可选，需要的角色列表。如果不提供，则只需要是管理员即可
 * @param options - 可选配置：allowMumuForOperations - 是否允许客服mumu访问运营管理功能
 * @returns AdminProfile - 管理员资料
 * @throws Error - 如果未登录、不是管理员或权限不足
 *
 * @example
 * // 只需要是管理员
 * const admin = await requireAdmin()
 *
 * // 需要是超级管理员或管理员
 * const admin = await requireAdmin(['superadmin', 'admin'])
 *
 * // 运营管理功能：允许客服mumu访问
 * const admin = await requireAdmin(['superadmin', 'admin', 'support'], { allowMumuForOperations: true })
 */
export async function requireAdmin(
  requiredRoles?: AdminRole[],
  options?: { allowMumuForOperations?: boolean }
): Promise<AdminProfile> {
  const supabase = await getSupabaseServerClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error('未登录，请先登录')
  }

  const { data: adminData, error: adminError } = await supabase
    .from('admin_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (adminError || !adminData) {
    throw new Error('无管理员权限，请联系系统管理员')
  }

  const admin = adminData as AdminProfile

  if (!admin.is_active) {
    throw new Error('管理员账号已被禁用')
  }

  // 特殊权限：客服mumu可以访问运营管理功能
  if (options?.allowMumuForOperations && admin.display_name === 'mumu' && admin.role === 'support') {
    return admin
  }

  if (requiredRoles && requiredRoles.length > 0) {
    if (!requiredRoles.includes(admin.role)) {
      throw new Error('权限不足，无法执行此操作')
    }
  }

  return admin
}

/**
 * 检查管理员权限（不抛出异常，返回结果对象）
 * 适用于需要返回错误信息而不是抛出异常的场景
 * 
 * @param requiredRoles - 可选，需要的角色列表
 * @returns { ok: boolean, admin?: AdminProfile, error?: string }
 */
export async function checkAdmin(
  requiredRoles?: AdminRole[]
): Promise<{ ok: boolean; admin?: AdminProfile; error?: string }> {
  try {
    const admin = await requireAdmin(requiredRoles)
    return { ok: true, admin }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '权限验证失败'
    return { ok: false, error: errorMessage }
  }
}

export async function signIn(email: string, password: string) {
  const supabase = getSupabaseClient()
  return await supabase.auth.signInWithPassword({ email, password })
}

export async function signOut() {
  const supabase = getSupabaseClient()
  return await supabase.auth.signOut()
}
