import { z } from "zod"

export const incallLocationListParamsSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  city_id: z.number().int().optional(),
  is_active: z.boolean().optional(),
})

export const createIncallLocationSchema = z.object({
  name: z.string().min(1, "地点名称不能为空").max(200),
  address: z.string().min(1, "地址不能为空").max(500),
  lat: z.number(),
  lng: z.number(),
  place_id: z.string().nullable().optional(),
  city_id: z.number().int().nullable().optional(),
  photos: z.array(z.string()).max(9),
  meta: z.object({
    floor: z.string().optional(),
    entrance_note: z.string().optional(),
    parking: z.string().optional(),
  }).optional(),
})

export type CreateIncallLocationData = z.infer<typeof createIncallLocationSchema>
