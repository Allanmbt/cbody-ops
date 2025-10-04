import { getSupabaseClient, getSupabaseAdminClient } from "./supabase"
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
  // 在 Server Action 中使用，避免 RLS 递归问题
  const supabase = getSupabaseAdminClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  return { user, error }
}

export async function getAdminProfile(userId: string): Promise<AdminProfile | null> {
  // 使用admin客户端绕过RLS限制
  const supabase = getSupabaseAdminClient()

  console.log('Fetching admin profile for user:', userId)

  const { data, error } = await supabase
    .from('admin_profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('Error fetching admin profile:', error)

    // If no admin profile found, return null
    if (error.code === 'PGRST116') {
      console.log('No admin profile found for user:', userId)
      return null
    }

    return null
  }

  console.log('Admin profile found:', data)

  const profile = data as AdminProfile

  // Check if admin is active
  if (!profile.is_active) {
    console.log('Admin profile is inactive:', userId)
    return null
  }

  return profile
}

export async function getCurrentAdminProfile(): Promise<AdminProfile | null> {
  const { user, error } = await getCurrentUser()

  if (error) {
    console.error('Error getting current user:', error)
    return null
  }

  if (!user) {
    console.log('No authenticated user found')
    return null
  }

  return getAdminProfile(user.id)
}

// Alias for getCurrentAdminProfile for consistency with user management
export async function getCurrentAdmin(): Promise<AdminProfile | null> {
  return getCurrentAdminProfile()
}

// 专门用于 Server Actions 的版本，避免 RLS 递归
export async function getCurrentAdminFromServerAction(): Promise<AdminProfile | null> {
  const { user, error } = await getCurrentUserFromServerAction()

  if (error) {
    console.error('Error getting current user:', error)
    return null
  }

  if (!user) {
    console.log('No authenticated user found')
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

export async function signIn(email: string, password: string) {
  const supabase = getSupabaseClient()
  return await supabase.auth.signInWithPassword({ email, password })
}

export async function signOut() {
  const supabase = getSupabaseClient()
  return await supabase.auth.signOut()
}
