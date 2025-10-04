import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// 审计日志操作类型
export type AdminOperationType =
    | 'update_user_profile'
    | 'toggle_user_ban'
    | 'reset_user_password'
    | 'update_admin_profile'
    | 'reset_admin_password'
    | 'toggle_admin_status'

// 审计日志记录函数
export async function logAdminOperation(
    actorId: string,
    operationType: AdminOperationType,
    operationDetails: Record<string, unknown>,
    targetAdminId?: string | null,
    targetUserId?: string | null
): Promise<void> {
    const supabase = createServerComponentClient({ cookies })

    try {
        // 构建审计日志数据
        const logData: Record<string, unknown> = {
            operator_id: actorId,
            operation_type: operationType,
            operation_details: {
                ...operationDetails,
                // 如果操作的是用户，将用户ID记录在operation_details中
                ...(targetUserId && { target_user_id: targetUserId }),
                timestamp: new Date().toISOString()
            }
        }

        // 如果有目标管理员ID，则设置target_admin_id
        if (targetAdminId) {
            logData.target_admin_id = targetAdminId
        }

        const { error } = await supabase
            .from('admin_operation_logs')
            .insert(logData)

        if (error) {
            console.error('Failed to log admin operation:', error)
            throw new Error(`审计日志记录失败: ${error.message}`)
        }
    } catch (error) {
        console.error('Error logging admin operation:', error)
        throw error
    }
}

// 记录用户资料更新操作
export async function logUserProfileUpdate(
    actorId: string,
    targetUserId: string,
    changes: Record<string, unknown>,
    previousValues?: Record<string, unknown>
): Promise<void> {
    await logAdminOperation(
        actorId,
        'update_user_profile',
        {
            changes,
            previous_values: previousValues,
            action: 'update_user_profile'
        },
        null, // target_admin_id
        targetUserId
    )
}

// 记录用户封禁/解禁操作
export async function logUserBanToggle(
    actorId: string,
    targetUserId: string,
    isBanned: boolean,
    reason?: string
): Promise<void> {
    await logAdminOperation(
        actorId,
        'toggle_user_ban',
        {
            is_banned: isBanned,
            reason: reason || null,
            action: isBanned ? 'ban_user' : 'unban_user'
        },
        null, // target_admin_id
        targetUserId
    )
}

// 记录用户密码重置操作
export async function logUserPasswordReset(
    actorId: string,
    targetUserId: string
): Promise<void> {
    await logAdminOperation(
        actorId,
        'reset_user_password',
        {
            action: 'reset_user_password',
            note: '已触发密码重置'
        },
        null, // target_admin_id
        targetUserId
    )
}

// 记录管理员资料更新操作
export async function logAdminProfileUpdate(
    actorId: string,
    targetAdminId: string,
    changes: Record<string, unknown>,
    previousValues?: Record<string, unknown>
): Promise<void> {
    await logAdminOperation(
        actorId,
        'update_admin_profile',
        {
            changes,
            previous_values: previousValues,
            action: 'update_admin_profile'
        },
        targetAdminId
    )
}

// 记录管理员密码重置操作
export async function logAdminPasswordReset(
    actorId: string,
    targetAdminId: string
): Promise<void> {
    await logAdminOperation(
        actorId,
        'reset_admin_password',
        {
            action: 'reset_admin_password',
            note: '已触发密码重置'
        },
        targetAdminId
    )
}

// 记录管理员状态切换操作
export async function logAdminStatusToggle(
    actorId: string,
    targetAdminId: string,
    isActive: boolean
): Promise<void> {
    await logAdminOperation(
        actorId,
        'toggle_admin_status',
        {
            is_active: isActive,
            action: isActive ? 'activate_admin' : 'deactivate_admin'
        },
        targetAdminId
    )
}
