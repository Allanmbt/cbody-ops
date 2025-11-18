import { z } from 'zod'

// 媒体类型
export const mediaKindSchema = z.enum(['image', 'video', 'live_photo'])

// 媒体状态
export const mediaStatusSchema = z.enum(['pending', 'approved', 'rejected'])

// 审核通过数据
export const approveMediaSchema = z.object({
    id: z.string().uuid('无效的媒体ID'),
    min_user_level: z.number().int().min(0).max(10).default(0),
})

// 审核驳回数据
export const rejectMediaSchema = z.object({
    id: z.string().uuid('无效的媒体ID'),
    reason: z.string().min(1, '驳回原因不能为空').max(500, '驳回原因不能超过500字'),
})

// 批量审核通过数据
export const batchApproveMediaSchema = z.object({
    ids: z.array(z.string().uuid()).min(1, '至少选择一个媒体'),
    min_user_level: z.number().int().min(0).max(10).default(0),
})

// 批量审核驳回数据
export const batchRejectMediaSchema = z.object({
    ids: z.array(z.string().uuid()).min(1, '至少选择一个媒体'),
    reason: z.string().min(1, '驳回原因不能为空').max(500, '驳回原因不能超过500字'),
})

// 删除媒体数据
export const deleteMediaSchema = z.object({
    id: z.string().uuid('无效的媒体ID'),
})

// 重排序数据
export const reorderMediaSchema = z.object({
    girl_id: z.string().uuid('无效的技师ID'),
    items: z.array(
        z.object({
            id: z.string().uuid(),
            sort_order: z.number().int().min(0),
        })
    ).min(1, '至少有一个排序项'),
})

// 签名 URL 请求
export const signUrlSchema = z.object({
    key: z.string().min(1, '存储路径不能为空'),
    type: z.enum(['main', 'thumb']),
    bucket: z.enum(['girls-media', 'tmp-uploads']).optional().default('girls-media'),
    expires_in: z.number().int().min(60).max(86400).optional().default(3600), // 1分钟到24小时
})

// 媒体列表查询参数
export const mediaListParamsSchema = z.object({
    status: mediaStatusSchema.optional(),
    girl_id: z.string().uuid().optional(),
    kind: mediaKindSchema.optional(),
    min_user_level: z.number().int().min(0).max(10).optional(),
    date_from: z.string().optional(),
    date_to: z.string().optional(),
    search: z.string().optional(),
    sort_by: z.enum(['created_at', 'reviewed_at', 'sort_order']).optional().default('created_at'),
    sort_order: z.enum(['asc', 'desc']).optional().default('desc'),
    page: z.number().int().min(1).optional().default(1),
    limit: z.number().int().min(1).max(100).optional().default(20),
})

// 类型导出
export type ApproveMediaInput = z.infer<typeof approveMediaSchema>
export type RejectMediaInput = z.infer<typeof rejectMediaSchema>
export type BatchApproveMediaInput = z.infer<typeof batchApproveMediaSchema>
export type BatchRejectMediaInput = z.infer<typeof batchRejectMediaSchema>
export type DeleteMediaInput = z.infer<typeof deleteMediaSchema>
export type ReorderMediaInput = z.infer<typeof reorderMediaSchema>
export type SignUrlInput = z.infer<typeof signUrlSchema>
export type MediaListParamsInput = z.infer<typeof mediaListParamsSchema>
