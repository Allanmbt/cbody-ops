import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { extractApiKey, validateApiKey, logApiRequest } from '@/lib/api-auth'
import { checkApiRateLimit, checkIpRateLimit } from '@/lib/api-rate-limit'

/**
 * 技师数据响应
 */
interface GirlData {
  id: string
  girl_number: number
  city_id: string
  username: string
  avatar_url: string | null
  lat: number | null
  lng: number | null
  status: 'available' | 'busy' | 'offline'
  next_available_time: string | null
}

/**
 * GET /api/v1/girls
 * 获取所有可用技师列表
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  let apiKeyId: string | undefined

  try {
    // 1. 提取 API Key
    const apiKey = extractApiKey(request)
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: 'Missing API key. Use Authorization: Bearer <api_key> or ?api_key=<api_key>' },
        { status: 401 }
      )
    }

    // 2. 验证 API Key
    const validation = await validateApiKey(apiKey)
    if (!validation.valid) {
      return NextResponse.json(
        { ok: false, error: validation.error || 'Invalid API key' },
        { status: 401 }
      )
    }

    apiKeyId = validation.apiKeyId

    // 3. 限流检查 - API Key
    const rateLimitResult = checkApiRateLimit(
      validation.apiKeyId!,
      validation.rateLimitPerMinute || 100,
      validation.rateLimitPerHour || 1000
    )

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Rate limit exceeded',
          retryAfter: rateLimitResult.retryAfter
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(validation.rateLimitPerMinute),
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': new Date(rateLimitResult.resetAt).toISOString(),
            'Retry-After': String(rateLimitResult.retryAfter)
          }
        }
      )
    }

    // 4. 限流检查 - IP
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                      request.headers.get('x-real-ip') ||
                      'unknown'

    const ipRateLimitResult = checkIpRateLimit(ipAddress)
    if (!ipRateLimitResult.allowed) {
      return NextResponse.json(
        { ok: false, error: 'IP rate limit exceeded' },
        { status: 429 }
      )
    }

    // 5. 查询技师数据
    const supabase = getSupabaseAdminClient()

    const { data: girls, error } = await supabase
      .from('girls')
      .select(`
        id,
        girl_number,
        city_id,
        name,
        avatar_url,
        is_blocked,
        is_verified,
        sort_order,
        girls_status!girls_status_girl_id_fkey(
          status,
          current_lat,
          current_lng,
          next_available_time
        )
      `)
      .eq('is_blocked', false)
      .eq('is_verified', true)
      .gte('sort_order', 998)

    if (error) {
      console.error('[API Girls] 查询失败:', error)
      return NextResponse.json(
        { ok: false, error: 'Failed to fetch girls data' },
        { status: 500 }
      )
    }

    // 6. 数据转换(脱敏)
    const result: GirlData[] = (girls || []).map((girl: any) => {
      const status = girl.girls_status
      return {
        id: girl.id,
        girl_number: girl.girl_number,
        city_id: girl.city_id,
        username: girl.name,
        avatar_url: girl.avatar_url,
        lat: status?.current_lat || null,
        lng: status?.current_lng || null,
        status: status?.status || 'offline',
        next_available_time: status?.next_available_time || null
      }
    })

    // 7. 记录日志
    logApiRequest({
      apiKeyId: validation.apiKeyId!,
      endpoint: '/api/v1/girls',
      ipAddress,
      userAgent: request.headers.get('user-agent') || undefined,
      responseStatus: 200,
      responseTimeMs: Date.now() - startTime
    })

    // 8. 返回响应
    return NextResponse.json(
      {
        ok: true,
        data: result,
        meta: {
          total: result.length,
          timestamp: new Date().toISOString()
        }
      },
      {
        status: 200,
        headers: {
          'X-RateLimit-Limit': String(validation.rateLimitPerMinute),
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          'X-RateLimit-Reset': new Date(rateLimitResult.resetAt).toISOString()
        }
      }
    )
  } catch (error) {
    console.error('[API Girls] 异常:', error)

    // 记录错误日志
    if (apiKeyId) {
      logApiRequest({
        apiKeyId,
        endpoint: '/api/v1/girls',
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
        responseStatus: 500,
        responseTimeMs: Date.now() - startTime
      })
    }

    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// 禁止其他 HTTP 方法
export async function POST() {
  return NextResponse.json(
    { ok: false, error: 'Method not allowed' },
    { status: 405 }
  )
}

export async function PUT() {
  return NextResponse.json(
    { ok: false, error: 'Method not allowed' },
    { status: 405 }
  )
}

export async function DELETE() {
  return NextResponse.json(
    { ok: false, error: 'Method not allowed' },
    { status: 405 }
  )
}
