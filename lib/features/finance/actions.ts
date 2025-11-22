"use server"

/**
 * 财务管理模块 Server Actions
 * 严格按照数据库结构和字段约束实现
 */

import { getSupabaseAdminClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/auth"
import type {
    ApiResponse,
    PaginatedResponse,
    FinanceStats,
    GirlSettlementAccountWithGirl,
    OrderSettlementWithDetails,
    SettlementTransactionWithDetails,
    AccountListFilters,
    SettlementListFilters,
    TransactionListFilters,
} from "./types"
import type { PaginationParams, UpdateDepositData, ApproveTransactionData, RejectTransactionData, UpdateSettlementPaymentData, MarkSettlementAsSettledData } from "./validations"
import { updateDepositSchema, approveTransactionSchema, rejectTransactionSchema, updateSettlementPaymentSchema, markSettlementAsSettledSchema } from "./validations"

// ==================== 统计数据 ====================

/**
 * 获取财务统计数据
 */
export async function getFinanceStats(): Promise<ApiResponse<FinanceStats>> {
    try {
        await requireAdmin(['superadmin', 'admin', 'finance'])

        const supabase = getSupabaseAdminClient()

        // 计算泰国时区的今日和昨日时间范围（以早上6点为新一天的开始）
        const now = new Date()

        // 获取泰国当前时间（UTC+7）
        const bangkokTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))

        // 计算今日6点（泰国时间）
        const todayStart = new Date(bangkokTime)
        todayStart.setHours(6, 0, 0, 0)

        // 如果当前时间还没到今天6点，今日6点应该是昨天的6点
        if (bangkokTime.getHours() < 6) {
            todayStart.setDate(todayStart.getDate() - 1)
        }

        // 昨日6点
        const yesterdayStart = new Date(todayStart)
        yesterdayStart.setDate(yesterdayStart.getDate() - 1)

        // 明日6点（今日结束）
        const tomorrowStart = new Date(todayStart)
        tomorrowStart.setDate(tomorrowStart.getDate() + 1)

        // 并行查询所有统计数据
        const [
            pendingSettlementsResult,
            todayPendingResult,
            yesterdayPendingResult,
            olderPendingResult,
        ] = await Promise.all([
            // 总待核验订单数
            supabase
                .from('order_settlements')
                .select('id', { count: 'exact', head: true })
                .eq('settlement_status', 'pending'),

            // 今日未核验订单数（今日6点至明日6点创建且未核验）
            supabase
                .from('order_settlements')
                .select('id', { count: 'exact', head: true })
                .eq('settlement_status', 'pending')
                .gte('created_at', todayStart.toISOString())
                .lt('created_at', tomorrowStart.toISOString()),

            // 昨日未核验订单数（昨日6点至今日6点创建且未核验）
            supabase
                .from('order_settlements')
                .select('id', { count: 'exact', head: true })
                .eq('settlement_status', 'pending')
                .gte('created_at', yesterdayStart.toISOString())
                .lt('created_at', todayStart.toISOString()),

            // 更早未核验订单数（昨日6点之前创建且未核验）
            supabase
                .from('order_settlements')
                .select('id', { count: 'exact', head: true })
                .eq('settlement_status', 'pending')
                .lt('created_at', yesterdayStart.toISOString()),
        ])

        const stats: FinanceStats = {
            pending_transactions_count: 0,
            pending_settlements_count: pendingSettlementsResult.count || 0,
            total_therapists: 0,
            negative_balance_count: 0,
            positive_balance_count: 0,
            zero_balance_count: 0,
            total_therapist_debt: 0,
            total_platform_debt: 0,
            today_pending_count: todayPendingResult.count || 0,
            yesterday_pending_count: yesterdayPendingResult.count || 0,
            older_pending_count: olderPendingResult.count || 0,
        }

        return { ok: true, data: stats }
    } catch (error) {
        console.error('[getFinanceStats] 获取统计数据失败:', error)
        return {
            ok: false,
            error: error instanceof Error ? error.message : '获取统计数据失败'
        }
    }
}

// ==================== 技师账户管理 ====================

/**
 * 获取技师账户列表（分页）
 */
export async function getSettlementAccounts(
    filters: AccountListFilters = {},
    pagination: PaginationParams = { page: 1, pageSize: 20 }
): Promise<ApiResponse<PaginatedResponse<GirlSettlementAccountWithGirl>>> {
    try {
        await requireAdmin(['superadmin', 'admin', 'finance'])

        const supabase = getSupabaseAdminClient()
        const { page, pageSize } = pagination
        const from = (page - 1) * pageSize
        const to = from + pageSize - 1

        // 构建查询
        let query = supabase
            .from('girl_settlement_accounts')
            .select(`
                *,
                girls (
                    id,
                    girl_number,
                    name,
                    username,
                    avatar_url,
                    city_id,
                    cities (
                        id,
                        name
                    )
                )
            `, { count: 'exact' })

        // 应用筛选条件
        if (filters.search && filters.search.trim()) {
            const searchTerm = filters.search.trim()
            // 尝试解析为数字（工号搜索）
            const searchNumber = parseInt(searchTerm)
            if (!isNaN(searchNumber)) {
                // 如果是数字，搜索工号
                // 注意：在关联表上使用过滤需要特殊语法
                const { data: girlsWithNumber } = await supabase
                    .from('girls')
                    .select('id')
                    .eq('girl_number', searchNumber)

                if (girlsWithNumber && girlsWithNumber.length > 0) {
                    const girlIds = (girlsWithNumber as any[]).map(g => g.id)
                    query = query.in('girl_id', girlIds)
                } else {
                    // 如果没找到，返回空结果
                    query = query.eq('girl_id', '00000000-0000-0000-0000-000000000000')
                }
            } else {
                // 如果不是数字，搜索姓名
                const { data: girlsWithName } = await supabase
                    .from('girls')
                    .select('id')
                    .ilike('name', `%${searchTerm}%`)

                if (girlsWithName && girlsWithName.length > 0) {
                    const girlIds = (girlsWithName as any[]).map(g => g.id)
                    query = query.in('girl_id', girlIds)
                } else {
                    // 如果没找到，返回空结果
                    query = query.eq('girl_id', '00000000-0000-0000-0000-000000000000')
                }
            }
        }

        if (filters.city_id) {
            const { data: girlsInCity } = await supabase
                .from('girls')
                .select('id')
                .eq('city_id', filters.city_id)

            if (girlsInCity && girlsInCity.length > 0) {
                const girlIds = (girlsInCity as { id: string }[]).map(g => g.id)
                query = query.in('girl_id', girlIds)
            }
        }

        if (filters.balance_status) {
            switch (filters.balance_status) {
                case 'negative':
                    query = query.lt('balance', 0)
                    break
                case 'positive':
                    query = query.gt('balance', 0)
                    break
                case 'zero':
                    query = query.eq('balance', 0)
                    break
            }
        }

        if (filters.balance_min !== undefined) {
            query = query.gte('balance', filters.balance_min)
        }

        if (filters.balance_max !== undefined) {
            query = query.lte('balance', filters.balance_max)
        }

        // 排序：负余额在前
        query = query.order('balance', { ascending: true })

        // 分页
        query = query.range(from, to)

        const { data, error, count } = await query

        if (error) throw error

        const totalPages = count ? Math.ceil(count / pageSize) : 0

        return {
            ok: true,
            data: {
                data: data as GirlSettlementAccountWithGirl[],
                total: count || 0,
                page,
                pageSize,
                totalPages,
            }
        }
    } catch (error) {
        console.error('[getSettlementAccounts] 获取账户列表失败:', error)
        return {
            ok: false,
            error: error instanceof Error ? error.message : '获取账户列表失败'
        }
    }
}

/**
 * 获取单个技师账户详情
 */
export async function getSettlementAccountDetail(
    girlId: string
): Promise<ApiResponse<GirlSettlementAccountWithGirl>> {
    try {
        await requireAdmin(['superadmin', 'admin', 'finance'])

        const supabase = getSupabaseAdminClient()

        const { data, error } = await supabase
            .from('girl_settlement_accounts')
            .select(`
                *,
                girls (
                    id,
                    girl_number,
                    name,
                    username,
                    avatar_url,
                    city_id,
                    withdrawal_info,
                    cities (
                        id,
                        name
                    )
                )
            `)
            .eq('girl_id', girlId)
            .single()

        if (error) throw error

        return { ok: true, data: data as GirlSettlementAccountWithGirl }
    } catch (error) {
        console.error('[getSettlementAccountDetail] 获取账户详情失败:', error)
        return {
            ok: false,
            error: error instanceof Error ? error.message : '获取账户详情失败'
        }
    }
}

/**
 * 获取技师的订单结算流水（或所有记录）
 */
export async function getGirlOrderSettlements(
    girlId?: string,
    filters: SettlementListFilters = {},
    pagination: PaginationParams = { page: 1, pageSize: 20 }
): Promise<ApiResponse<PaginatedResponse<OrderSettlementWithDetails>>> {
    try {
        await requireAdmin(['superadmin', 'admin', 'finance'])

        const supabase = getSupabaseAdminClient()
        const { page, pageSize } = pagination
        const from = (page - 1) * pageSize
        const to = from + pageSize - 1

        let query = supabase
            .from('order_settlements')
            .select(`
        *,
        orders!inner (
          id,
          order_number,
          service_name,
          service_duration,
          total_amount,
          completed_at
        ),
        girls!inner (
          id,
          girl_number,
          name,
          username,
          avatar_url
        )
      `, { count: 'exact' })

        // 如果指定了技师ID，则筛选
        if (girlId) {
            query = query.eq('girl_id', girlId)
        }

        // 应用筛选条件
        if (filters.status && filters.status !== 'all') {
            query = query.eq('settlement_status', filters.status)
        }

        if (filters.date_from) {
            query = query.gte('created_at', filters.date_from)
        }

        if (filters.date_to) {
            query = query.lte('created_at', filters.date_to)
        }

        // 排序：最新的在前
        query = query.order('created_at', { ascending: false })

        // 分页
        query = query.range(from, to)

        const { data, error, count } = await query

        if (error) throw error

        const totalPages = count ? Math.ceil(count / pageSize) : 0

        return {
            ok: true,
            data: {
                data: data as OrderSettlementWithDetails[],
                total: count || 0,
                page,
                pageSize,
                totalPages,
            }
        }
    } catch (error) {
        console.error('[getGirlOrderSettlements] 获取订单结算流水失败:', error)
        return {
            ok: false,
            error: error instanceof Error ? error.message : '获取订单结算流水失败'
        }
    }
}

/**
 * 获取技师的申请/调整记录（或所有记录）
 */
export async function getGirlTransactions(
    girlId?: string,
    filters: TransactionListFilters = {},
    pagination: PaginationParams = { page: 1, pageSize: 20 }
): Promise<ApiResponse<PaginatedResponse<SettlementTransactionWithDetails>>> {
    try {
        await requireAdmin(['superadmin', 'admin', 'finance'])

        const supabase = getSupabaseAdminClient()
        const { page, pageSize } = pagination
        const from = (page - 1) * pageSize
        const to = from + pageSize - 1

        let query = supabase
            .from('settlement_transactions')
            .select(`
        *,
        girls (
          id,
          girl_number,
          name,
          username,
          avatar_url
        ),
        orders (
          id,
          order_number
        )
      `, { count: 'exact' })

        // 如果指定了技师ID，则筛选
        if (girlId) {
            query = query.eq('girl_id', girlId)
        }

        // 应用筛选条件
        if (filters.transaction_type && filters.transaction_type !== 'all') {
            query = query.eq('transaction_type', filters.transaction_type)
        }

        if (filters.approval_status && filters.approval_status !== 'all') {
            query = query.eq('approval_status', filters.approval_status)
        }

        if (filters.date_from) {
            query = query.gte('created_at', filters.date_from)
        }

        if (filters.date_to) {
            query = query.lte('created_at', filters.date_to)
        }

        // 排序：最新的在前
        query = query.order('created_at', { ascending: false })

        // 分页
        query = query.range(from, to)

        const { data, error, count } = await query

        if (error) throw error

        const totalPages = count ? Math.ceil(count / pageSize) : 0

        return {
            ok: true,
            data: {
                data: data as SettlementTransactionWithDetails[],
                total: count || 0,
                page,
                pageSize,
                totalPages,
            }
        }
    } catch (error) {
        console.error('[getGirlTransactions] 获取交易记录失败:', error)
        return {
            ok: false,
            error: error instanceof Error ? error.message : '获取交易记录失败'
        }
    }
}

// ==================== 待处理事项 ====================

/**
 * 获取最近待处理事项（用于 Dashboard）
 */
export async function getRecentPendingItems(
    limit: number = 10
): Promise<ApiResponse<{
    pendingTransactions: SettlementTransactionWithDetails[]
    pendingSettlements: OrderSettlementWithDetails[]
}>> {
    try {
        await requireAdmin(['superadmin', 'admin', 'finance'])

        const supabase = getSupabaseAdminClient()

        // 并行查询
        const [transactionsResult, settlementsResult] = await Promise.all([
            // 待审核申请
            supabase
                .from('settlement_transactions')
                .select(`
          *,
          girls!inner (
            id,
            girl_number,
            name,
            username,
            avatar_url
          )
        `)
                .eq('approval_status', 'pending')
                .order('created_at', { ascending: false })
                .limit(limit),

            // 待结算订单
            supabase
                .from('order_settlements')
                .select(`
          *,
          orders!inner (
            id,
            order_number,
            service_name,
            service_duration,
            total_amount,
            completed_at
          ),
          girls!inner (
            id,
            girl_number,
            name,
            username
          )
        `)
                .eq('settlement_status', 'pending')
                .order('created_at', { ascending: false })
                .limit(limit),
        ])

        if (transactionsResult.error) throw transactionsResult.error
        if (settlementsResult.error) throw settlementsResult.error

        return {
            ok: true,
            data: {
                pendingTransactions: transactionsResult.data as SettlementTransactionWithDetails[],
                pendingSettlements: settlementsResult.data as OrderSettlementWithDetails[],
            }
        }
    } catch (error) {
        console.error('[getRecentPendingItems] 获取待处理事项失败:', error)
        return {
            ok: false,
            error: error instanceof Error ? error.message : '获取待处理事项失败'
        }
    }
}

// ==================== 账户管理操作 ====================

/**
 * 更新技师账户定金
 */
export async function updateGirlDeposit(
    data: UpdateDepositData
): Promise<ApiResponse<{ success: boolean }>> {
    try {
        // 1. 权限验证
        const admin = await requireAdmin(['superadmin', 'admin', 'finance'])

        // 2. 数据验证
        const validated = updateDepositSchema.parse(data)

        const supabase = getSupabaseAdminClient()

        // 3. 检查账户是否存在
        const { data: account, error: fetchError } = await supabase
            .from('girl_settlement_accounts')
            .select('id, deposit_amount, girl_id')
            .eq('girl_id', validated.girl_id)
            .single()

        if (fetchError || !account) {
            return {
                ok: false,
                error: '账户不存在'
            }
        }

        // 4. 更新定金金额
        // 使用类型断言解决 Supabase 类型生成问题
        type UpdatePayload = { deposit_amount: number }
        const updateData: UpdatePayload = { deposit_amount: validated.deposit_amount }

        const { error: updateError } = await supabase
            .from('girl_settlement_accounts')
            .update(updateData as never)
            .eq('girl_id', validated.girl_id)

        if (updateError) throw updateError

        // 5. 记录审计日志（可选，如果需要的话）
        // await logAction(admin.id, 'update_deposit', validated.girl_id, validated)

        return {
            ok: true,
            data: { success: true }
        }
    } catch (error) {
        console.error('[updateGirlDeposit] 更新定金失败:', error)
        return {
            ok: false,
            error: error instanceof Error ? error.message : '更新定金失败'
        }
    }
}

/**
 * 批准交易申请
 */
export async function approveTransaction(
    data: ApproveTransactionData
): Promise<ApiResponse<{ success: boolean }>> {
    try {
        // 1. 权限验证
        const admin = await requireAdmin(['superadmin', 'admin', 'finance'])

        // 2. 数据验证
        const validated = approveTransactionSchema.parse(data)

        const supabase = getSupabaseAdminClient()

        // 3. 获取交易详情
        const { data: transaction, error: fetchError } = await supabase
            .from('settlement_transactions')
            .select('*')
            .eq('id', validated.transaction_id)
            .single()

        if (fetchError || !transaction) {
            return { ok: false, error: '交易记录不存在' }
        }

        const tx = transaction as any
        if (tx.approval_status !== 'pending') {
            return { ok: false, error: '该交易已经被处理过了' }
        }

        // 4. 更新交易状态为已批准
        type ApprovalUpdate = { approval_status: string; approved_at: string; operator_id: string }
        const updateData: ApprovalUpdate = {
            approval_status: 'approved',
            approved_at: new Date().toISOString(),
            operator_id: admin.id
        }

        const { error: updateError } = await supabase
            .from('settlement_transactions')
            .update(updateData as never)
            .eq('id', validated.transaction_id)

        if (updateError) throw updateError

        // 5. 更新技师账户余额
        const { data: account } = await supabase
            .from('girl_settlement_accounts')
            .select('balance')
            .eq('girl_id', tx.girl_id)
            .single()

        if (account) {
            const acc = account as any
            const currentBalance = Number(acc.balance)
            const amount = Number(tx.amount)
            const newBalance = tx.direction === 'to_platform'
                ? currentBalance - amount  // 技师付给平台，余额减少
                : currentBalance + amount  // 平台付给技师，余额增加

            type BalanceUpdate = { balance: number }
            const balanceData: BalanceUpdate = { balance: newBalance }

            await supabase
                .from('girl_settlement_accounts')
                .update(balanceData as never)
                .eq('girl_id', tx.girl_id)
        }

        return { ok: true, data: { success: true } }
    } catch (error) {
        console.error('[approveTransaction] 批准交易失败:', error)
        return {
            ok: false,
            error: error instanceof Error ? error.message : '批准交易失败'
        }
    }
}

/**
 * 拒绝交易申请
 */
export async function rejectTransaction(
    data: RejectTransactionData
): Promise<ApiResponse<{ success: boolean }>> {
    try {
        // 1. 权限验证
        const admin = await requireAdmin(['superadmin', 'admin', 'finance'])

        // 2. 数据验证
        const validated = rejectTransactionSchema.parse(data)

        const supabase = getSupabaseAdminClient()

        // 3. 获取交易详情
        const { data: transaction, error: fetchError } = await supabase
            .from('settlement_transactions')
            .select('approval_status')
            .eq('id', validated.transaction_id)
            .single()

        if (fetchError || !transaction) {
            return { ok: false, error: '交易记录不存在' }
        }

        const tx = transaction as any
        if (tx.approval_status !== 'pending') {
            return { ok: false, error: '该交易已经被处理过了' }
        }

        // 4. 更新交易状态为已拒绝
        type RejectionUpdate = {
            approval_status: string
            reject_reason: string
            approved_at: string
            operator_id: string
        }
        const updateData: RejectionUpdate = {
            approval_status: 'rejected',
            reject_reason: validated.reject_reason,
            approved_at: new Date().toISOString(),
            operator_id: admin.id
        }

        const { error: updateError } = await supabase
            .from('settlement_transactions')
            .update(updateData as never)
            .eq('id', validated.transaction_id)

        if (updateError) throw updateError

        return { ok: true, data: { success: true } }
    } catch (error) {
        console.error('[rejectTransaction] 拒绝交易失败:', error)
        return {
            ok: false,
            error: error instanceof Error ? error.message : '拒绝交易失败'
        }
    }
}

// ==================== 订单结算详情管理 ====================

/**
 * 获取订单结算详情
 */
export async function getOrderSettlementDetail(
    settlementId: string
): Promise<ApiResponse<OrderSettlementWithDetails>> {
    try {
        await requireAdmin(['superadmin', 'admin', 'finance'])

        const supabase = getSupabaseAdminClient()

        const { data, error } = await supabase
            .from('order_settlements')
            .select(`
                *,
                orders!inner (
                    id,
                    order_number,
                    service_name,
                    service_duration,
                    total_amount,
                    completed_at
                ),
                girls!inner (
                    id,
                    girl_number,
                    name,
                    username,
                    avatar_url,
                    city_id,
                    cities:city_id (
                        id,
                        name
                    )
                )
            `)
            .eq('id', settlementId)
            .single()

        if (error) throw error
        if (!data) {
            return { ok: false, error: '订单结算记录不存在' }
        }

        return { ok: true, data: data as OrderSettlementWithDetails }
    } catch (error) {
        console.error('[getOrderSettlementDetail] 获取结算详情失败:', error)
        return {
            ok: false,
            error: error instanceof Error ? error.message : '获取结算详情失败'
        }
    }
}

/**
 * 更新订单结算支付信息
 */
export async function updateOrderSettlementPayment(
    data: UpdateSettlementPaymentData
): Promise<ApiResponse<{ success: boolean }>> {
    try {
        const admin = await requireAdmin(['superadmin', 'admin', 'finance'])
        const validated = updateSettlementPaymentSchema.parse(data)
        const supabase = getSupabaseAdminClient()

        // 1. 检查结算记录是否存在
        const { data: settlement, error: fetchError } = await supabase
            .from('order_settlements')
            .select('id, settlement_status')
            .eq('id', validated.settlement_id)
            .single()

        if (fetchError || !settlement) {
            return { ok: false, error: '订单结算记录不存在' }
        }

        // 2. 更新支付信息
        type PaymentUpdate = {
            customer_paid_to_platform?: number
            actual_paid_amount?: number | null
            payment_content_type?: string | null
            payment_method?: string | null
            payment_notes?: string | null
            updated_at: string
        }

        const updateData: PaymentUpdate = {
            updated_at: new Date().toISOString()
        }

        if (validated.customer_paid_to_platform !== undefined) {
            updateData.customer_paid_to_platform = validated.customer_paid_to_platform
        }
        if (validated.actual_paid_amount !== undefined) {
            updateData.actual_paid_amount = validated.actual_paid_amount
        }
        if (validated.payment_content_type !== undefined) {
            updateData.payment_content_type = validated.payment_content_type
        }
        if (validated.payment_method !== undefined) {
            updateData.payment_method = validated.payment_method
        }
        if (validated.payment_notes !== undefined) {
            updateData.payment_notes = validated.payment_notes
        }

        const { error: updateError } = await supabase
            .from('order_settlements')
            .update(updateData as never)
            .eq('id', validated.settlement_id)

        if (updateError) throw updateError

        return { ok: true, data: { success: true } }
    } catch (error) {
        console.error('[updateOrderSettlementPayment] 更新支付信息失败:', error)
        return {
            ok: false,
            error: error instanceof Error ? error.message : '更新支付信息失败'
        }
    }
}

/**
 * 标记订单核验为已核验（仅确认订单信息，不影响技师账户余额）
 * 注意：技师账户余额只在技师申请结算/提现时才会变化
 */
export async function markSettlementAsSettled(
    data: MarkSettlementAsSettledData
): Promise<ApiResponse<{ success: boolean }>> {
    try {
        const admin = await requireAdmin(['superadmin', 'admin', 'finance'])
        const validated = markSettlementAsSettledSchema.parse(data)
        const supabase = getSupabaseAdminClient()

        // 1. 获取结算记录详情
        const { data: settlement, error: fetchError } = await supabase
            .from('order_settlements')
            .select('id, girl_id, settlement_amount, settlement_status')
            .eq('id', validated.settlement_id)
            .single()

        if (fetchError || !settlement) {
            return { ok: false, error: '订单结算记录不存在' }
        }

        const settlementData = settlement as any

        // 2. 检查是否已经结算
        if (settlementData.settlement_status === 'settled') {
            return { ok: false, error: '该订单已经结算过了' }
        }

        // 3. 更新核验状态（仅标记为已核验，不影响技师账户余额）
        type SettlementUpdate = {
            settlement_status: string
            settled_at: string
            updated_at: string
        }
        const settlementUpdate: SettlementUpdate = {
            settlement_status: 'settled',
            settled_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }

        const { error: updateError } = await supabase
            .from('order_settlements')
            .update(settlementUpdate as never)
            .eq('id', validated.settlement_id)

        if (updateError) throw updateError

        // 注意：订单核验不会影响技师账户余额
        // 余额变化只在技师申请结算/提现时才会触发

        return { ok: true, data: { success: true } }
    } catch (error) {
        console.error('[markSettlementAsSettled] 标记已结算失败:', error)
        return {
            ok: false,
            error: error instanceof Error ? error.message : '标记已结算失败'
        }
    }
}
