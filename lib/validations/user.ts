import { z } from 'zod'

// 用户资料更新验证
export const updateUserProfileSchema = z.object({
    display_name: z.string().min(1, '显示名称不能为空').max(50, '显示名称最长50个字符').optional(),
    username: z.string().min(1, '用户名不能为空').max(50, '用户名最长50个字符').optional(),
    language_code: z.enum(['en', 'zh', 'th']).optional(),
    timezone: z.string().max(50, '时区字符串最长50个字符').optional(),
    level: z.number().int().min(1, '用户等级最小为1').max(10, '用户等级最大为10').optional(),
    credit_score: z.number().int().min(0, '信用分最小为0').max(1000, '信用分最大为1000').optional(),
    is_banned: z.boolean().optional()
})

// 封禁/解禁验证
export const toggleUserBanSchema = z.object({
    user_id: z.string().uuid('无效的用户ID'),
    is_banned: z.boolean(),
    reason: z.string().max(200, '封禁原因最长200个字符').optional()
})

// 重置密码验证
export const resetUserPasswordSchema = z.object({
    user_id: z.string().uuid('无效的用户ID'),
    new_password: z.string().min(8, '密码至少8个字符').max(50, '密码最长50个字符')
})

// 用户列表查询参数验证
export const userListParamsSchema = z.object({
    search: z.string().max(100, '搜索关键词最长100个字符').optional(),
    country_code: z.string().length(2, '国家代码必须是2个字符').optional(),
    language_code: z.enum(['en', 'zh', 'th']).optional(),
    is_banned: z.boolean().optional(),
    level: z.number().int().min(1).max(10).optional(),
    date_from: z.string().datetime().optional(),
    date_to: z.string().datetime().optional(),
    sort_by: z.enum(['created_at', 'level', 'credit_score']).default('created_at'),
    sort_order: z.enum(['asc', 'desc']).default('desc'),
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
    cursor: z.string().optional()
})

// 用户ID验证
export const userIdSchema = z.object({
    id: z.string().uuid('无效的用户ID')
})

// 分页参数验证
export const paginationSchema = z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
    cursor: z.string().optional()
})

// 国家代码验证
export const countryCodeSchema = z.string().length(2, '国家代码必须是2个字符').regex(/^[A-Z]{2}$/, '国家代码必须是大写字母')

// 语言代码验证
export const languageCodeSchema = z.enum(['en', 'zh', 'th'])

// 性别验证
export const genderSchema = z.number().int().min(0).max(2)

// 用户等级验证
export const userLevelSchema = z.number().int().min(1).max(10)

// 信用分验证
export const creditScoreSchema = z.number().int().min(0).max(1000)
