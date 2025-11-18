"use server"

import { getSupabaseServerClient } from "@/lib/supabase"
import type { AdminProfile } from "@/lib/types/admin"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export interface LoginResult {
  ok: boolean
  error?: string
  admin?: {
    id: string
    display_name: string
    is_active: boolean
  }
}

/**
 * 登录 Server Action
 * 验证用户凭证并检查管理员权限
 */
export async function loginAction(
  email: string,
  password: string
): Promise<LoginResult> {
  try {
    const supabase = await getSupabaseServerClient()

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError || !authData.user) {
      return {
        ok: false,
        error: "邮箱或密码错误",
      }
    }

    const { data: adminData, error: adminError } = await supabase
      .from('admin_profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single()

    if (adminError || !adminData) {
      await supabase.auth.signOut()
      return {
        ok: false,
        error: "您没有管理员权限，请联系超级管理员",
      }
    }

    const admin = adminData as AdminProfile

    if (!admin.is_active) {
      await supabase.auth.signOut()
      return {
        ok: false,
        error: "您的账号已被禁用，请联系超级管理员",
      }
    }

    return {
      ok: true,
      admin: {
        id: admin.id,
        display_name: admin.display_name,
        is_active: admin.is_active,
      },
    }
  } catch (error) {
    console.error("[loginAction] 登录异常:", error)
    return {
      ok: false,
      error: "登录时发生错误，请重试",
    }
  }
}
