// 用户管理相关类型定义

export interface UserProfile {
    id: string
    username: string | null
    display_name: string | null
    avatar_url: string | null
    country_code: string | null
    language_code: string
    timezone: string | null
    gender: number
    level: number
    experience: number
    credit_score: number
    notification_settings: Record<string, boolean>
    preferences: Record<string, unknown>
    is_banned: boolean
    created_at: string
    updated_at: string
}

export interface UserLoginEvent {
    id: string
    user_id: string
    device_id: string | null
    ip_address: string | null
    user_agent: string | null
    login_method: string | null
    logged_at: string
}

export interface UserConnectedAccount {
    id: string
    user_id: string
    provider: 'google' | 'apple' | 'facebook' | 'line' | 'kakao' | 'wechat'
    provider_user_id: string
    provider_email: string | null
    is_primary: boolean
    linked_at: string
    last_used_at: string | null
}

// 用户列表查询参数
export interface UserListParams {
    search?: string
    country_code?: string
    language_code?: string
    is_banned?: boolean
    level?: number
    date_from?: string
    date_to?: string
    sort_by?: 'created_at' | 'level' | 'credit_score'
    sort_order?: 'asc' | 'desc'
    page?: number
    limit?: number
    cursor?: string // keyset pagination cursor
}

// 用户列表项（包含最后登录时间）
export interface UserListItem extends UserProfile {
    last_login_at?: string
}

// 用户详情（包含相关数据）
export interface UserDetails {
    profile: UserProfile
    login_events: UserLoginEvent[]
    connected_accounts: UserConnectedAccount[]
}

// 更新用户资料的数据
export interface UpdateUserProfileData {
    display_name?: string
    username?: string
    language_code?: 'en' | 'zh' | 'th'
    timezone?: string
    level?: number
    credit_score?: number
    is_banned?: boolean
}

// 重置密码数据
export interface ResetUserPasswordData {
    user_id: string
    new_password: string
}

// 审计日志相关
export interface UserOperationLog {
    operation_type: 'update_user_profile' | 'toggle_user_ban' | 'reset_user_password'
    target_user_id: string
    operation_details: Record<string, unknown>
}

// 分页响应
export interface PaginatedResponse<T> {
    data: T[]
    total: number
    page: number
    limit: number
    has_next: boolean
    has_prev: boolean
    next_cursor?: string
    prev_cursor?: string
}

// 国家选项
export interface CountryOption {
    code: string
    name: string
}

// 语言选项
export interface LanguageOption {
    code: string
    name: string
}
