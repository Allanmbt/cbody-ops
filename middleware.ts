import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

export async function middleware(req: NextRequest) {
  const hostname = req.headers.get('host') || ''

  // 🔧 api.cbody.vip 域名控制
  if (hostname.includes('api.cbody.vip')) {
    // 根路径返回404
    if (req.nextUrl.pathname === '/') {
      return new NextResponse('Not Found', { status: 404 })
    }

    // 只允许 /api/* 路径
    if (!req.nextUrl.pathname.startsWith('/api/')) {
      return new NextResponse('Not Found', { status: 404 })
    }

    // API 请求直接通过,不处理 Supabase session
    return NextResponse.next()
  }

  // 以下是 ops.cbody.vip 的正常逻辑
  let res = NextResponse.next({
    request: req,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // 刷新 session(自动更新 cookies)
  await supabase.auth.getUser()

  // 根路径重定向到 dashboard
  if (req.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
