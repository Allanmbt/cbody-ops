import { z } from "zod"

export const girlAttendanceListParamsSchema = z.object({
  search: z.string().optional(),
  city_id: z.number().optional(),
  sort_by: z.enum([
    "girl_number",
    "online_seconds",
    "order_count",
    "order_duration_seconds",
    "booking_rate_percent",
    "extension_rate",
    "performance_index",
  ]).optional().default("booking_rate_percent"),
  sort_order: z.enum(["asc", "desc"]).optional().default("desc"),
})

export const girlPerformanceSnapshotParamsSchema = z.object({
  girl_id: z.string().uuid(),
})
