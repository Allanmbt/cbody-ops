// 订单功能模块类型定义

/**
 * 订单状态
 */
export type OrderStatus =
  | 'pending'      // 待确认
  | 'confirmed'    // 已确认
  | 'en_route'     // 在路上
  | 'arrived'      // 已到达
  | 'in_service'   // 服务中
  | 'completed'    // 已完成
  | 'cancelled'    // 已取消

/**
 * 预约模式
 */
export type BookingMode =
  | 'now'          // 越快越好
  | 'flex'         // 指定时间段

/**
 * 多语言文本
 */
export interface MultiLangText {
  en: string
  zh: string
  th: string
}

/**
 * 订单完整信息（严格按照数据库结构）
 */
export interface Order {
  id: string
  order_number: string
  girl_id: string
  user_id: string
  service_id: number
  service_duration_id: number
  service_name: MultiLangText
  service_duration: number  // 快照字段：服务时长（分钟）
  service_price: number
  booking_mode: BookingMode
  eta_minutes: number | null
  estimated_arrival_at: string | null
  service_address_id: string | null
  address_snapshot: Record<string, any>  // 地址完整快照（含联系人/电话/门禁/notes）
  latitude: number | null
  longitude: number | null
  distance: number | null
  currency: string
  service_fee: number
  travel_fee: number
  extra_fee: number
  discount_amount: number
  total_amount: number
  pricing_snapshot: Record<string, any>
  status: OrderStatus
  service_started_at: string | null
  completed_at: string | null
  scheduled_start_at: string | null
  queue_position: number | null
  created_at: string
  updated_at: string

  // 关联数据
  user?: {
    id: string
    email: string | null
    raw_user_meta_data?: {
      username?: string
      phone?: string
    }
  }
  girl?: {
    id: string
    girl_number: number
    username: string
    name: string
    avatar_url: string | null
  }
  service?: {
    id: number
    code: string
    title: MultiLangText
  }
  // 注意：service_duration_detail 是关联表数据，避免与 service_duration 字段冲突
  service_duration_detail?: {
    id: number
    duration_minutes: number
  }
}

/**
 * 订单列表查询参数
 */
export interface OrderListParams {
  page: number
  limit: number
  search?: string
  status?: OrderStatus
  start_date?: string
  end_date?: string
  sort_by?: 'created_at' | 'scheduled_start_at' | 'total_amount'
  sort_order?: 'asc' | 'desc'
}

/**
 * 分页响应
 */
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

/**
 * API 响应
 */
export interface ApiResponse<T = any> {
  ok: boolean
  data?: T
  error?: string
}

/**
 * 可升级的服务选项
 */
export interface UpgradableService {
  service_id: number
  service_duration_id: number
  service_name: MultiLangText
  duration_minutes: number
  price: number
  is_active: boolean
  is_qualified: boolean
}

/**
 * 升级服务请求参数
 */
export interface UpgradeServiceRequest {
  order_id: string
  new_service_duration_id: number
}
