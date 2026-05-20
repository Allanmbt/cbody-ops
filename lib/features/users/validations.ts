import { z } from 'zod'

const adminTagsSchema = z.array(
    z.string().trim().min(1, 'Tag cannot be empty').max(20, 'Tag must be at most 20 chars')
)
    .max(10, 'At most 10 admin tags')
    .transform((tags) => Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean))))

export const updateUserProfileSchema = z.object({
    display_name: z.string().min(1, 'Display name cannot be empty').max(50, 'Display name must be at most 50 chars').optional(),
    username: z.string().min(1, 'Username cannot be empty').max(50, 'Username must be at most 50 chars').optional(),
    language_code: z.enum(['en', 'zh', 'th']).optional(),
    timezone: z.string().max(50, 'Timezone must be at most 50 chars').optional(),
    level: z.number().int().min(1, 'Level must be at least 1').max(10, 'Level must be at most 10').optional(),
    credit_score: z.number().int().min(0, 'Credit score must be at least 0').max(1000, 'Credit score must be at most 1000').optional(),
    admin_tags: adminTagsSchema.optional(),
    is_banned: z.boolean().optional()
})

export const toggleUserBanSchema = z.object({
    user_id: z.string().uuid('Invalid user ID'),
    is_banned: z.boolean(),
    reason: z.string().max(200, 'Reason must be at most 200 chars').optional()
})

export const resetUserPasswordSchema = z.object({
    user_id: z.string().uuid('Invalid user ID'),
    new_password: z.string().min(8, 'Password must be at least 8 chars').max(50, 'Password must be at most 50 chars')
})

export const userListParamsSchema = z.object({
    search: z.string().max(100, 'Search keyword must be at most 100 chars').optional(),
    country_code: z.string().length(2, 'Country code must be 2 chars').optional(),
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

export const userIdSchema = z.object({
    id: z.string().uuid('Invalid user ID')
})

export const paginationSchema = z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
    cursor: z.string().optional()
})

export const countryCodeSchema = z.string()
    .length(2, 'Country code must be 2 chars')
    .regex(/^[A-Z]{2}$/, 'Country code must be uppercase letters')

export const languageCodeSchema = z.enum(['en', 'zh', 'th'])

export const genderSchema = z.number().int().min(0).max(2)

export const userLevelSchema = z.number().int().min(1).max(10)

export const creditScoreSchema = z.number().int().min(0).max(1000)
