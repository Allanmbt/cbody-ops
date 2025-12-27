/**
 * 技师考勤统计类型定义
 */

export interface GirlAttendanceStats {
  girl_id: string
  girl_number: number
  name: string
  avatar_url: string | null
  city_id: number | null
  online_seconds: number
  order_count: number
  order_duration_seconds: number
  booking_rate_percent: number
  performance_rating: string
}

export interface GirlAttendanceListParams {
  search?: string // 搜索技师名称或工号
  city_id?: number // 城市筛选
  sort_by?: 'girl_number' | 'online_seconds' | 'order_count' | 'order_duration_seconds' | 'booking_rate_percent'
  sort_order?: 'asc' | 'desc'
}

export interface City {
  id: number
  name: {
    en: string
    zh: string
    th: string
  }
}

export type ApiResponse<T> =
  | {
      ok: true
      data: T
    }
  | {
      ok: false
      error: string
    }
