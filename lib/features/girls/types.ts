export type GirlStatusType = 'available' | 'busy' | 'offline'
export type GirlBadge = 'new' | 'hot' | 'top_rated' | null
export type MediaType = 'image' | 'video'
export type Gender = 0 | 1 // 0: 女, 1: 男

export interface LanguageContent {
    en?: string
    zh?: string
    th?: string
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
    max_travel_distance: number
    trust_score: number
    is_verified: boolean
    is_blocked: boolean
    is_visible_to_thai: boolean
    sort_order: number
    created_at: string
    updated_at: string
    previous_user_id?: string | null
    deleted_at?: string | null
    deleted_reason?: string | null
}

export interface GirlStatus {
    id: string
    girl_id: string
    status: GirlStatusType
    current_lat?: number | null
    current_lng?: number | null
    next_available_time?: string | null
    last_online_at?: string | null
    last_offline_at?: string | null
    last_session_seconds: number
    total_online_seconds: number
    cooldown_until_at?: string | null
    last_seen_at?: string | null
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

// 注意：GirlFormData 和 GirlListParams 类型从 validations.ts 中导出（通过 z.infer）

// 用户搜索结果类型 (用于user_id绑定)
export interface UserSearchResult {
    id: string
    email?: string | null
    phone?: string | null
    display_name?: string | null
}
