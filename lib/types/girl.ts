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
    start: string // "19:00" 格式必须为 HH:00 或 HH:30
    end: string   // "10:00" 格式必须为 HH:00 或 HH:30
}

// 语言代码数组: EN_Base, EN, ZH_Base, ZH, TH_Base, TH, KO_Base, KO, YUE_Base, YUE, JA_Base, JA
export type Languages = string[]

export interface Girl {
    id: string
    user_id?: string | null
    city_id?: number | null
    telegram_id?: number | null
    girl_number: number // 只读,触发器生成,从1001开始
    username: string // 唯一
    name: string
    profile: LanguageContent
    avatar_url?: string | null
    birth_date?: string | null
    height?: number | null
    weight?: number | null
    measurements?: string | null
    gender: Gender
    languages?: Languages // 语言代码数组
    tags: LanguageContent
    badge?: GirlBadge | null
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
    // 支持多对多分类关系
    category_ids?: number[]
    categories?: Array<{
        id: number
        name: LanguageContent
    }>
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
    user_id?: string | null // 可绑定用户ID
    telegram_id?: number | null // 可编辑
    username: string // 必须唯一
    name: string
    profile: LanguageContent
    avatar_url?: string | null
    birth_date?: string | null
    height?: number | null
    weight?: number | null
    measurements?: string | null
    gender: Gender
    languages?: Languages // 语言代码数组
    tags: LanguageContent
    badge?: GirlBadge | null
    rating: number
    total_sales: number
    total_reviews: number
    max_travel_distance: number
    work_hours?: WorkHours // {start: "HH:00|HH:30", end: "HH:00|HH:30"}
    is_verified: boolean
    is_blocked: boolean
    is_visible_to_thai: boolean
    sort_order: number
    city_id?: number | null
    category_ids?: number[] // 多对多分类
}

// 查询参数类型
export interface GirlListParams {
    page: number
    limit: number
    search?: string // 搜索 username/girl_number/telegram_id
    city_id?: number
    category_id?: number // 单个分类筛选
    status?: GirlStatusType
    is_verified?: boolean
    is_blocked?: boolean // 屏蔽状态筛选: all/blocked/active
    sort_by: 'created_at' | 'updated_at' | 'rating' | 'total_sales' | 'booking_count' | 'sort_order'
    sort_order: 'asc' | 'desc'
}

// 用户搜索结果类型 (用于user_id绑定)
export interface UserSearchResult {
    id: string
    email?: string | null
    phone?: string | null
    display_name?: string | null
}
