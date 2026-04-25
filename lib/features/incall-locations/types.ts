export interface IncallLocation {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  place_id: string | null
  city_id: number | null
  photos: string[]
  meta: IncallLocationMeta
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  // joined
  city?: { id: number; code: string; name: { en: string; zh: string; th: string } } | null
}

export interface IncallLocationMeta {
  floor?: string
  entrance_note?: string
  parking?: string
  wifi?: boolean
}

export interface IncallLocationListParams {
  page: number
  limit: number
  search?: string
  city_id?: number
  is_active?: boolean
}

export interface ApiResponse<T = void> {
  ok: boolean
  data?: T
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}
