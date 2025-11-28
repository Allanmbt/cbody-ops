/**
 * 结账/提现申请类型定义
 */

export type TransactionType = 'settlement' | 'withdrawal'
export type TransactionStatus = 'pending' | 'confirmed' | 'cancelled'

/**
 * 结账/提现申请
 */
export interface Transaction {
  id: string
  girl_id: string
  transaction_type: TransactionType
  direction: 'to_platform' | 'to_girl'
  amount: number
  exchange_rate: number | null
  service_fee_rate: number | null
  actual_amount_thb: number | null
  payment_method: string | null
  payment_proof_url: string | null
  status: TransactionStatus
  notes: string | null
  operator_id: string | null
  confirmed_at: string | null
  created_at: string
  updated_at: string

  // 关联数据
  girl?: {
    id: string
    girl_number: string
    name: string
    username: string
    avatar_url: string | null
  }
}

/**
 * 申请筛选参数
 */
export interface TransactionFilterParams {
  type?: TransactionType
  status?: TransactionStatus
  city?: string
  search?: string
  page?: number
  limit?: number
}

/**
 * 统计数据
 */
export interface TransactionStats {
  pending_count: number
  today_approved_count: number
  today_settlement_amount: number  // THB
  today_withdrawal_amount: number  // RMB
}
