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

/**
 * 升级服务请求参数验证
 */
export const upgradeServiceSchema = z.object({
  order_id: z.string().min(1, '订单ID不能为空'),
  new_service_duration_id: z.number().int().positive('服务时长ID必须为正整数')
})

export type UpgradeServiceInput = z.input<typeof upgradeServiceSchema>
