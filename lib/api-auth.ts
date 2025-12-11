import { createHash } from 'crypto'
import { getSupabaseAdminClient } from './supabase'

/**
 * API Key 验证结果
 */
export interface ApiKeyValidation {
  valid: boolean
  apiKeyId?: string
  partnerName?: string
  rateLimitPerMinute?: number
  rateLimitPerHour?: number
  error?: string
}

/**
 * 从请求中提取 API Key
 */
export function extractApiKey(request: Request): string | null {
  // 优先从 Authorization header 获取
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }

  // 从查询参数获取(备用)
  const url = new URL(request.url)
  return url.searchParams.get('api_key')
}

/**
 * 生成 API Key Hash (SHA-256)
 */
export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex')
}

/**
 * 验证 API Key
 */
export async function validateApiKey(apiKey: string): Promise<ApiKeyValidation> {
  try {
    const supabase = getSupabaseAdminClient()
    const apiKeyHash = hashApiKey(apiKey)

    const { data, error } = await supabase
      .from('api_keys')
      .select('id, partner_name, is_active, rate_limit_per_minute, rate_limit_per_hour')
      .eq('api_key_hash', apiKeyHash)
      .single() as {
        data: {
          id: string
          partner_name: string
          is_active: boolean
          rate_limit_per_minute: number
          rate_limit_per_hour: number
        } | null
        error: any
      }

    if (error || !data) {
      return { valid: false, error: 'Invalid API key' }
    }

    if (!data.is_active) {
      return { valid: false, error: 'API key is inactive' }
    }

    // 更新最后使用时间(异步,不等待)
    ;(supabase as any)
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', data.id)
      .then()

    return {
      valid: true,
      apiKeyId: data.id,
      partnerName: data.partner_name,
      rateLimitPerMinute: data.rate_limit_per_minute,
      rateLimitPerHour: data.rate_limit_per_hour
    }
  } catch (error) {
    console.error('[API Auth] 验证失败:', error)
    return { valid: false, error: 'Authentication failed' }
  }
}

/**
 * 记录 API 请求日志
 */
export async function logApiRequest(params: {
  apiKeyId: string
  endpoint: string
  ipAddress?: string
  userAgent?: string
  responseStatus: number
  responseTimeMs: number
}): Promise<void> {
  try {
    const supabase = getSupabaseAdminClient()
    await (supabase as any).from('api_request_logs').insert({
      api_key_id: params.apiKeyId,
      endpoint: params.endpoint,
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
      response_status: params.responseStatus,
      response_time_ms: params.responseTimeMs
    })
  } catch (error) {
    console.error('[API Log] 记录失败:', error)
  }
}

/**
 * 生成随机 API Key (用于管理后台)
 */
export function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = 'cbody_'
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}
