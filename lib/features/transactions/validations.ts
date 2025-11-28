import { z } from "zod"

/**
 * 审核申请验证模式
 */
export const approveTransactionSchema = z.object({
  transaction_id: z.string().uuid("无效的申请ID"),
  notes: z.string().optional()
})

export type ApproveTransactionData = z.infer<typeof approveTransactionSchema>

/**
 * 拒绝/作废申请验证模式
 */
export const rejectTransactionSchema = z.object({
  transaction_id: z.string().uuid("无效的申请ID"),
  reason: z.string().min(1, "请填写拒绝原因")
})

export type RejectTransactionData = z.infer<typeof rejectTransactionSchema>
