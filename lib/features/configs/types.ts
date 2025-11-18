// 配置类型定义

// 枚举类型
export type ConfigScope = 'global' | 'city' | 'app' | 'user'
export type ConfigDtype = 'json' | 'text' | 'url'

// 基础配置类型
export interface AppConfig {
  id: string
  namespace: string
  config_key: string
  scope: ConfigScope
  scope_id: string | null
  locale: string | null
  dtype: ConfigDtype
  value_json: Record<string, any> | null
  value_text: string | null
  value_url: string | null
  is_active: boolean
  effective_from: string
  effective_to: string | null
  priority: number
  version: number
  description: string | null
  updated_by: string | null
  updated_at: string
}

// 车费计价配置参数
export interface FareParamsConfig {
  // 主计价参数
  baseFare: number                    // 基础费用（泰铢）
  freeDistanceKm: number              // 免费距离（公里）
  tier1PerKm: number                  // 第一档单价（0-5km，泰铢/公里）
  tier2PerKm: number                  // 第二档单价（5-15km，泰铢/公里）
  tier3PerKm: number                  // 第三档单价（>15km，泰铢/公里）
  perMin: number                      // 时间费用（泰铢/分钟）
  tripMultiplier: number              // 行程倍数（1=单程, 2=来回）
  minFare: number                     // 最低收费（泰铢）
  roundUpTo: number                   // 向上取整倍数（泰铢）

  // 环境参数：雨天与拥堵（开关 + 系数）
  rain_enabled: boolean               // 雨天开关（默认关闭）
  rain_multiplier: number             // 雨天价格倍数（1.20 = 加价20%）
  congestion_enabled: boolean         // 拥堵开关（默认关闭）
  congestion_multiplier: number       // 拥堵价格倍数（1.15 = 加价15%）

  // ETA 缓冲（分钟）
  eta_buffer_min_base: number         // 默认缓冲时间
  eta_buffer_min_rain: number         // 雨天额外增加的缓冲时间
  eta_buffer_min_congestion: number   // 拥堵额外增加的缓冲时间
}

// 配置列表查询参数
export interface ConfigListParams {
  namespace?: string
  config_key?: string
  scope?: ConfigScope
  scope_id?: string
  is_active?: boolean
  page?: number
  limit?: number
}

// 分页响应
export interface PaginatedResponse<T> {
  data: T[]
  page: number
  limit: number
  total: number
  totalPages: number
}

// 配置更新参数
export interface UpdateConfigParams {
  id: string
  value_json?: Record<string, any>
  value_text?: string
  value_url?: string
  description?: string
}
