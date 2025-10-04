// 多语言内容类型
export interface MultiLanguageText {
    en: string
    zh: string
    th: string
}

// 服务徽章类型
export type ServiceBadge = 'TOP_PICK' | 'HOT' | 'NEW' | null

// 服务项目类型
export interface Service {
    id: number
    category_id: number
    code: string
    title: MultiLanguageText
    description: MultiLanguageText
    badge?: ServiceBadge
    is_active: boolean
    is_visible_to_thai: boolean
    is_visible_to_english: boolean
    min_user_level: number
    total_sales: number
    sort_order: number
    created_at: string
    updated_at: string
    // 关联数据
    category?: {
        id: number
        code: string
        name: MultiLanguageText
    }
}

// 服务时长定价类型
export interface ServiceDuration {
    id: number
    service_id: number
    duration_minutes: number
    default_price: number
    min_price: number
    max_price: number
    is_active: boolean
    created_at: string
    updated_at: string
}

// 分类类型
export interface Category {
    id: number
    code: string
    name: MultiLanguageText
    is_active: boolean
    sort_order: number
}

// 服务列表查询参数
export interface ServiceListParams {
    page?: number
    limit?: number
    search?: string
    category_id?: number
    is_active?: boolean
    sort_by?: 'created_at' | 'updated_at' | 'total_sales' | 'sort_order'
    sort_order?: 'asc' | 'desc'
}

// 服务表单数据类型
export interface ServiceFormData {
    code: string
    category_id: number
    title: MultiLanguageText
    description: MultiLanguageText
    badge?: ServiceBadge
    is_active: boolean
    is_visible_to_thai: boolean
    is_visible_to_english: boolean
    min_user_level: number
    sort_order: number
}

// 时长定价表单数据类型
export interface ServiceDurationFormData {
    duration_minutes: number
    default_price: number
    min_price: number
    max_price: number
    is_active: boolean
}

// API 响应类型
export interface ApiResponse<T = any> {
    ok: boolean
    data?: T
    error?: string
    message?: string
}

// 分页响应类型
export interface PaginatedResponse<T> {
    data: T[]
    total: number
    page: number
    limit: number
    totalPages: number
}
