import { z } from "zod"

/**
 * 技师考勤统计查询参数验证
 */
export const girlAttendanceListParamsSchema = z.object({
  search: z.string().optional(),
  city_id: z.number().optional(),
  sort_by: z.enum(['girl_number', 'online_seconds', 'order_count', 'order_duration_seconds', 'booking_rate_percent']).optional().default('booking_rate_percent'),
  sort_order: z.enum(['asc', 'desc']).optional().default('desc')
})
