import { z } from "zod"

// 必填的多语言内容验证（例如：profile）
const languageContentSchema = z.object({
    en: z.string().optional(),
    zh: z.string().optional(),
    th: z.string().optional(),
}).refine(
    data => {
        // 至少有一个语言字段有非空内容
        const hasContent = Boolean(
            (data.en && data.en.trim()) ||
            (data.zh && data.zh.trim()) ||
            (data.th && data.th.trim())
        )
        return hasContent
    },
    {
        message: "请至少填写一种语言的内容（中文、英文或泰文）",
        path: ["zh"], // 指向中文字段
    }
)

// 可选的多语言内容验证（例如：tags），允许空字符串
const optionalLanguageContentSchema = z.object({
    en: z.string().optional(),
    zh: z.string().optional(),
    th: z.string().optional(),
}).default({ en: '', zh: '', th: '' })

// 语言代码数组: 仅允许预置选项
const validLanguageCodes = ['EN_Base', 'EN', 'ZH_Base', 'ZH', 'TH_Base', 'TH', 'KO_Base', 'KO', 'YUE_Base', 'YUE', 'JA_Base', 'JA'] as const
const languagesSchema = z.array(z.enum(validLanguageCodes)).optional()

export const girlFormSchema = z.object({
    user_id: z.string().uuid("请输入有效的用户ID").nullable().optional(),
    telegram_id: z.number().int("Telegram ID必须是整数").nullable().optional(),
    username: z.string({ message: "用户名不能为空" })
        .min(3, "用户名至少3个字符")
        .max(50, "用户名不能超过50个字符")
        .regex(/^[a-zA-Z0-9_-]+$/, "用户名只能包含字母、数字、下划线和连字符"),
    name: z.string({ message: "昵称不能为空" })
        .min(1, "昵称不能为空")
        .max(50, "昵称不能超过50个字符"),
    profile: languageContentSchema,
    avatar_url: z.string().url("请输入有效的URL").nullable().optional().or(z.literal("")),
    birth_date: z.string().nullable().optional().or(z.literal("")),
    height: z.number().int("身高必须是整数").min(100, "身高至少100cm").max(250, "身高不能超过250cm").nullable().optional(),
    weight: z.number().int("体重必须是整数").min(30, "体重至少30kg").max(200, "体重不能超过200kg").nullable().optional(),
    measurements: z.string().max(15, "三围不能超过15个字符").nullable().optional().or(z.literal("")),
    gender: z.union([z.literal(0), z.literal(1)], { message: "请选择性别" }),
    languages: languagesSchema,
    tags: languageContentSchema,
    badge: z.enum(['new', 'hot', 'top_rated']).nullable().optional(),
    rating: z.number().min(0).max(5).default(0),
    total_sales: z.number().int().min(0).default(0),
    total_reviews: z.number().int().min(0).default(0),
    max_travel_distance: z.number({ message: "服务距离不能为空" })
        .int("服务距离必须是整数")
        .min(1, "服务距离至少1km")
        .max(100, "服务距离不能超过100km"),
    trust_score: z.number().int().min(0).max(100).default(80),
    is_verified: z.boolean().default(false),
    is_blocked: z.boolean().default(false),
    is_visible_to_thai: z.boolean().default(true),
    sort_order: z.number().int("排序权重必须是整数").min(0).max(9999).default(999),
    city_id: z.number({ message: "请选择城市" }).int("请选择有效的城市"),
    category_ids: z.array(z.number().int()).min(1, "请至少选择一个分类"), // 多对多分类，至少选一个
})

export const girlStatusSchema = z.object({
    status: z.enum(['available', 'busy', 'offline'], { message: "请选择状态" }),
    current_lat: z.number().min(-90).max(90).nullable().optional(),
    current_lng: z.number().min(-180).max(180).nullable().optional(),
    next_available_time: z.string().nullable().optional(),
})

export const girlMediaSchema = z.object({
    media_type: z.enum(['image', 'video'], { message: "请选择媒体类型" }),
    url: z.string({ message: "媒体URL不能为空" }).url("请输入有效的URL"),
    thumbnail_url: z.string().url("请输入有效的缩略图URL").optional().or(z.literal("")),
    sort_order: z.number().int("排序必须是整数").min(0).max(999).default(0),
})

export const girlListParamsSchema = z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
    search: z.string().optional(), // 搜索 username/girl_number/telegram_id
    city_id: z.number().int().optional(),
    category_id: z.number().int().optional(),
    status: z.enum(['available', 'busy', 'offline']).optional(),
    is_verified: z.boolean().optional(),
    is_blocked: z.boolean().optional(), // 屏蔽状态筛选
    sort_by: z.enum(['created_at', 'updated_at', 'rating', 'total_sales', 'trust_score', 'sort_order']).default('sort_order'),
    sort_order: z.enum(['asc', 'desc']).default('asc'),
})

export type GirlFormData = z.infer<typeof girlFormSchema>
export type GirlStatusData = z.infer<typeof girlStatusSchema>
export type GirlMediaData = z.infer<typeof girlMediaSchema>
export type GirlListParams = z.infer<typeof girlListParamsSchema>
