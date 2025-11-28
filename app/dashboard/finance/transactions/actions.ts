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

    // 待审核数量
    const { count: pendingCount } = await supabase
      .from('settlement_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')

    // 今日已审核数量
    const { count: todayApprovedCount } = await supabase
      .from('settlement_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'confirmed')
      .gte('confirmed_at', todayStartUTC)

    // 今日结账金额 (THB)
    const { data: todaySettlements } = await supabase
      .from('settlement_transactions')
      .select('amount')
      .eq('status', 'confirmed')
      .eq('transaction_type', 'settlement')
      .gte('confirmed_at', todayStartUTC)

    const todaySettlementAmount = (todaySettlements as any[])?.reduce((sum: number, t: any) => sum + (t.amount || 0), 0) || 0

    // 今日提现金额 (RMB)
    const { data: todayWithdrawals } = await supabase
      .from('settlement_transactions')
      .select('amount')
      .eq('status', 'confirmed')
      .eq('transaction_type', 'withdrawal')
      .gte('confirmed_at', todayStartUTC)

    const todayWithdrawalAmount = (todayWithdrawals as any[])?.reduce((sum: number, t: any) => sum + (t.amount || 0), 0) || 0

    return {
      ok: true as const,
      data: {
        pending_count: pendingCount || 0,
        today_approved_count: todayApprovedCount || 0,
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

    let query = supabase
      .from('settlement_transactions')
      .select(`
        *,
        girl:girls!girl_id(
          id,
          girl_number,
          name,
          username,
          avatar_url
        )
      `, { count: 'exact' })

    // 类型筛选
    if (type) {
      query = query.eq('transaction_type', type)
    }

    // 状态筛选
    if (status) {
      query = query.eq('status', status)
    }

    // 城市筛选 - 暂时移除，因为 girls 表没有 city 字段，且筛选逻辑需要重构
    /*
    if (city) {
      const { data: cityGirls } = await supabase
        .from('girls')
        .select('id')
        .eq('city', city)

      if (cityGirls && cityGirls.length > 0) {
        const girlIds = (cityGirls as any[]).map((g: any) => g.id)
        query = query.in('girl_id', girlIds)
      } else {
        return {
          ok: true as const,
          data: {
            data: [],
            total: 0,
            page,
            limit,
            totalPages: 0
          }
        }
      }
    }
    */

    // 搜索（技师姓名/工号）
    if (search) {
      const { data: matchedGirls } = await supabase
        .from('girls')
        .select('id')
        .or(`girl_number.eq.${parseInt(search) || 0},name.ilike.%${search}%,username.ilike.%${search}%`)

      if (matchedGirls && matchedGirls.length > 0) {
        const girlIds = (matchedGirls as any[]).map((g: any) => g.id)
        query = query.in('girl_id', girlIds)
      } else {
        // 没有匹配的技师，返回空结果
        return {
          ok: true as const,
          data: {
            data: [],
            total: 0,
            page,
            limit,
            totalPages: 0
          }
        }
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

    const totalPages = Math.ceil((count || 0) / limit)

    return {
      ok: true as const,
      data: {
        data: data as Transaction[],
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
