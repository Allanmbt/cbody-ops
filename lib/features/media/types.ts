// 媒体管理相关类型定义

export type MediaKind = 'image' | 'video' | 'live_photo'
export type MediaStatus = 'pending' | 'approved' | 'rejected'

export interface MediaMeta {
    mime?: string
    size?: number
    width?: number
    height?: number
    duration?: number
    live?: {
        image_key: string
        video_key: string
    }
    cloudflare?: {
        uid: string
        ready?: boolean
    }
}

export interface GirlMedia {
    id: string
    girl_id: string
    kind: MediaKind
    provider: 'supabase' | 'cloudflare'
    storage_key: string
    thumb_key: string | null
    meta: MediaMeta
    min_user_level: number
    status: MediaStatus
    reviewed_by: string | null
    reviewed_at: string | null
    reject_reason: string | null
    sort_order: number
    created_by: string
    created_at: string
    updated_at: string
}

export interface MediaListItem extends GirlMedia {
    girl_name?: string
    girl_username?: string
    girl_number?: number | null
    reviewer_name?: string
}

export interface MediaListParams {
    status?: MediaStatus
    girl_id?: string
    kind?: MediaKind
    min_user_level?: number
    date_from?: string
    date_to?: string
    search?: string
    sort_by?: 'created_at' | 'reviewed_at' | 'sort_order'
    sort_order?: 'asc' | 'desc'
    page?: number
    limit?: number
}

export interface ApproveMediaData {
    id: string
    min_user_level: number
}

export interface RejectMediaData {
    id: string
    reason: string
}

export interface BatchApproveData {
    ids: string[]
    min_user_level: number
}

export interface BatchUpdateMediaLevelData {
    ids: string[]
    min_user_level: number
}

export interface BatchRejectData {
    ids: string[]
    reason: string
}

export interface DeleteMediaData {
    id: string
}

export interface ReorderMediaData {
    girl_id: string
    items: Array<{
        id: string
        sort_order: number
    }>
}

export interface SignUrlRequest {
    key: string
    type: 'main' | 'thumb'
    expires_in?: number
}

export interface SignUrlResponse {
    url: string
    expires_at: string
}

export interface PaginatedMediaResponse {
    data: MediaListItem[]
    total: number
    page: number
    limit: number
    has_next: boolean
    has_prev: boolean
}

export interface MediaStats {
    pending_count: number
    approved_count: number
    rejected_count: number
    total_count: number
}

export type MediaOperationType =
    | 'approve_media'
    | 'reject_media'
    | 'delete_media'
    | 'batch_approve_media'
    | 'batch_update_media_level'
    | 'batch_reject_media'
    | 'reorder_media'
