'use server'

import { getSupabaseAdminClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { AdminProfile } from '@/lib/types/admin'
import {
    updateUserProfileSchema,
    toggleUserBanSchema,
    resetUserPasswordSchema
} from '@/lib/features/users'
import {
    logUserProfileUpdate,
    logUserBanToggle,
    logUserPasswordReset
} from '@/lib/audit'
import type { UpdateUserProfileData, UserListParams, UserListItem } from '@/lib/features/users'

/**
 * 更新用户诚信分
 */
export async function updateUserCreditScore(
    userId: string,
    creditScore: number
): Promise<{ success: boolean; error?: string }> {
    try {
        await requireAdmin(['superadmin', 'admin'])
        const supabase = getSupabaseAdminClient() as any

        if (creditScore < 0 || creditScore > 100) {
            return { success: false, error: '诚信分必须在 0-100 之间' }
        }

        const { error } = await (supabase as any)
            .from('user_profiles')
            .update({ credit_score: creditScore })
            .eq('id', userId)

        if (error) {
            console.error('[用户管理] 更新诚信分失败:', error)
            return { success: false, error: '更新失败' }
        }

        revalidatePath('/dashboard/users')
        return { success: true }
    } catch (error) {
        console.error('[用户管理] 更新诚信分异常:', error)
        return { success: false, error: error instanceof Error ? error.message : '操作异常' }
    }
}

// 注意：现在统一使用 getSupabaseAdminClient() 和 requireAdmin()，不再需要单独创建客户端

// 获取用户列表
export async function getUserList(
    params: UserListParams
): Promise<{
    success: boolean
    data?: {
        users: UserListItem[]
        total: number
        page: number
        limit: number
        hasNext: boolean
        hasPrev: boolean
    }
    error?: string
}> {
    try {
        // 验证管理员权限（只有管理员和超级管理员可以查看用户列表）
        const admin = await requireAdmin(['superadmin', 'admin'])
        console.log('[用户管理] 管理员访问用户列表:', admin.id, admin.role)

        // 使用统一的 Admin 客户端
        const supabase = getSupabaseAdminClient()

        // 构建查询 - 包含所有必要字段
        let query = supabase
            .from('user_profiles')
            .select(`
                id,
                username,
                display_name,
                avatar_url,
                phone_country_code,
                phone_number,
                country_code,
                language_code,
                level,
                experience,
                credit_score,
                is_whitelisted,
                is_banned,
                last_login_at,
                created_at,
                updated_at
            `, { count: 'exact' })

        // 搜索过滤（支持 ID、邮箱、昵称、用户名、手机号）
        if (params.search) {
            const searchTerm = params.search.trim()
            // 尝试匹配 UUID 格式
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(searchTerm)

            if (isUUID) {
                // 精确匹配 ID
                query = query.eq('id', searchTerm)
            } else {
                // 检查是否为邮箱格式（包含 @）
                const isEmail = searchTerm.includes('@')

                if (isEmail) {
                    // 邮箱搜索：先从 auth.users 查询匹配的用户 ID
                    const { data: authUsers } = await supabase.auth.admin.listUsers()
                    const matchedUserIds = authUsers?.users
                        ?.filter(u => u.email?.toLowerCase().includes(searchTerm.toLowerCase()))
                        ?.map(u => u.id) || []

                    if (matchedUserIds.length > 0) {
                        // 使用匹配到的用户 ID 进行查询
                        query = query.in('id', matchedUserIds)
                    } else {
                        // 没有匹配的邮箱，返回空结果
                        query = query.eq('id', '00000000-0000-0000-0000-000000000000')
                    }
                } else {
                    // 模糊匹配其他字段（不区分大小写）
                    query = query.or(`display_name.ilike.%${searchTerm}%,username.ilike.%${searchTerm}%,phone_number.ilike.%${searchTerm}%`)
                }
            }
        }

        // 其他过滤条件
        if (params.country_code) {
            query = query.eq('country_code', params.country_code)
        }

        if (params.language_code) {
            query = query.eq('language_code', params.language_code)
        }

        if (typeof params.is_banned === 'boolean') {
            query = query.eq('is_banned', params.is_banned)
        }

        if (params.level) {
            query = query.eq('level', params.level)
        }

        // 日期范围过滤
        if (params.date_from) {
            query = query.gte('created_at', params.date_from)
        }

        if (params.date_to) {
            query = query.lte('created_at', params.date_to)
        }

        // 排序
        const sortColumn = params.sort_by || 'created_at'
        const sortOrder = params.sort_order || 'desc'
        query = query.order(sortColumn, { ascending: sortOrder === 'asc' })

        // 分页
        const limit = params.limit || 20
        const offset = ((params.page || 1) - 1) * limit
        query = query.range(offset, offset + limit - 1)

        const { data: users, error, count } = await query

        if (error) {
            console.error('[用户管理] 查询失败:', error)
            return { success: false, error: '获取用户列表失败' }
        }

        // 获取用户邮箱（从 auth.users 表）
        const userIds = users?.map((u: { id: string }) => u.id) || []
        const userEmails: Record<string, string | null> = {}

        if (userIds.length > 0) {
            // 使用 admin API 批量获取用户信息（包括邮箱）
            const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()

            if (!authError && authUsers?.users) {
                authUsers.users.forEach((authUser) => {
                    if (userIds.includes(authUser.id)) {
                        userEmails[authUser.id] = authUser.email || null
                    }
                })
            }
        }

        // 合并邮箱到用户数据
        const usersWithEmail: UserListItem[] = (users || []).map((user: any) => ({
            ...user,
            email: userEmails[user.id] || null
        }))

        return {
            success: true,
            data: {
                users: usersWithEmail,
                total: count || 0,
                page: params.page || 1,
                limit: limit,
                hasNext: (users?.length || 0) === limit,
                hasPrev: offset > 0
            }
        }
    } catch (error) {
        console.error('[用户管理] 查询异常:', error)
        return { success: false, error: '获取用户列表失败，请稍后重试' }
    }
}

// 更新用户资料
export async function updateUserProfile(
    targetUserId: string,
    data: UpdateUserProfileData
): Promise<{ success: boolean; error?: string }> {
    try {
        // 验证管理员权限（只有超级管理员可以更新用户资料）
        const admin = await requireAdmin(['superadmin'])

        // 验证输入数据
        const validatedData = updateUserProfileSchema.parse(data)

        const supabase = getSupabaseAdminClient()

        // 获取更新前的数据（用于审计日志）
        const { data: currentProfile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', targetUserId)
            .single()

        if (!currentProfile) {
            return { success: false, error: '用户不存在' }
        }

        // 更新用户资料
        const { error } = await (supabase as any)
            .from('user_profiles')
            .update({
                ...validatedData,
                updated_at: new Date().toISOString()
            })
            .eq('id', targetUserId)

        if (error) {
            console.error('Update user profile error:', error)
            return { success: false, error: '更新失败' }
        }

        // 记录审计日志
        try {
            const changes: Record<string, unknown> = {}
            const previousValues: Record<string, unknown> = {}

            Object.keys(validatedData).forEach(key => {
                const newValue = (validatedData as Record<string, unknown>)[key]
                const oldValue = (currentProfile as Record<string, unknown>)[key]
                if (newValue !== oldValue) {
                    changes[key] = newValue
                    previousValues[key] = oldValue
                }
            })

            if (Object.keys(changes).length > 0) {
                await logUserProfileUpdate(admin.id, targetUserId, changes, previousValues)
            }
        } catch (auditError) {
            console.error('Failed to log user profile update:', auditError)
            // 不因审计日志失败而影响主操作
        }

        revalidatePath('/dashboard/users')
        revalidatePath(`/dashboard/users/${targetUserId}`)

        return { success: true }
    } catch (error) {
        console.error('Update user profile error:', error)
        return { success: false, error: '更新失败，请稍后重试' }
    }
}

// 切换用户封禁状态
export async function toggleUserBan(
    data: {
        user_id: string
        is_banned: boolean
        reason?: string
    }
): Promise<{ success: boolean; error?: string }> {
    try {
        // 验证管理员权限（超级管理员和管理员都可以封禁/解封用户）
        const admin = await requireAdmin(['superadmin', 'admin'])

        // 验证输入数据
        const validatedData = toggleUserBanSchema.parse(data)

        const supabase = getSupabaseAdminClient()

        // 更新用户封禁状态
        const { error } = await (supabase as any)
            .from('user_profiles')
            .update({
                is_banned: validatedData.is_banned,
                updated_at: new Date().toISOString()
            })
            .eq('id', validatedData.user_id)

        if (error) {
            console.error('Toggle user ban error:', error)
            return { success: false, error: '操作失败' }
        }

        // 记录审计日志
        try {
            await logUserBanToggle(
                admin.id,
                validatedData.user_id,
                validatedData.is_banned,
                validatedData.reason
            )
        } catch (auditError) {
            console.error('Failed to log user ban toggle:', auditError)
            // 不因审计日志失败而影响主操作
        }

        revalidatePath('/dashboard/users')
        revalidatePath(`/dashboard/users/${validatedData.user_id}`)

        return { success: true }
    } catch (error) {
        console.error('Toggle user ban error:', error)
        return { success: false, error: '操作失败，请稍后重试' }
    }
}

// 重置用户密码
export async function resetUserPassword(
    data: {
        user_id: string
        new_password: string
    }
): Promise<{ success: boolean; error?: string }> {
    try {
        // 验证管理员权限（只有超级管理员可以重置用户密码）
        const admin = await requireAdmin(['superadmin'])

        // 验证输入数据
        const validatedData = resetUserPasswordSchema.parse(data)

        // 使用 Service Role 客户端调用 Admin API
        const supabase = getSupabaseAdminClient()

        // 重置用户密码
        const { error } = await supabase.auth.admin.updateUserById(
            validatedData.user_id,
            { password: validatedData.new_password }
        )

        if (error) {
            console.error('Reset user password error:', error)
            return { success: false, error: '重置密码失败' }
        }

        // 记录审计日志
        try {
            await logUserPasswordReset(admin.id, validatedData.user_id)
        } catch (auditError) {
            console.error('Failed to log user password reset:', auditError)
            // 不因审计日志失败而影响主操作
        }

        return { success: true }
    } catch (error) {
        console.error('Reset user password error:', error)
        return { success: false, error: '重置密码失败，请稍后重试' }
    }
}

/**
 * 获取用户详细信息（包含 auth.users 邮箱）
 */
export async function getUserDetail(userId: string): Promise<{
    success: boolean
    data?: any
    error?: string
}> {
    try {
        const admin = await requireAdmin(['superadmin', 'admin'])
        const supabase = getSupabaseAdminClient()

        // 获取用户资料
        const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .single()

        if (profileError || !profile) {
            console.error('[用户详情] 查询失败:', profileError)
            return { success: false, error: '用户不存在' }
        }

        // 获取邮箱（从 auth.users）
        const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId)

        if (authError) {
            console.error('[用户详情] 获取邮箱失败:', authError)
        }

        return {
            success: true,
            data: {
                ...(profile as any),
                email: authUser?.user?.email || null
            }
        }
    } catch (error) {
        console.error('[用户详情] 查询异常:', error)
        return { success: false, error: '获取用户详情失败' }
    }
}

/**
 * 切换用户白名单状态
 */
export async function toggleUserWhitelist(
    data: {
        user_id: string
        is_whitelisted: boolean
    }
): Promise<{ success: boolean; error?: string }> {
    try {
        const admin = await requireAdmin(['superadmin', 'admin'])
        const supabase = getSupabaseAdminClient()

        const { error } = await (supabase as any)
            .from('user_profiles')
            .update({
                is_whitelisted: data.is_whitelisted,
                updated_at: new Date().toISOString()
            })
            .eq('id', data.user_id)

        if (error) {
            console.error('[白名单切换] 更新失败:', error)
            return { success: false, error: '操作失败' }
        }

        console.log(`[白名单切换] 用户 ${data.user_id} 白名单状态更新为 ${data.is_whitelisted}, 操作人: ${admin.display_name}`)

        revalidatePath('/dashboard/users')
        revalidatePath(`/dashboard/users/${data.user_id}`)

        return { success: true }
    } catch (error) {
        console.error('[白名单切换] 操作异常:', error)
        return { success: false, error: '操作失败，请稍后重试' }
    }
}

/**
 * 发送系统通知给用户
 */
export async function sendSystemNotificationToUser(
    userId: string,
    content: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
        const admin = await requireAdmin(['superadmin', 'admin'])
        const supabase = getSupabaseAdminClient()

        if (!content || content.trim().length === 0) {
            return { success: false, error: '通知内容不能为空' }
        }

        if (content.length > 1000) {
            return { success: false, error: '通知内容不能超过1000字符' }
        }

        // 调用 RPC 函数发送系统通知
        const { data: messageId, error } = await (supabase as any)
            .rpc('send_system_notification_to_customer', {
                p_customer_id: userId,
                p_content: content.trim()
            })

        if (error) {
            console.error('[系统通知] 发送失败:', error)
            return { success: false, error: '发送通知失败' }
        }

        console.log(`[系统通知] 用户 ${userId} 收到系统通知, 消息ID: ${messageId}, 操作人: ${admin.display_name}`)

        return { success: true, messageId }
    } catch (error) {
        console.error('[系统通知] 发送异常:', error)
        return { success: false, error: error instanceof Error ? error.message : '发送通知失败' }
    }
}

/**
 * 获取用户预订历史记录
 */
export async function getUserBookingHistory(
    userId: string,
    page = 1,
    limit = 20
): Promise<{ ok: boolean; data?: { orders: any[]; total: number; page: number; limit: number; totalPages: number }; error?: string }> {
    try {
        const admin = await requireAdmin(['superadmin', 'admin', 'support'])
        const supabase = getSupabaseAdminClient()

        // 判断是否需要过滤 sort_order < 998 的技师订单
        const shouldFilterSortOrder = admin.role !== 'superadmin' && admin.role !== 'admin'

        // 如果需要过滤，先获取允许的技师ID列表
        let allowedGirlIds: string[] | null = null
        if (shouldFilterSortOrder) {
            const { data: girls } = await supabase
                .from('girls')
                .select('id')
                .gte('sort_order', 998)
            allowedGirlIds = girls ? girls.map((g: any) => g.id) : []

            // 如果没有允许的技师，返回空结果
            if (allowedGirlIds.length === 0) {
                return {
                    ok: true,
                    data: {
                        orders: [],
                        total: 0,
                        page,
                        limit,
                        totalPages: 0
                    }
                }
            }
        }

        // 构建查询
        let query = supabase
            .from('orders')
            .select(`
                id,
                order_number,
                status,
                total_amount,
                created_at,
                girl_id,
                service_duration_id,
                girls:girl_id (
                    id,
                    girl_number,
                    name
                ),
                service_durations:service_duration_id (
                    services:service_id (
                        title
                    )
                )
            `, { count: 'exact' })
            .eq('user_id', userId)
            .order('created_at', { ascending: false })

        // 应用技师过滤
        if (shouldFilterSortOrder && allowedGirlIds) {
            query = query.in('girl_id', allowedGirlIds)
        }

        // 获取总数
        const { count } = await query

        // 分页查询
        const offset = (page - 1) * limit
        const { data: orders, error } = await query
            .range(offset, offset + limit - 1)

        if (error) {
            console.error('[用户预订历史] 查询失败:', error)
            return { ok: false, error: '获取预订历史失败' }
        }

        // 格式化数据
        const formattedOrders = orders.map((order: any) => ({
            ...order,
            girl: order.girls,
            service_name: order.service_durations?.services?.title
        }))

        const total = count || 0
        const totalPages = Math.ceil(total / limit)

        return {
            ok: true,
            data: {
                orders: formattedOrders,
                total,
                page,
                limit,
                totalPages
            }
        }
    } catch (error) {
        console.error('[用户预订历史] 异常:', error)
        return { ok: false, error: error instanceof Error ? error.message : '获取预订历史异常' }
    }
}

