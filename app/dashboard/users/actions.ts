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
        console.log('Admin accessing user list:', admin.id, admin.role)

        // 使用统一的 Admin 客户端
        const supabase = getSupabaseAdminClient()

        // 构建查询
        let query = supabase
            .from('user_profiles')
            .select(`
                id,
                username,
                display_name,
                avatar_url,
                country_code,
                language_code,
                level,
                credit_score,
                is_banned,
                created_at,
                updated_at
            `, { count: 'exact' })

        // 搜索过滤
        if (params.search) {
            query = query.or(`display_name.ilike.%${params.search}%,username.ilike.%${params.search}%`)
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
            console.error('Error fetching users:', error)
            return { success: false, error: '获取用户列表失败' }
        }

        // 获取每个用户的最后登录时间
        const userIds = users?.map((u: { id: string }) => u.id) || []
        let lastLoginTimes: Record<string, string> = {}

        if (userIds.length > 0) {
            const { data: loginEvents } = await supabase
                .from('user_login_events')
                .select('user_id, logged_at')
                .in('user_id', userIds)
                .order('logged_at', { ascending: false })

            // 为每个用户找到最新的登录时间
            if (loginEvents) {
                const userLastLogins: Record<string, string> = {}
                loginEvents.forEach((event: { user_id: string; logged_at: string }) => {
                    if (!userLastLogins[event.user_id]) {
                        userLastLogins[event.user_id] = event.logged_at
                    }
                })
                lastLoginTimes = userLastLogins
            }
        }

        // 合并登录时间到用户数据
        const usersWithLastLogin: UserListItem[] = (users || []).map((user: any) => ({
            ...user,
            last_login_at: lastLoginTimes[user.id]
        }))

        return {
            success: true,
            data: {
                users: usersWithLastLogin,
                total: count || 0,
                page: params.page || 1,
                limit: limit,
                hasNext: (users?.length || 0) === limit,
                hasPrev: offset > 0
            }
        }
    } catch (error) {
        console.error('Get user list error:', error)
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
        // 验证管理员权限（只有超级管理员可以封禁/解封用户）
        const admin = await requireAdmin(['superadmin'])

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
