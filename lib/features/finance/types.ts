/**
 * 财务管理模块类型定义
 */

// ==================== 技师结算账户 ====================

export interface GirlSettlementAccount {
    id: string
    girl_id: string
    deposit_amount: number
    balance: number
    platform_collected_rmb_balance: number
    currency: string
    created_at: string
    updated_at: string
}

// ==================== 订单结算明细 ====================

export interface OrderSettlement {
    id: string
    order_id: string
    girl_id: string
    service_fee: number
    extra_fee: number
    service_commission_rate: number
    extra_commission_rate: number
    platform_should_get: number
    customer_paid_to_platform: number
    actual_paid_amount: number | null
    settlement_amount: number
    payment_content_type: 'deposit' | 'full_amount' | 'tip' | 'other' | null
    payment_method: 'wechat' | 'alipay' | 'thb_bank_transfer' | 'credit_card' | 'cash' | 'other' | null
    payment_notes: string | null
    settlement_status: 'pending' | 'settled'
    settled_at: string | null
    created_at: string
    updated_at: string
}

// ==================== 结算交易记录 ====================

export type TransactionType = 'deposit' | 'payment' | 'withdrawal' | 'adjustment'
export type TransactionDirection = 'to_platform' | 'to_girl'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export interface SettlementTransaction {
    id: string
    girl_id: string
    transaction_type: TransactionType
    amount: number
    direction: TransactionDirection
    order_id: string | null
    order_settlement_id: string | null
    payment_method: string | null
    payment_proof_url: string | null
    notes: string | null
    operator_id: string | null
    approval_status: ApprovalStatus
    approved_at: string | null
    reject_reason: string | null
    created_at: string
}

// ==================== 扩展类型（带关联数据） ====================

export interface GirlSettlementAccountWithGirl extends GirlSettlementAccount {
    girls: {
        id: string
        girl_number: number
        name: string
        username: string
        avatar_url: string | null
        city_id: number | null
        cities?: {
            id: number
            name: {
                zh: string
                en: string
                th: string
            }
        } | null
    }
}

export interface OrderSettlementWithDetails extends OrderSettlement {
    orders: {
        id: string
        order_number: string
        service_name: Record<string, string>
        service_duration: number
        total_amount: number
        completed_at: string | null
    }
    girls: {
        id: string
        girl_number: number
        name: string
        username: string
    }
}

export interface SettlementTransactionWithDetails extends SettlementTransaction {
    girls: {
        id: string
        girl_number: number
        name: string
        username: string
        avatar_url: string | null
    }
    orders?: {
        id: string
        order_number: string
    } | null
    operator?: {
        id: string
        display_name: string
    } | null
}

// ==================== 统计数据 ====================

export interface FinanceStats {
    // 待处理事项
    pending_transactions_count: number
    pending_settlements_count: number

    // 余额统计
    total_therapists: number
    negative_balance_count: number
    positive_balance_count: number
    zero_balance_count: number

    // 金额统计
    total_therapist_debt: number  // 技师欠平台总额（负余额绝对值总和）
    total_platform_debt: number   // 平台欠技师总额（正余额总和）

    // 时间段统计（泰国时区，早上6点为新一天）
    today_pending_count: number      // 今日未核验订单数
    yesterday_pending_count: number  // 昨日未核验订单数
    older_pending_count: number      // 更早未核验订单数
}

export interface AccountBalanceStatus {
    status: 'debt' | 'credit' | 'zero'
    label: string
    color: string
}

// ==================== 筛选条件 ====================

export interface AccountListFilters {
    search?: string  // 技师名称/编号
    city_id?: number
    balance_status?: 'all' | 'negative' | 'positive' | 'zero'
    debt_status?: 'all' | 'normal' | 'warning' | 'exceeded'  // 欠款状态
    balance_min?: number
    balance_max?: number
}

export interface SettlementListFilters {
    girl_id?: string
    order_number?: string
    status?: 'pending' | 'settled' | 'all'
    date_from?: string
    date_to?: string
    amount_min?: number
    amount_max?: number
}

export interface TransactionListFilters {
    girl_id?: string
    transaction_type?: TransactionType | 'all'
    approval_status?: ApprovalStatus | 'all'
    date_from?: string
    date_to?: string
}

// ==================== API 响应类型 ====================

export interface ApiResponse<T> {
    ok: boolean
    data?: T
    error?: string
}

export interface PaginatedResponse<T> {
    data: T[]
    total: number
    page: number
    pageSize: number
    totalPages: number
}
