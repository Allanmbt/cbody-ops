/**
 * 聊天记录清理功能类型定义
 */

export interface ChatCleanupStats {
  invalid_threads_count: number
  old_messages_count: number
  old_images_count: number
}

export interface DeleteThreadResult {
  success: boolean
  deleted_messages: number
  deleted_images: number
  image_paths: string[]
  error?: string
}

export interface BatchCleanupResult {
  success: boolean
  deleted_count: number
  deleted_images_count: number
  image_paths: string[]
  error?: string
}

export type ApiResponse<T> =
  | {
      ok: true
      data: T
    }
  | {
      ok: false
      error: string
    }
