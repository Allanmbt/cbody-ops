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
 * 获取财务日统计数据
 * 包含：核验订单数、待核验数、已核验数、平台应得总额、代收总额
 * 注：使用 order_settlements.created_at 而非 orders.completed_at，以兼容取消订单
 */
export async function getFinanceDayStats(
    completedAtFrom: string,
    completedAtTo: string
): Promise<ApiResponse<{
    settlement_total_count: number  // 核验订单总数
    pending_count: number           // 待核验
    settled_count: number           // 已核验
    platform_should_get_total: number  // 平台应得总额
    actual_paid_total: number          // 代收总额(RMB)
}>> {
    try {
        await requireAdmin(['superadmin', 'admin', 'finance'])

        const supabase = getSupabaseAdminClient()

        // 并行查询
        const [
            settlementTotalResult,
            pendingResult,
            settledResult,
            sumResult,
        ] = await Promise.all([
            // 核验订单总数
            supabase
                .from('order_settlements')
                .select('id', { count: 'exact', head: true })
                .gte('created_at', completedAtFrom)
                .lt('created_at', completedAtTo),

            // 待核验数
            supabase
                .from('order_settlements')
                .select('id', { count: 'exact', head: true })
                .eq('settlement_status', 'pending')
                .gte('created_at', completedAtFrom)
                .lt('created_at', completedAtTo),

            // 已核验数
            supabase
                .from('order_settlements')
                .select('id', { count: 'exact', head: true })
                .eq('settlement_status', 'settled')
                .gte('created_at', completedAtFrom)
                .lt('created_at', completedAtTo),

            // 金额统计
            supabase
                .from('order_settlements')
                .select('platform_should_get, actual_paid_amount')
                .gte('created_at', completedAtFrom)
                .lt('created_at', completedAtTo),
        ])

        // 计算总额
        let platformShouldGetTotal = 0
        let actualPaidTotal = 0

        if (sumResult.data) {
            for (const row of sumResult.data as any[]) {
                platformShouldGetTotal += Number(row.platform_should_get) || 0
                actualPaidTotal += Number(row.actual_paid_amount) || 0
            }
        }

        return {
            ok: true,
            data: {
                settlement_total_count: settlementTotalResult.count || 0,
                pending_count: pendingResult.count || 0,
                settled_count: settledResult.count || 0,
                platform_should_get_total: platformShouldGetTotal,
                actual_paid_total: actualPaidTotal,
            }
        }
    } catch (error) {
        console.error('[getFinanceDayStats] 获取财务日统计失败:', error)
        return {
            ok: false,
            error: error instanceof Error ? error.message : '获取财务日统计失败'
        }
    }
}

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
 * ✅ 优化：使用 v_settlement_accounts 视图，避免嵌套 JOIN
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

        // ✅ 优化：使用视图查询，数据已预关联
        let query = (supabase as any)
            .from('v_settlement_accounts')
            .select('*', { count: 'exact' })

        // 搜索：工号或姓名（使用视图字段）
        if (filters.search && filters.search.trim()) {
            const searchTerm = filters.search.trim()
            const searchNumber = parseInt(searchTerm)

            if (!isNaN(searchNumber)) {
                query = query.eq('girl_number', searchNumber)
            } else {
                query = query.ilike('girl_name', `%${searchTerm}%`)
            }
        }

        // 城市筛选（使用视图字段）
        if (filters.city_id) {
            query = query.eq('city_id', filters.city_id)
        }

        // 余额状态筛选
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

        // 余额范围筛选
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

        // ✅ 优化:将视图扁平结构转换为嵌套结构
        const formattedData = (data || []).map((row: any) => ({
            id: row.account_id,
            girl_id: row.girl_id,
            balance: row.balance,
            deposit_amount: row.deposit_amount,
            frozen_balance_thb: row.frozen_balance_thb,
            platform_collected_rmb_balance: row.platform_collected_rmb_balance,
            frozen_rmb_balance: row.frozen_rmb_balance,
            currency: row.currency,
            bank_account_name: row.bank_account_name,
            bank_account_number: row.bank_account_number,
            bank_name: row.bank_name,
            bank_branch: row.bank_branch,
            bank_meta: row.bank_meta,
            created_at: row.account_created_at,
            updated_at: row.account_updated_at,
            girls: row.girl_number ? {
                id: row.girl_full_id,
                girl_number: row.girl_number,
                name: row.girl_name,
                username: row.girl_username,
                avatar_url: row.girl_avatar_url,
                city_id: row.city_id,
                cities: row.city_name ? {
                    id: row.city_full_id,
                    name: row.city_name,
                } : null,
            } : null,
        }))

        const totalPages = count ? Math.ceil(count / pageSize) : 0

        return {
            ok: true,
            data: {
                data: formattedData as GirlSettlementAccountWithGirl[],
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
 * 支持按财务日（结算记录创建时间）筛选
 * 注：使用 order_settlements.created_at 而非 orders.completed_at，以兼容取消订单
 * ✅ 优化：使用 v_finance_settlements 视图，避免 N+1 查询
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

        // ✅ 优化：使用视图查询，数据已预关联
        let query = (supabase as any)
            .from('v_finance_settlements')
            .select('*', { count: 'exact' })

        // 如果指定了技师ID，则筛选
        if (girlId) {
            query = query.eq('girl_id', girlId)
        }

        // 应用筛选条件
        if (filters.status && filters.status !== 'all') {
            query = query.eq('settlement_status', filters.status)
        }

        // 平台代收筛选
        if (filters.platform_collected && filters.platform_collected !== 'all') {
            if (filters.platform_collected === 'collected') {
                // 平台代收：payment_content_type 不为空
                query = query.not('payment_content_type', 'is', null)
            } else if (filters.platform_collected === 'not_collected') {
                // 技师收款：payment_content_type 为空
                query = query.is('payment_content_type', null)
            }
        }

        // 按结算记录创建时间筛选（财务日筛选）
        // 使用 order_settlements.created_at 而非 orders.completed_at
        // 原因：取消订单的 completed_at 为 NULL，但仍需在财务日显示
        if (filters.completed_at_from) {
            query = query.gte('created_at', filters.completed_at_from)
        }
        if (filters.completed_at_to) {
            query = query.lt('created_at', filters.completed_at_to)
        }

        // 搜索：订单号、技师工号、技师姓名（使用视图字段）
        if (filters.search && filters.search.trim()) {
            const searchTerm = filters.search.trim()
            const searchNumber = parseInt(searchTerm)

            if (!isNaN(searchNumber)) {
                // 搜索技师工号（直接使用视图字段）
                query = query.eq('girl_number', searchNumber)
            } else {
                // 搜索技师姓名或订单号（直接使用视图字段）
                query = query.or(`girl_name.ilike.%${searchTerm}%,order_number.ilike.%${searchTerm}%`)
            }
        }

        // 排序（使用视图字段）
        if (filters.sort_by && filters.sort_order) {
            const ascending = filters.sort_order === 'asc'
            if (filters.sort_by === 'girl_name') {
                query = query.order('girl_name', { ascending })
            } else if (filters.sort_by === 'created_at') {
                query = query.order('created_at', { ascending })
            } else if (filters.sort_by === 'service_fee') {
                query = query.order('service_fee', { ascending })
            } else if (filters.sort_by === 'platform_should_get') {
                query = query.order('platform_should_get', { ascending })
            } else {
                query = query.order('created_at', { ascending: false })
            }
        } else {
            query = query.order('created_at', { ascending: false })
        }

        // 分页
        query = query.range(from, to)

        const { data, error, count } = await query

        if (error) throw error

        // ✅ 优化：将视图的扁平结构转换为嵌套结构
        const formattedData = (data || []).map((row: any) => ({
            id: row.id,
            order_id: row.order_id,
            girl_id: row.girl_id,
            service_fee: row.service_fee,
            extra_fee: row.extra_fee,
            service_commission_rate: row.service_commission_rate,
            extra_commission_rate: row.extra_commission_rate,
            platform_should_get: row.platform_should_get,
            customer_paid_to_platform: row.customer_paid_to_platform,
            settlement_amount: row.settlement_amount,
            actual_paid_amount: row.actual_paid_amount,
            payment_content_type: row.payment_content_type,
            payment_method: row.payment_method,
            payment_notes: row.payment_notes,
            settlement_status: row.settlement_status,
            notes: row.notes,
            created_at: row.created_at,
            settled_at: row.settled_at,
            rejected_at: row.rejected_at,
            reject_reason: row.reject_reason,
            updated_at: row.updated_at,
            orders: row.order_number ? {
                id: row.order_id,
                order_number: row.order_number,
                status: row.order_status,
                completed_at: row.order_completed_at,
            } : null,
            girls: row.girl_number ? {
                id: row.girl_id,
                girl_number: row.girl_number,
                name: row.girl_name,
                username: row.girl_username,
                avatar_url: row.girl_avatar_url,
            } : null,
        }))

        const totalPages = count ? Math.ceil(count / pageSize) : 0

        return {
            ok: true,
            data: {
                data: formattedData as OrderSettlementWithDetails[],
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
            platform_should_get?: number
            notes?: string | null
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
        if (validated.platform_should_get !== undefined) {
            (updateData as any).platform_should_get = validated.platform_should_get
        }
        if (validated.notes !== undefined) {
            (updateData as any).notes = validated.notes
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

/**
 * 获取订单收款页面数据（包含收款记录、汇率等）
 */
export async function getOrderPaymentData(
    orderId: string
): Promise<ApiResponse<import('./types').OrderPaymentPageData>> {
    try {
        await requireAdmin(['superadmin', 'admin', 'finance'])
        const supabase = getSupabaseAdminClient()

        // 调用 RPC 函数获取完整数据
        const { data, error } = await (supabase as any).rpc('get_order_payment_page_data', {
            p_order_id: orderId
        })

        if (error) throw error
        if (!data) {
            return { ok: false, error: '获取订单收款数据失败' }
        }

        // RPC 返回的是 JSONB，需要解析
        const result = typeof data === 'string' ? JSON.parse(data) : data

        if (!result.ok) {
            return { ok: false, error: result.error || '获取订单收款数据失败' }
        }

        return { ok: true, data: result as import('./types').OrderPaymentPageData }
    } catch (error) {
        console.error('[getOrderPaymentData] 获取订单收款数据失败:', error)
        return {
            ok: false,
            error: error instanceof Error ? error.message : '获取订单收款数据失败'
        }
    }
}

/**
 * 拒绝订单结算
 */
export async function rejectOrderSettlement(data: {
    settlement_id: string
    reject_reason: string
}): Promise<ApiResponse<{ success: boolean }>> {
    try {
        const admin = await requireAdmin(['superadmin', 'admin', 'finance'])
        const supabase = getSupabaseAdminClient()

        // 1. 检查结算记录是否存在
        const { data: settlement, error: fetchError } = await supabase
            .from('order_settlements')
            .select('id, settlement_status')
            .eq('id', data.settlement_id)
            .single()

        if (fetchError || !settlement) {
            return { ok: false, error: '订单结算记录不存在' }
        }

        const settlementData = settlement as any

        // 2. 检查是否已经处理过
        if (settlementData.settlement_status !== 'pending') {
            return { ok: false, error: '该订单已经被处理过了' }
        }

        // 3. 更新为拒绝状态
        type RejectionUpdate = {
            settlement_status: string
            reject_reason: string
            updated_at: string
        }
        const updateData: RejectionUpdate = {
            settlement_status: 'rejected',
            reject_reason: data.reject_reason,
            updated_at: new Date().toISOString()
        }

        const { error: updateError } = await supabase
            .from('order_settlements')
            .update(updateData as never)
            .eq('id', data.settlement_id)

        if (updateError) throw updateError

        return { ok: true, data: { success: true } }
    } catch (error) {
        console.error('[rejectOrderSettlement] 拒绝订单结算失败:', error)
        return {
            ok: false,
            error: error instanceof Error ? error.message : '拒绝订单结算失败'
        }
    }
}
