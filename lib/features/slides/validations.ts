import { z } from 'zod'

export const SLIDES_BUCKET = 'home-slides'
export const SLIDE_MAX_BYTES = 5 * 1024 * 1024
export const SLIDE_MIME_EXTENSIONS = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
} as const

export const slideSlotSchema = z.number().int().min(1).max(3)
export const slideImagePathSchema = z.string().regex(
    /^[1-3]\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/,
    '图片路径格式不正确',
)

// 对原始和一次解码的值都校验，避免编码的斜杠或控制字符绕过检查。
export function isValidSlideTarget(type: string, target: string): boolean {
    if (type === 'none') return target === ''
    if (!target || target !== target.trim() || /[\s\\\u0000-\u001f\u007f]/.test(target)) return false
    let decoded: string
    try { decoded = decodeURIComponent(target) } catch { return false }
    if (/[\\\u0000-\u001f\u007f]/.test(decoded)) return false
    if (type === 'internal') return target.startsWith('/') && !target.startsWith('//') && !decoded.startsWith('//')
    if (type !== 'external' || !target.startsWith('https://')) return false
    try {
        const url = new URL(target)
        return Boolean(url.hostname) && !url.username && !url.password
    } catch { return false }
}

export const slideLinkFormSchema = z.object({
    link_type: z.enum(['none', 'internal', 'external']),
    link_target: z.string().max(2048, '跳转地址不能超过 2048 字符'),
}).refine(data => isValidSlideTarget(data.link_type, data.link_target), {
    message: '请填写有效的应用内路径或 HTTPS 地址；不跳转时请清空地址',
    path: ['link_target'],
})

export const saveSlideSchema = slideLinkFormSchema.safeExtend({
    slot: slideSlotSchema,
    image_path: slideImagePathSchema,
    image_paths: z.object({
        en: slideImagePathSchema.optional(),
        zh: slideImagePathSchema.optional(),
        th: slideImagePathSchema.optional(),
    }).strict().refine(paths => Object.values(paths).some(Boolean), '请至少上传一种语言封面').optional(),
    expected_updated_at: z.iso.datetime({ offset: true }).nullable(),
}).refine(data => [data.image_path, ...Object.values(data.image_paths || {})].every(path => path.startsWith(`${data.slot}/`)), {
    message: '图片不属于当前幻灯片位置', path: ['image_path'],
})

export const slideUploadSchema = z.object({
    slot: slideSlotSchema,
    mime: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    size: z.number().int().positive().max(SLIDE_MAX_BYTES, '图片不能超过 5 MiB'),
})

export const deleteSlideSchema = z.object({
    slot: slideSlotSchema,
    expected_updated_at: z.iso.datetime({ offset: true }),
})

export type SlideLinkFormData = z.infer<typeof slideLinkFormSchema>
