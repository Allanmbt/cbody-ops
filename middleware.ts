import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

export async function middleware(req: NextRequest) {
  const hostname = req.headers.get('host') || ''

  // 🔧 api.cbody.vip 域名严格隔离控制
  if (hostname.includes('api.cbody.vip')) {
    const pathname = req.nextUrl.pathname

    console.log('[API Domain] 检测到 api.cbody.vip 访问:', { hostname, pathname })

    // ❌ 禁止访问任何后台路径
    const forbiddenPaths = [
      '/dashboard',
      '/login',
      '/admin',
      '/settings',
      '/users',
      '/orders',
      '/finance',
      '/operations',
      '/configs'
    ]

    // 检查是否访问禁止路径
    if (forbiddenPaths.some(path => pathname.startsWith(path))) {
      console.log('[API Domain] 拒绝访问后台路径:', pathname)
      return new NextResponse('Forbidden', { status: 403 })
    }

    // ❌ 根路径返回404
    if (pathname === '/') {
      console.log('[API Domain] 根路径返回404')
      return new NextResponse('Not Found', { status: 404 })
    }

    // ✅ 只允许 /api/v1/* 路径(严格限制)
    if (!pathname.startsWith('/api/v1/')) {
      console.log('[API Domain] 非 API 路径返回404:', pathname)
      return new NextResponse('Not Found', { status: 404 })
    }

    console.log('[API Domain] 允许 API 访问:', pathname)
    // ✅ API 请求直接通过,不处理 Supabase session
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
