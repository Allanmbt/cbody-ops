import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { createBrowserClient, createServerClient } from "@supabase/ssr"
import type { Database } from "./types/admin"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

let browserClient: SupabaseClient<Database> | null = null

export type SupabaseLocale = "zh" | "th"

/**
 * 浏览器端 Supabase 客户端（客户端组件使用）
 * 使用 @supabase/ssr 的 createBrowserClient，自动处理 cookies
 * 单例模式确保 session 一致性
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_ANON_KEY 环境变量")
  }

  if (!browserClient) {
    browserClient = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
  }

  return browserClient
}

/**
 * 服务端 Supabase 客户端（Server Actions / Server Components 使用）
 * 通过 cookies 读取用户 session
 */
export async function getSupabaseServerClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_ANON_KEY 环境变量")
  }

  const { cookies } = await import("next/headers")
  const cookieStore = await cookies()

  return createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch (error) {
            // Server Actions 中可能无法写入 cookies
          }
        },
      },
    }
  )
}

/**
 * Admin 客户端（仅用于无需用户 session 的管理操作）
 */
export function getSupabaseAdminClient(): SupabaseClient<Database> {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 环境变量")
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
