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
    commission_rate?: number | null
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

// 注意：ServiceListParams、ServiceFormData、ServiceDurationFormData 类型从 validations.ts 中导出（通过 z.infer）

// 技师服务绑定类型
export interface AdminGirlService {
    id: string
    girl_id: string
    service_id: number
    is_qualified: boolean
    admin_id: string
    notes?: string | null
    created_at: string
    updated_at: string
}

// 技师服务时长配置类型
export interface GirlServiceDuration {
    id: string
    admin_girl_service_id: string
    service_duration_id: number
    custom_price?: number | null
    is_active: boolean
    created_at: string
    updated_at: string
}

// 服务绑定技师列表项
export interface ServiceGirlBindItem {
    id: string
    girl_number: number
    username: string
    name: string
    avatar_url?: string | null
    city?: {
        id: number
        name: MultiLanguageText
    }
    categories?: Array<{
        id: number
        name: MultiLanguageText
    }>
    binding?: {
        id: string
        is_qualified: boolean
        notes?: string | null
        enabled_durations_count: number
    }
}

// 注意：ServiceBindListParams、BatchBindData、BatchUnbindData、BatchRestoreData 类型从 validations.ts 中导出（通过 z.infer）

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
