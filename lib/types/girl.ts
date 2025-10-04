export type GirlStatusType = 'available' | 'busy' | 'offline'
export type GirlBadge = 'new' | 'hot' | 'top_rated' | null
export type MediaType = 'image' | 'video'
export type Gender = 0 | 1 // 0: 女, 1: 男

export interface LanguageContent {
    en?: string
    zh?: string
    th?: string
}

export interface WorkHours {
    start: string // "19:00"
    end: string   // "10:00"
}

export interface Languages {
    [key: string]: number // 语言代码: 熟练度等级
}

export interface Girl {
    id: string
    user_id?: string
    city_id?: number
    category_id?: number
    telegram_id?: number
    girl_number: number
    username: string
    name: string
    profile: LanguageContent
    avatar_url?: string
    birth_date?: string
    height?: number
    weight?: number
    measurements?: string
    gender: Gender
    languages?: Languages
    tags: LanguageContent
    badge?: GirlBadge
    rating: number
    total_sales: number
    total_reviews: number
    booking_count: number
    max_travel_distance: number
    work_hours?: WorkHours
    is_verified: boolean
    is_blocked: boolean
    is_visible_to_thai: boolean
    sort_order: number
    created_at: string
    updated_at: string
}

export interface GirlStatus {
    id: string
    girl_id: string
    status: GirlStatusType
    current_lat?: number
    current_lng?: number
    standby_lat?: number
    standby_lng?: number
    next_available_time?: string
    auto_status_update: boolean
    updated_at: string
    location_geom?: any
}

export interface GirlMedia {
    id: string
    girl_id: string
    media_type: MediaType
    url: string
    thumbnail_url?: string
    sort_order: number
    created_at: string
}

export interface GirlWithStatus extends Girl {
    status?: GirlStatus
    media?: GirlMedia[]
    city?: {
        id: number
        name: LanguageContent
    }
    category?: {
        id: number
        name: LanguageContent
    }
}

// API 响应类型
export interface ApiResponse<T = any> {
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

// 表单数据类型
export interface GirlFormData {
    girl_number: number
    username: string
    name: string
    profile: LanguageContent
    avatar_url?: string
    birth_date?: string
    height?: number
    weight?: number
    measurements?: string
    gender: Gender
    languages?: Languages
    tags: LanguageContent
    badge?: GirlBadge
    max_travel_distance: number
    work_hours?: WorkHours
    is_verified: boolean
    is_blocked: boolean
    is_visible_to_thai: boolean
    sort_order: number
    city_id?: number
    category_id?: number
}

// 查询参数类型
export interface GirlListParams {
    page: number
    limit: number
    search?: string
    city_id?: number
    category_id?: number
    status?: GirlStatusType
    is_verified?: boolean
    is_blocked?: boolean
    badge?: GirlBadge
    sort_by: 'created_at' | 'updated_at' | 'rating' | 'total_sales' | 'booking_count' | 'sort_order'
    sort_order: 'asc' | 'desc'
}
