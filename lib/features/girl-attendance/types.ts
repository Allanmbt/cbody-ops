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
  extension_rate: number
  performance_index: number
  performance_rating: string
}

export type GirlPerformanceLevel = "Excellent" | "Strong" | "Fair" | "Needs Attention"

export interface GirlPerformanceSnapshot {
  booking_efficiency_rate: number
  extension_rate: number
  extra_time_total_minutes: number
  arrived_cancellation_rate: number
  repeat_client_rate: number
  favorite_growth_count: number
  performance_index: number
  performance_level: GirlPerformanceLevel
  window_days: number
  generated_at: string
}

export interface GirlAttendanceListParams {
  search?: string
  city_id?: number
  sort_by?:
    | "girl_number"
    | "online_seconds"
    | "order_count"
    | "order_duration_seconds"
    | "booking_rate_percent"
    | "extension_rate"
    | "performance_index"
  sort_order?: "asc" | "desc"
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
