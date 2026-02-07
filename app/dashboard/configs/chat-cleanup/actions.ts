"use server"

import { getSupabaseAdminClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/auth"
import { deleteThreadSchema } from "@/lib/features/chat-cleanup"
import type {
  ApiResponse,
  ChatCleanupStats,
  DeleteThreadResult,
  BatchCleanupResult
} from "@/lib/features/chat-cleanup"

/**
 * 获取聊天清理统计数据
 */
export async function getChatCleanupStats(): Promise<ApiResponse<ChatCleanupStats>> {
  try {
    await requireAdmin(['superadmin'])
    const supabase = getSupabaseAdminClient()

    // 统计无效线程数量（无已完成订单且超过30天）
    const { data: invalidThreadsData } = await supabase.rpc('count_invalid_chat_threads', { days_threshold: 30 } as any)
    const invalid_threads_count = invalidThreadsData ?? 0

    // 统计超过90天的消息数量
    const { count: oldMessagesCount } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .lt('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())

    // 统计超过90天的图片数量
    const { count: oldImagesCount } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .lt('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .eq('content_type', 'image')
      .not('attachment_url', 'is', null)

    return {
      ok: true,
      data: {
        invalid_threads_count,
        old_messages_count: oldMessagesCount || 0,
        old_images_count: oldImagesCount || 0
      }
    }
  } catch (error) {
    console.error('[聊天清理统计] 异常:', error)
    return { ok: false, error: error instanceof Error ? error.message : '获取统计失败' }
  }
}

/**
 * 删除单条线程（包括消息、图片、已读记录）
 */
export async function deleteSingleThread(
  thread_id: string
): Promise<ApiResponse<DeleteThreadResult>> {
  try {
    const admin = await requireAdmin(['superadmin'])

    // 验证线程ID
    const validated = deleteThreadSchema.parse({ thread_id })
    const supabase = getSupabaseAdminClient()

    // 检查线程是否存在
    const { data: thread, error: threadError } = await supabase
      .from('chat_threads')
      .select('id')
      .eq('id', validated.thread_id)
      .single()

    if (threadError || !thread) {
      return { ok: false, error: '线程不存在' }
    }

    // 收集该线程的图片路径
    const { data: images } = await supabase
      .from('chat_messages')
      .select('attachment_url')
      .eq('thread_id', validated.thread_id)
      .eq('content_type', 'image')
      .not('attachment_url', 'is', null)

    const imagePaths: string[] = (images as { attachment_url: string }[] | null)?.map(img => img.attachment_url) || []

    // 统计消息数量
    const { count: messageCount } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('thread_id', validated.thread_id)

    // 删除存储桶中的图片（按线程ID文件夹删除）
    if (imagePaths.length > 0) {
      // 提取线程文件夹路径
      const threadFolderPath = `${validated.thread_id}/`

      try {
        // 列出该线程文件夹下的所有文件
        const { data: fileList } = await supabase.storage
          .from('chat-images')
          .list(validated.thread_id)

        if (fileList && fileList.length > 0) {
          // 构建完整文件路径
          const filesToDelete = fileList.map(file => `${validated.thread_id}/${file.name}`)

          // 批量删除文件
          const { error: deleteError } = await supabase.storage
            .from('chat-images')
            .remove(filesToDelete)

          if (deleteError) {
            console.error('[删除线程图片] 失败:', deleteError)
          }
        }
      } catch (storageError) {
        console.error('[删除线程图片] 异常:', storageError)
        // 存储桶删除失败不影响数据库删除
      }
    }

    // 删除线程（会级联删除 chat_messages 和 chat_receipts）
    const { error: deleteError } = await supabase
      .from('chat_threads')
      .delete()
      .eq('id', validated.thread_id)

    if (deleteError) {
      console.error('[删除线程] 失败:', deleteError)
      return { ok: false, error: '删除线程失败' }
    }

    // 记录审计日志
    await supabase.from('audit_logs').insert({
      admin_id: admin.id,
      action: 'delete_chat_thread',
      target_type: 'chat_threads',
      target_id: validated.thread_id,
      payload: {
        deleted_messages: messageCount || 0,
        deleted_images: imagePaths.length
      },
      ip_address: null
    } as any)

    console.log(`[删除线程] 成功删除线程 ${validated.thread_id}，消息数: ${messageCount}, 图片数: ${imagePaths.length}`)

    return {
      ok: true,
      data: {
        success: true,
        deleted_messages: messageCount || 0,
        deleted_images: imagePaths.length,
        image_paths: imagePaths
      }
    }
  } catch (error) {
    console.error('[删除线程] 异常:', error)
    return { ok: false, error: error instanceof Error ? error.message : '删除线程失败' }
  }
}

/**
 * 批量清理超过90天的聊天记录
 */
export async function cleanupOldMessages(): Promise<ApiResponse<BatchCleanupResult>> {
  try {
    const admin = await requireAdmin(['superadmin'])
    const supabase = getSupabaseAdminClient()

    // 收集需要删除的图片路径
    const { data: oldImages } = await supabase
      .from('chat_messages')
      .select('attachment_url, thread_id')
      .lt('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .eq('content_type', 'image')
      .not('attachment_url', 'is', null)

    const imagePaths: string[] = (oldImages as { attachment_url: string; thread_id: string }[] | null)?.map(img => img.attachment_url) || []

    // 按线程ID分组，批量删除存储桶文件
    if (oldImages && oldImages.length > 0) {
      const threadFolders = new Set((oldImages as { attachment_url: string; thread_id: string }[]).map(img => img.thread_id))

      for (const threadId of threadFolders) {
        try {
          const { data: fileList } = await supabase.storage
            .from('chat-images')
            .list(threadId)

          if (fileList && fileList.length > 0) {
            const filesToDelete = fileList.map(file => `${threadId}/${file.name}`)
            await supabase.storage.from('chat-images').remove(filesToDelete)
          }
        } catch (storageError) {
          console.error(`[清理旧图片] 线程 ${threadId} 失败:`, storageError)
        }
      }
    }

    // 统计将要删除的消息数量
    const { count: oldMessagesCount } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .lt('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())

    // 删除超过90天的消息
    const { error: deleteError } = await supabase
      .from('chat_messages')
      .delete()
      .lt('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())

    if (deleteError) {
      console.error('[清理旧消息] 失败:', deleteError)
      return { ok: false, error: '清理旧消息失败' }
    }

    // 记录审计日志
    await supabase.from('audit_logs').insert({
      admin_id: admin.id,
      action: 'cleanup_old_chat_messages',
      target_type: 'chat_messages',
      target_id: null,
      payload: {
        deleted_count: oldMessagesCount || 0,
        deleted_images: imagePaths.length,
        days_threshold: 90
      },
      ip_address: null
    } as any)

    console.log(`[清理旧消息] 成功删除 ${oldMessagesCount} 条消息，${imagePaths.length} 张图片`)

    return {
      ok: true,
      data: {
        success: true,
        deleted_count: oldMessagesCount || 0,
        deleted_images_count: imagePaths.length,
        image_paths: imagePaths
      }
    }
  } catch (error) {
    console.error('[清理旧消息] 异常:', error)
    return { ok: false, error: error instanceof Error ? error.message : '清理旧消息失败' }
  }
}

/**
 * 批量清理无效线程（无已完成订单且超过30天）
 * 每次最多删除50条，避免超时
 */
export async function cleanupInvalidThreads(): Promise<ApiResponse<BatchCleanupResult>> {
  try {
    const admin = await requireAdmin(['superadmin'])
    const supabase = getSupabaseAdminClient()

    // 使用优化的SQL查询：一次性获取所有无效线程ID
    // 无效线程 = c2g类型 + 创建超过30天 + 该客人和该技师之间无已完成订单
    const { data: invalidThreadsData, error: threadsError } = await supabase.rpc(
      'get_invalid_chat_threads',
      { days_threshold: 30 } as any
    )

    if (threadsError) {
      console.error('[获取无效线程] 失败:', threadsError)
      return { ok: false, error: '获取无效线程失败' }
    }

    const allThreadIds: string[] = (invalidThreadsData as { thread_id: string }[] | null)?.map(t => t.thread_id) || []

    if (allThreadIds.length === 0) {
      return {
        ok: true,
        data: {
          success: true,
          deleted_count: 0,
          deleted_images_count: 0,
          image_paths: []
        }
      }
    }

    // 🚀 每次只删除前50条，避免超时
    const BATCH_SIZE = 50
    const threadIdsToDelete = allThreadIds.slice(0, BATCH_SIZE)
    const remainingCount = allThreadIds.length - threadIdsToDelete.length

    console.log(`[清理无效线程] 总共 ${allThreadIds.length} 个无效线程，本次删除 ${threadIdsToDelete.length} 个，剩余 ${remainingCount} 个`)

    // 收集这些线程的图片路径（用于统计）
    const { data: threadImages } = await supabase
      .from('chat_messages')
      .select('attachment_url, thread_id')
      .in('thread_id', threadIdsToDelete)
      .eq('content_type', 'image')
      .not('attachment_url', 'is', null)

    const imagePaths: string[] = (threadImages as { attachment_url: string; thread_id: string }[] | null)?.map(img => img.attachment_url) || []

    // 🚀 优化：先删除数据库，再异步删除存储桶（不阻塞）
    // 批量删除无效线程（会级联删除消息和已读记录）
    const { error: deleteError } = await supabase
      .from('chat_threads')
      .delete()
      .in('id', threadIdsToDelete)

    if (deleteError) {
      console.error('[清理无效线程] 失败:', deleteError)
      return { ok: false, error: '清理无效线程失败' }
    }

    // 🚀 异步删除存储桶文件（不等待完成，避免阻塞）
    // 即使存储桶删除失败，数据库已经删除了，不影响用户体验
    Promise.all(
      threadIdsToDelete.map(async (threadId) => {
        try {
          const { data: fileList } = await supabase.storage
            .from('chat-images')
            .list(threadId)

          if (fileList && fileList.length > 0) {
            const filesToDelete = fileList.map(file => `${threadId}/${file.name}`)
            await supabase.storage.from('chat-images').remove(filesToDelete)
          }
        } catch (storageError) {
          console.error(`[清理无效线程图片] 线程 ${threadId} 失败:`, storageError)
        }
      })
    ).catch(err => {
      console.error('[批量删除存储桶文件] 异常:', err)
    })

    // 记录审计日志
    await supabase.from('audit_logs').insert({
      admin_id: admin.id,
      action: 'cleanup_invalid_chat_threads',
      target_type: 'chat_threads',
      target_id: null,
      payload: {
        deleted_threads: threadIdsToDelete.length,
        total_invalid_threads: allThreadIds.length,
        remaining_threads: remainingCount,
        deleted_images: imagePaths.length,
        days_threshold: 30
      },
      ip_address: null
    } as any)

    console.log(`[清理无效线程] 成功删除 ${threadIdsToDelete.length} 个线程，${imagePaths.length} 张图片`)

    return {
      ok: true,
      data: {
        success: true,
        deleted_count: threadIdsToDelete.length,
        deleted_images_count: imagePaths.length,
        image_paths: imagePaths
      }
    }
  } catch (error) {
    console.error('[清理无效线程] 异常:', error)
    return { ok: false, error: error instanceof Error ? error.message : '清理无效线程失败' }
  }
}
