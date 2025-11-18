import { z } from "zod"

// 多语言文本验证模式
const multiLanguageTextSchema = z.object({
    en: z.string(),
    zh: z.string(),
    th: z.string()
})

// 服务徽章验证模式
const serviceBadgeSchema = z.enum(['TOP_PICK', 'HOT', 'NEW']).nullable()

// 服务表单验证模式
export const serviceFormSchema = z.object({
    code: z.string()
        .min(1, "服务代码不能为空")
        .max(50, "服务代码不能超过50个字符")
        .regex(/^[a-zA-Z0-9_-]+$/, "服务代码只能包含字母、数字、下划线和连字符"),
    category_id: z.number()
        .int("分类ID必须为整数")
        .positive("请选择分类"),
    title: multiLanguageTextSchema.refine(
        (data) => data.en.trim() || data.zh.trim() || data.th.trim(),
        {
            message: "标题至少需要填写一种语言",
            path: ["title"]
        }
    ),
    description: multiLanguageTextSchema.refine(
        (data) => data.en.trim() || data.zh.trim() || data.th.trim(),
        {
            message: "描述至少需要填写一种语言",
            path: ["description"]
        }
    ),
    badge: serviceBadgeSchema.optional(),
    is_active: z.boolean().default(true),
    is_visible_to_thai: z.boolean().default(true),
    is_visible_to_english: z.boolean().default(true),
    min_user_level: z.number()
        .int("用户等级必须为整数")
        .min(0, "用户等级不能小于0")
        .max(10, "用户等级不能大于10")
        .default(0),
    sort_order: z.number()
        .int("排序必须为整数")
        .min(0, "排序不能小于0")
        .max(9999, "排序不能大于9999")
        .default(999)
})

// 服务时长定价验证模式
export const serviceDurationFormSchema = z.object({
    duration_minutes: z.number()
        .int("时长必须为整数")
        .min(30, "时长不能少于30分钟")
        .max(480, "时长不能超过8小时")
        .refine(
            (val) => [30, 60, 90, 120, 150, 180, 240, 300, 360, 480].includes(val),
            {
                message: "时长必须为30、60、90、120、150、180、240、300、360或480分钟之一"
            }
        ),
    default_price: z.number()
        .int("默认价格必须为整数")
        .min(100, "价格不能低于100泰铢")
        .max(50000, "价格不能超过50000泰铢")
        .refine(
            (val) => val % 100 === 0,
            {
                message: "价格必须为100的整数倍"
            }
        ),
    min_price: z.number()
        .int("最低价格必须为整数")
        .min(100, "最低价格不能低于100泰铢")
        .max(50000, "最低价格不能超过50000泰铢")
        .refine(
            (val) => val % 100 === 0,
            {
                message: "最低价格必须为100的整数倍"
            }
        ),
    max_price: z.number()
        .int("最高价格必须为整数")
        .min(100, "最高价格不能低于100泰铢")
        .max(50000, "最高价格不能超过50000泰铢")
        .refine(
            (val) => val % 100 === 0,
            {
                message: "最高价格必须为100的整数倍"
            }
        ),
    is_active: z.boolean().default(true)
}).refine(
    (data) => data.min_price <= data.default_price,
    {
        message: "最低价格不能高于默认价格",
        path: ["min_price"]
    }
).refine(
    (data) => data.default_price <= data.max_price,
    {
        message: "默认价格不能高于最高价格",
        path: ["default_price"]
    }
).refine(
    (data) => data.min_price <= data.max_price,
    {
        message: "最低价格不能高于最高价格",
        path: ["min_price"]
    }
)

// 服务查询参数验证模式
export const serviceListParamsSchema = z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
    search: z.string().optional(),
    category_id: z.number().int().positive().optional(),
    is_active: z.boolean().optional(),
    sort_by: z.enum(['created_at', 'updated_at', 'total_sales', 'sort_order']).default('sort_order'),
    sort_order: z.enum(['asc', 'desc']).default('asc')
})

// 服务绑定查询参数验证模式
export const serviceBindListParamsSchema = z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
    search: z.string().optional(),
    city_id: z.number().int().positive().optional(),
    category_id: z.number().int().positive().optional(),
    bind_status: z.enum(['all', 'bound-enabled', 'bound-disabled', 'unbound']).default('all'),
    sort_by: z.enum(['girl_number', 'name', 'created_at']).default('girl_number'),
    sort_order: z.enum(['asc', 'desc']).default('asc')
})

// 批量绑定验证模式
export const batchBindSchema = z.object({
    girl_ids: z.array(z.string().uuid()).min(1, "请选择至少一个技师"),
    service_id: z.number().int().positive("服务ID无效"),
    admin_id: z.string().uuid("管理员ID无效")
})

// 批量解绑验证模式
export const batchUnbindSchema = z.object({
    girl_ids: z.array(z.string().uuid()).min(1, "请选择至少一个技师"),
    service_id: z.number().int().positive("服务ID无效"),
    admin_id: z.string().uuid("管理员ID无效"),
    notes: z.string().min(1, "解绑理由不能为空").max(500, "理由不能超过500字符"),
    disable_durations: z.boolean().optional().default(false)
})

// 批量恢复验证模式
export const batchRestoreSchema = z.object({
    girl_ids: z.array(z.string().uuid()).min(1, "请选择至少一个技师"),
    service_id: z.number().int().positive("服务ID无效"),
    admin_id: z.string().uuid("管理员ID无效"),
    notes: z.string().max(500, "备注不能超过500字符").optional()
})

// 类型导出
export type ServiceFormData = z.infer<typeof serviceFormSchema>
export type ServiceDurationFormData = z.infer<typeof serviceDurationFormSchema>
export type ServiceListParams = z.infer<typeof serviceListParamsSchema>
export type ServiceBindListParams = z.infer<typeof serviceBindListParamsSchema>
export type BatchBindData = z.infer<typeof batchBindSchema>
export type BatchUnbindData = z.infer<typeof batchUnbindSchema>
export type BatchRestoreData = z.infer<typeof batchRestoreSchema>
