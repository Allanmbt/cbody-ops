import { z } from "zod"

const languageContentSchema = z.object({
    en: z.string().optional(),
    zh: z.string().optional(),
    th: z.string().optional(),
}).refine(data => data.en || data.zh || data.th, {
    message: "至少需要填写一种语言的内容",
    path: ["en"],
})

const workHoursSchema = z.object({
    start: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "请输入有效的时间格式 (HH:MM)"),
    end: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "请输入有效的时间格式 (HH:MM)"),
})

const languagesSchema = z.record(z.string(), z.number().min(1).max(5)).optional()

export const girlFormSchema = z.object({
    girl_number: z.number({ message: "工号不能为空" })
        .int("工号必须是整数")
        .min(1, "工号必须大于0"),
    username: z.string({ message: "用户名不能为空" })
        .min(3, "用户名至少3个字符")
        .max(50, "用户名不能超过50个字符")
        .regex(/^[a-zA-Z0-9_-]+$/, "用户名只能包含字母、数字、下划线和连字符"),
    name: z.string({ message: "昵称不能为空" })
        .min(1, "昵称不能为空")
        .max(50, "昵称不能超过50个字符"),
    profile: languageContentSchema,
    avatar_url: z.string().url("请输入有效的URL").optional().or(z.literal("")),
    birth_date: z.string().optional().or(z.literal("")),
    height: z.number().int("身高必须是整数").min(100, "身高至少100cm").max(250, "身高不能超过250cm").optional(),
    weight: z.number().int("体重必须是整数").min(30, "体重至少30kg").max(200, "体重不能超过200kg").optional(),
    measurements: z.string().max(15, "三围不能超过15个字符").optional().or(z.literal("")),
    gender: z.union([z.literal(0), z.literal(1)], { message: "请选择性别" }),
    languages: languagesSchema,
    tags: languageContentSchema,
    badge: z.enum(['new', 'hot', 'top_rated']).nullable().optional(),
    max_travel_distance: z.number({ message: "服务距离不能为空" })
        .int("服务距离必须是整数")
        .min(1, "服务距离至少1km")
        .max(100, "服务距离不能超过100km"),
    work_hours: workHoursSchema.optional(),
    is_verified: z.boolean().default(false),
    is_blocked: z.boolean().default(false),
    is_visible_to_thai: z.boolean().default(true),
    sort_order: z.number().int("排序权重必须是整数").min(0).max(9999).default(999),
    city_id: z.number().int("请选择有效的城市").optional(),
    category_id: z.number().int("请选择有效的分类").optional(),
})

export const girlStatusSchema = z.object({
    status: z.enum(['available', 'busy', 'offline'], { message: "请选择状态" }),
    current_lat: z.number().min(-90).max(90).optional(),
    current_lng: z.number().min(-180).max(180).optional(),
    standby_lat: z.number().min(-90).max(90).optional(),
    standby_lng: z.number().min(-180).max(180).optional(),
    next_available_time: z.string().optional().or(z.literal("")),
    auto_status_update: z.boolean().default(false),
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
    search: z.string().optional(),
    city_id: z.number().int().optional(),
    category_id: z.number().int().optional(),
    status: z.enum(['available', 'busy', 'offline']).optional(),
    is_verified: z.boolean().optional(),
    is_blocked: z.boolean().optional(),
    badge: z.enum(['new', 'hot', 'top_rated']).optional(),
    sort_by: z.enum(['created_at', 'updated_at', 'rating', 'total_sales', 'booking_count', 'sort_order']).default('sort_order'),
    sort_order: z.enum(['asc', 'desc']).default('asc'),
})

export type GirlFormData = z.infer<typeof girlFormSchema>
export type GirlStatusData = z.infer<typeof girlStatusSchema>
export type GirlMediaData = z.infer<typeof girlMediaSchema>
export type GirlListParams = z.infer<typeof girlListParamsSchema>
