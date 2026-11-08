import { z } from 'zod'

export const mediaKindSchema = z.enum(['image', 'video', 'live_photo'])

export const mediaStatusSchema = z.enum(['pending', 'approved', 'rejected'])

// 两个字段必须同时提供或同时省略；省略时保留已有平台设置。
const platformVisibilityFields = {
    visible_on_ios: z.boolean().optional(),
    visible_on_android: z.boolean().optional(),
}

const validPlatformVisibility = (data: { visible_on_ios?: boolean; visible_on_android?: boolean }) =>
    (data.visible_on_ios === undefined && data.visible_on_android === undefined) ||
    (data.visible_on_ios !== undefined && data.visible_on_android !== undefined &&
        (!data.visible_on_ios || data.visible_on_android))

const platformVisibilityError = { message: '请选择全部平台、Android＋Web或仅 Web', path: ['visible_on_ios'] }

export const approveMediaSchema = z.object({
    id: z.string().uuid('无效的媒体 ID'),
    min_user_level: z.number().int().min(0).max(10).default(0),
    ...platformVisibilityFields,
}).refine(validPlatformVisibility, platformVisibilityError)

export const updateMediaSettingsSchema = z.object({
    id: z.string().uuid('无效的媒体 ID'),
    min_user_level: z.number().int().min(0).max(10),
    ...platformVisibilityFields,
}).refine(validPlatformVisibility, platformVisibilityError)

export const rejectMediaSchema = z.object({
    id: z.string().uuid('无效的媒体 ID'),
    reason: z.string().min(1, '驳回原因不能为空').max(500, '驳回原因不能超过 500 字'),
})

export const batchApproveMediaSchema = z.object({
    ids: z.array(z.string().uuid()).min(1, '至少选择一个媒体'),
    min_user_level: z.number().int().min(0).max(10).default(0),
    ...platformVisibilityFields,
}).refine(validPlatformVisibility, platformVisibilityError)

export const batchUpdateMediaLevelSchema = z.object({
    ids: z.array(z.string().uuid()).min(1, '至少选择一个媒体').max(100, '一次最多修改100个媒体').transform(ids => [...new Set(ids)]),
    min_user_level: z.number().int().min(0).max(9).optional(),
    ...platformVisibilityFields,
}).refine(validPlatformVisibility, platformVisibilityError)
    .refine(data => data.min_user_level !== undefined || data.visible_on_ios !== undefined, {
        message: '请至少选择一项需要修改的设置',
    })

export const batchRejectMediaSchema = z.object({
    ids: z.array(z.string().uuid()).min(1, '至少选择一个媒体'),
    reason: z.string().min(1, '驳回原因不能为空').max(500, '驳回原因不能超过 500 字'),
})

export const deleteMediaSchema = z.object({
    id: z.string().uuid('无效的媒体 ID'),
})

export const reorderMediaSchema = z.object({
    girl_id: z.string().uuid('无效的技师 ID'),
    items: z.array(
        z.object({
            id: z.string().uuid(),
            sort_order: z.number().int().min(0),
        }),
    ).min(1, '至少需要一项排序数据'),
})

export const signUrlSchema = z.object({
    key: z.string().min(1, '存储路径不能为空'),
    type: z.enum(['main', 'thumb']),
    bucket: z.enum(['girls-media', 'tmp-uploads']).optional().default('girls-media'),
    expires_in: z.number().int().min(60).max(86400).optional().default(3600),
})

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

export type ApproveMediaInput = z.infer<typeof approveMediaSchema>
export type RejectMediaInput = z.infer<typeof rejectMediaSchema>
export type BatchApproveMediaInput = z.infer<typeof batchApproveMediaSchema>
export type BatchUpdateMediaLevelInput = z.infer<typeof batchUpdateMediaLevelSchema>
export type BatchRejectMediaInput = z.infer<typeof batchRejectMediaSchema>
export type DeleteMediaInput = z.infer<typeof deleteMediaSchema>
export type ReorderMediaInput = z.infer<typeof reorderMediaSchema>
export type SignUrlInput = z.infer<typeof signUrlSchema>
export type MediaListParamsInput = z.infer<typeof mediaListParamsSchema>
