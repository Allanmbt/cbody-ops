/**
 * 财务管理模块验证规则
 */

import { z } from "zod"

// ==================== 筛选条件验证 ====================

export const accountListFiltersSchema = z.object({
    search: z.string().optional(),
    city_id: z.number().int().positive().optional(),
    balance_status: z.enum(['all', 'negative', 'positive', 'zero']).optional(),
    balance_min: z.number().optional(),
    balance_max: z.number().optional(),
})

export const settlementListFiltersSchema = z.object({
    girl_id: z.string().uuid().optional(),
    order_number: z.string().optional(),
    status: z.enum(['pending', 'settled', 'all']).optional(),
    date_from: z.string().optional(),
    date_to: z.string().optional(),
    amount_min: z.number().optional(),
    amount_max: z.number().optional(),
})

export const transactionListFiltersSchema = z.object({
    girl_id: z.string().uuid().optional(),
    transaction_type: z.enum(['deposit', 'payment', 'withdrawal', 'adjustment', 'all']).optional(),
    approval_status: z.enum(['pending', 'approved', 'rejected', 'all']).optional(),
    date_from: z.string().optional(),
    date_to: z.string().optional(),
})

// ==================== 分页参数验证 ====================

export const paginationSchema = z.object({
    page: z.number().int().positive().default(1),
    pageSize: z.number().int().positive().max(100).default(20),
})

// ==================== 操作参数验证 ====================

export const updateSettlementSchema = z.object({
    id: z.string().uuid(),
    customer_paid_to_platform: z.number().min(0),
    payment_type: z.enum(['deposit', 'cny', 'cash', 'other']).optional(),
    payment_notes: z.string().optional(),
})

export const markSettledSchema = z.object({
    id: z.string().uuid(),
})

export const adjustAccountSchema = z.object({
    girl_id: z.string().uuid(),
    amount: z.number(),
    reason: z.string().min(1, "调整原因不能为空"),
    adjust_type: z.enum(['balance', 'deposit']),
})

export const updateDepositSchema = z.object({
    girl_id: z.string().uuid(),
    deposit_amount: z.number().min(0, "定金金额不能为负数"),
})

export const approveTransactionSchema = z.object({
    transaction_id: z.string().uuid(),
})

export const rejectTransactionSchema = z.object({
    transaction_id: z.string().uuid(),
    reject_reason: z.string().min(1, "拒绝原因不能为空"),
})

export const updateSettlementPaymentSchema = z.object({
    settlement_id: z.string().uuid(),
    customer_paid_to_platform: z.number().min(0).optional(),
    actual_paid_amount: z.number().min(0).nullable().optional(),
    payment_content_type: z.enum(['deposit', 'full_amount', 'tip', 'other']).nullable().optional(),
    payment_method: z.enum(['wechat', 'alipay', 'thb_bank_transfer', 'credit_card', 'cash', 'other']).nullable().optional(),
    payment_notes: z.string().nullable().optional(),
    platform_should_get: z.number().min(0).optional(),
    notes: z.string().nullable().optional(),
})

export const markSettlementAsSettledSchema = z.object({
    settlement_id: z.string().uuid(),
})

// ==================== 类型导出 ====================

export type AccountListFiltersInput = z.infer<typeof accountListFiltersSchema>
export type SettlementListFiltersInput = z.infer<typeof settlementListFiltersSchema>
export type TransactionListFiltersInput = z.infer<typeof transactionListFiltersSchema>
export type PaginationParams = z.infer<typeof paginationSchema>
export type UpdateSettlementData = z.infer<typeof updateSettlementSchema>
export type MarkSettledData = z.infer<typeof markSettledSchema>
export type AdjustAccountData = z.infer<typeof adjustAccountSchema>
export type UpdateDepositData = z.infer<typeof updateDepositSchema>
export type ApproveTransactionData = z.infer<typeof approveTransactionSchema>
export type RejectTransactionData = z.infer<typeof rejectTransactionSchema>
export type UpdateSettlementPaymentData = z.infer<typeof updateSettlementPaymentSchema>
export type MarkSettlementAsSettledData = z.infer<typeof markSettlementAsSettledSchema>
