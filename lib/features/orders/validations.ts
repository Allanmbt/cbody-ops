import { z } from 'zod'

/**
 * 订单列表查询参数验证
 */
export const orderListParamsSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.enum([
    'pending',
    'confirmed',
    'en_route',
    'arrived',
    'in_service',
    'completed',
    'cancelled'
  ]).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  sort_by: z.enum(['created_at', 'scheduled_start_at', 'total_amount']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
})

export type OrderListParamsInput = z.input<typeof orderListParamsSchema>
