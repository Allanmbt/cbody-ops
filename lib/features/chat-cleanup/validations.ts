import { z } from 'zod'

/**
 * 删除单条线程验证
 */
export const deleteThreadSchema = z.object({
  thread_id: z.string().uuid('线程ID格式错误')
})

export type DeleteThreadData = z.infer<typeof deleteThreadSchema>
