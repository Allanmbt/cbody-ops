/**
 * 轻量级内存限流
 * 注意:Vercel Serverless 函数每次冷启动会重置,仅作基础防护
 * 生产环境建议使用 Upstash Redis
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

// 内存存储
const rateLimitStore = new Map<string, RateLimitEntry>()

/**
 * 限流配置
 */
export interface RateLimitConfig {
  windowMs: number  // 时间窗口(毫秒)
  maxRequests: number  // 最大请求数
}

/**
 * 限流检查结果
 */
export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfter?: number
}

/**
 * 检查限流
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  // 清理过期数据
  if (entry && entry.resetAt < now) {
    rateLimitStore.delete(key)
  }

  // 获取当前窗口数据
  const current = rateLimitStore.get(key)

  if (!current) {
    // 新窗口
    const resetAt = now + config.windowMs
    rateLimitStore.set(key, { count: 1, resetAt })
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt
    }
  }

  // 检查是否超限
  if (current.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: current.resetAt,
      retryAfter: Math.ceil((current.resetAt - now) / 1000)
    }
  }

  // 增加计数
  current.count++
  rateLimitStore.set(key, current)

  return {
    allowed: true,
    remaining: config.maxRequests - current.count,
    resetAt: current.resetAt
  }
}

/**
 * 组合限流检查(分钟+小时)
 */
export function checkApiRateLimit(
  apiKeyId: string,
  rateLimitPerMinute: number,
  rateLimitPerHour: number
): RateLimitResult {
  // 检查分钟限流
  const minuteResult = checkRateLimit(`${apiKeyId}:minute`, {
    windowMs: 60 * 1000,
    maxRequests: rateLimitPerMinute
  })

  if (!minuteResult.allowed) {
    return minuteResult
  }

  // 检查小时限流
  const hourResult = checkRateLimit(`${apiKeyId}:hour`, {
    windowMs: 60 * 60 * 1000,
    maxRequests: rateLimitPerHour
  })

  return hourResult
}

/**
 * IP限流
 */
export function checkIpRateLimit(ipAddress: string): RateLimitResult {
  return checkRateLimit(`ip:${ipAddress}`, {
    windowMs: 60 * 60 * 1000, // 1小时
    maxRequests: 1000
  })
}

/**
 * 定期清理过期数据
 */
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000) // 每5分钟清理一次
