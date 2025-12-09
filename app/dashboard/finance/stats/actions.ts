"use server"

import { getSupabaseAdminClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/auth"

/**
 * 月度数据点
 */
export interface MonthlyDataPoint {
  month: string           // 格式：2024-01
  amount: number          // 金额
}

/**
 * 财务统计数据
 */
export interface FinanceStats {
  // 结算单统计
  settlements: {
    total_verified: number   // 已核验总数
    total_pending: number    // 待核验总数
    total_rejected: number   // 已拒绝总数
  }

  // 销售额统计（订单总额）
  revenue: {
    total_sales: number      // 总销售额（THB）
    monthly_chart: MonthlyDataPoint[]  // 每月销售额走势
  }

  // 利润统计（平台应得抽成）
  profit: {
    total_profit: number     // 总利润（THB）
    monthly_chart: MonthlyDataPoint[]  // 每月利润走势
  }

  // 支出统计（平台代收）
  expense: {
    total_expense: number    // 总支出（RMB）
    monthly_chart: MonthlyDataPoint[]  // 每月支出走势
  }

  // 结账/提现统计
  transactions: {
    total_settlement: number   // 总结账金额（THB）
    total_withdrawal: number   // 总提现金额（RMB）
    settlement_count: number   // 结账笔数
    withdrawal_count: number   // 提现笔数
    total_debt: number         // 技师当前总欠款（THB）
    total_deposit: number      // 技师已付押金总额（THB）
    monthly_settlement_chart: MonthlyDataPoint[]  // 每月结账走势（THB）
    monthly_withdrawal_chart: MonthlyDataPoint[]  // 每月提现走势（RMB）
  }
}

/**
 * 获取财务统计数据
 */
export async function getFinanceStats(): Promise<{ ok: true; data: FinanceStats } | { ok: false; error: string }> {
  try {
    await requireAdmin(['superadmin', 'admin', 'finance'])
    const supabase = getSupabaseAdminClient()

    // 调用数据库 RPC 函数，单次查询获取所有统计数据
    const { data, error } = await supabase.rpc('get_finance_stats')

    if (error) {
      console.error('[财务统计] RPC 调用失败:', error)
      return { ok: false, error: "获取财务统计失败" }
    }

    return { ok: true, data: data as FinanceStats }
  } catch (error) {
    console.error('[财务统计] 获取失败:', error)
    return { ok: false, error: "获取财务统计失败" }
  }
}
