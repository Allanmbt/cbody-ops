"use server"

import { getSupabaseAdminClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/auth"
import type {
  Transaction,
  TransactionFilterParams,
  TransactionStats,
  ApproveTransactionData,
  RejectTransactionData
} from "@/lib/features/transactions"
import {
  approveTransactionSchema,
  rejectTransactionSchema
} from "@/lib/features/transactions"

// 通用类型
type ApiResponse<T> =
  | { ok: true; data: T; error?: never }
  | { ok: false; data?: never; error: string }

interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

/**
 * 获取结账/提现申请统计
 */
export async function getTransactionStats(): Promise<ApiResponse<TransactionStats>> {
  try {
    await requireAdmin(['superadmin', 'admin', 'finance'])
    const supabase = getSupabaseAdminClient()

    // 计算泰国今日6点起始时间
    const nowUTC = new Date()
    const thailandOffset = 7 * 60
    const thailandNow = new Date(nowUTC.getTime() + thailandOffset * 60 * 1000)
    const todayThailand = new Date(thailandNow)
    todayThailand.setHours(6, 0, 0, 0)
    if (thailandNow.getHours() < 6) {
      todayThailand.setDate(todayThailand.getDate() - 1)
    }
    const todayStartUTC = new Date(todayThailand.getTime() - thailandOffset * 60 * 1000).toISOString()

    // ✅ 优化：一次查询获取所有数据，客户端聚合统计
    const { data: transactions } = await supabase
      .from('settlement_transactions')
      .select('status, transaction_type, amount, confirmed_at') as {
        data: Array<{
          status: string
          transaction_type: string
          amount: number
          confirmed_at: string | null
        }> | null
      }

    // 统计各项数据
    const pendingCount = transactions?.filter(t => t.status === 'pending').length || 0

    const todayConfirmed = transactions?.filter(t =>
      t.status === 'confirmed' &&
      t.confirmed_at &&
      t.confirmed_at >= todayStartUTC
    ) || []

    const todayApprovedCount = todayConfirmed.length

    const todaySettlementAmount = todayConfirmed
      .filter(t => t.transaction_type === 'settlement')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)

    const todayWithdrawalAmount = todayConfirmed
      .filter(t => t.transaction_type === 'withdrawal')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)

    return {
      ok: true as const,
      data: {
        pending_count: pendingCount,
        today_approved_count: todayApprovedCount,
        today_settlement_amount: todaySettlementAmount,
        today_withdrawal_amount: todayWithdrawalAmount
      }
    }
  } catch (error) {
    console.error('[结账/提现统计] 获取失败:', error)
    return { ok: false as const, error: "获取统计数据失败" }
  }
}

/**
 * 获取结账/提现申请列表
 */
export async function getTransactions(
  params: TransactionFilterParams = {}
): Promise<ApiResponse<PaginatedResponse<Transaction>>> {
  try {
    await requireAdmin(['superadmin', 'admin', 'finance'])
    const supabase = getSupabaseAdminClient()

    const {
      type,
      status,
      city,
      search,
      page = 1,
      limit = 20
    } = params

    // ✅ 优化：使用视图查询，数据已预关联
    let query = (supabase as any)
      .from('v_settlement_transactions')
      .select('*', { count: 'exact' })

    // 类型筛选
    if (type) {
      query = query.eq('transaction_type', type)
    }

    // 状态筛选
    if (status) {
      query = query.eq('status', status)
    }

    // 城市筛选（使用视图字段）
    if (city) {
      query = query.eq('city_id', city)
    }

    // 搜索：工号、姓名、用户名（使用视图字段，避免额外查询）
    if (search) {
      const searchNumber = parseInt(search)
      if (!isNaN(searchNumber)) {
        query = query.eq('girl_number', searchNumber)
      } else {
        query = query.or(`girl_name.ilike.%${search}%,girl_username.ilike.%${search}%`)
      }
    }

    // 排序：待审核优先，然后按申请时间倒序
    query = query
      .order('status', { ascending: true })
      .order('created_at', { ascending: false })

    // 分页
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
      console.error('[结账/提现列表] 查询失败:', error)
      return { ok: false as const, error: "查询申请列表失败" }
    }

    // ✅ 优化：将视图扁平结构转换为嵌套结构
    const formattedData = (data || []).map((row: any) => ({
      id: row.id,
      girl_id: row.girl_id,
      transaction_type: row.transaction_type,
      direction: row.direction,
      amount: row.amount,
      exchange_rate: row.exchange_rate,
      service_fee_rate: row.service_fee_rate,
      actual_amount_thb: row.actual_amount_thb,
      payment_method: row.payment_method,
      payment_proof_url: row.payment_proof_url,
      notes: row.notes,
      status: row.status,
      operator_id: row.operator_id,
      confirmed_at: row.confirmed_at,
      created_at: row.created_at,
      girl: row.girl_number ? {
        id: row.girl_full_id,
        girl_number: row.girl_number,
        name: row.girl_name,
        username: row.girl_username,
        avatar_url: row.girl_avatar_url,
      } : null,
    }))

    const totalPages = Math.ceil((count || 0) / limit)

    return {
      ok: true as const,
      data: {
        data: formattedData as Transaction[],
        total: count || 0,
        page,
        limit,
        totalPages
      }
    }
  } catch (error) {
    console.error('[结账/提现列表] 查询异常:', error)
    return { ok: false as const, error: "查询申请列表异常" }
  }
}

/**
 * 审核通过申请
 */
export async function approveTransaction(
  data: ApproveTransactionData
): Promise<ApiResponse<void>> {
  try {
    const admin = await requireAdmin(['superadmin', 'admin', 'finance'])
    const supabase = getSupabaseAdminClient()

    // 验证数据
    const validated = approveTransactionSchema.parse(data)

    // 获取申请详情
    const { data: transaction, error: fetchError } = await supabase
      .from('settlement_transactions')
      .select('*')
      .eq('id', validated.transaction_id)
      .single()

    if (fetchError || !transaction) {
      return { ok: false as const, error: "申请不存在" }
    }

    const txData = transaction as any
    if (txData.status !== 'pending') {
      return { ok: false as const, error: "该申请已被处理" }
    }

    // 更新申请状态
    type ApprovalUpdate = {
      status: string
      confirmed_at: string
      operator_id: string
      notes: string | null
    }
    const updateData: ApprovalUpdate = {
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      operator_id: admin.id,
      notes: validated.notes || txData.notes || null
    }

    const { error: updateError } = await supabase
      .from('settlement_transactions')
      .update(updateData as never)
      .eq('id', validated.transaction_id)

    if (updateError) {
      console.error('[审核申请] 更新失败:', updateError)
      return { ok: false as const, error: "审核失败" }
    }

    // 如果是提现申请且审核通过,发送系统通知给技师
    if (txData.transaction_type === 'withdrawal' && txData.actual_amount_thb) {
      try {
        const { error: rpcError } = await (supabase as any).rpc('send_system_notification_to_girl', {
          p_girl_id: txData.girl_id,
          p_content: `Your withdrawal has been processed. We have transferred ฿${txData.actual_amount_thb.toFixed(2)} THB to your account. Please check your bank account.`
        })

        if (rpcError) {
          console.error('[发送通知] RPC 调用失败:', rpcError)
          // 不阻断审核流程，只记录错误
        }
      } catch (notifyError) {
        console.error('[发送通知] 异常:', notifyError)
        // 不阻断审核流程
      }
    }

    // TODO: 记录审计日志

    return { ok: true as const, data: undefined }
  } catch (error) {
    console.error('[审核申请] 异常:', error)
    if (error instanceof Error) {
      return { ok: false as const, error: error.message }
    }
    return { ok: false as const, error: "审核申请异常" }
  }
}

/**
 * 拒绝/作废申请
 */
export async function rejectTransaction(
  data: RejectTransactionData
): Promise<ApiResponse<void>> {
  try {
    const admin = await requireAdmin(['superadmin', 'admin', 'finance'])
    const supabase = getSupabaseAdminClient()

    // 验证数据
    const validated = rejectTransactionSchema.parse(data)

    // 获取申请详情
    const { data: transaction, error: fetchError } = await supabase
      .from('settlement_transactions')
      .select('*')
      .eq('id', validated.transaction_id)
      .single()

    if (fetchError || !transaction) {
      return { ok: false as const, error: "申请不存在" }
    }

    const txData = transaction as any
    if (txData.status !== 'pending') {
      return { ok: false as const, error: "该申请已被处理" }
    }

    // 更新申请状态
    type RejectionUpdate = {
      status: string
      operator_id: string
      notes: string
    }
    const updateData: RejectionUpdate = {
      status: 'cancelled',
      operator_id: admin.id,
      notes: validated.reason
    }

    const { error: updateError } = await supabase
      .from('settlement_transactions')
      .update(updateData as never)
      .eq('id', validated.transaction_id)

    if (updateError) {
      console.error('[拒绝申请] 更新失败:', updateError)
      return { ok: false as const, error: "拒绝失败" }
    }

    // TODO: 记录审计日志

    return { ok: true as const, data: undefined }
  } catch (error) {
    console.error('[拒绝申请] 异常:', error)
    if (error instanceof Error) {
      return { ok: false as const, error: error.message }
    }
    return { ok: false as const, error: "拒绝申请异常" }
  }
}

/**
 * 获取技师收款账号信息
 */
export async function getGirlBankAccount(
  girlId: string
): Promise<ApiResponse<{
  bank_account_name: string | null
  bank_account_number: string | null
  bank_name: string | null
  bank_branch: string | null
  bank_meta: Record<string, any> | null
}>> {
  try {
    await requireAdmin(['superadmin', 'admin', 'finance'])
    const supabase = getSupabaseAdminClient()

    const { data, error } = await supabase
      .from('girl_settlement_accounts')
      .select('bank_account_name, bank_account_number, bank_name, bank_branch, bank_meta')
      .eq('girl_id', girlId)
      .single()

    if (error) {
      console.error('[收款账号] 查询失败:', error)
      return { ok: false as const, error: "查询收款账号失败" }
    }

    return {
      ok: true as const,
      data: data as any
    }
  } catch (error) {
    console.error('[收款账号] 查询异常:', error)
    return { ok: false as const, error: "查询收款账号异常" }
  }
}
