'use server'

import { getSupabaseAdminClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { AdminProfile } from '@/lib/types/admin'
import {
    approveMediaSchema,
    rejectMediaSchema,
    batchApproveMediaSchema,
    batchRejectMediaSchema,
    deleteMediaSchema,
    reorderMediaSchema,
    signUrlSchema,
    mediaListParamsSchema
} from '@/lib/features/media'
// 审计日志已移除 - 媒体管理不再记录操作日志
import type {
    MediaListItem,
    PaginatedMediaResponse,
    MediaStats,
    SignUrlResponse
} from '@/lib/features/media'

// 注意：现在统一使用 getSupabaseAdminClient()，不再需要单独创建客户端

/**
 * 从 tmp-uploads 拷贝文件到 girls-media
 */
async function copyMediaFile(supabase: any, sourcePath: string, destPath: string): Promise<boolean> {
    try {
        console.log('[Media Actions] Copying file from', sourcePath, 'to', destPath)

        // 1. 从源桶下载文件
        const { data: fileData, error: downloadError } = await supabase
            .storage
            .from('tmp-uploads')
            .download(sourcePath)

        if (downloadError) {
            console.error('[Media Actions] Download error:', downloadError)
            return false
        }

        // 2. 上传到目标桶
        const { error: uploadError } = await supabase
            .storage
            .from('girls-media')
            .upload(destPath, fileData, {
                contentType: fileData.type,
                upsert: false
            })

        if (uploadError) {
            console.error('[Media Actions] Upload error:', uploadError)
            return false
        }

        // 3. 删除源文件
        const { error: deleteError } = await supabase
            .storage
            .from('tmp-uploads')
            .remove([sourcePath])

        if (deleteError) {
            console.error('[Media Actions] Delete source error:', deleteError)
            // 不影响主流程，只记录错误
        }

        console.log('[Media Actions] File copied successfully')
        return true
    } catch (error) {
        console.error('[Media Actions] Copy file error:', error)
        return false
    }
}

/**
 * 处理 Live Photo 的文件拷贝
 */
async function copyLivePhotoFiles(
    supabase: any,
    meta: any,
    girlId: string,
    mediaId: string
): Promise<{ imageKey: string; videoKey: string } | null> {
    try {
        const live = meta?.live
        if (!live || !live.image_key || !live.video_key) {
            return null
        }

        // 构建目标路径
        const imageDestPath = `${girlId}/${mediaId}_image.jpg`
        const videoDestPath = `${girlId}/${mediaId}_video.mov`

        // 拷贝图片
        const imageSuccess = await copyMediaFile(supabase, live.image_key, imageDestPath)
        if (!imageSuccess) {
            return null
        }

        // 拷贝视频
        const videoSuccess = await copyMediaFile(supabase, live.video_key, videoDestPath)
        if (!videoSuccess) {
            // 删除已上传的图片
            await supabase.storage.from('girls-media').remove([imageDestPath])
            return null
        }

        return {
            imageKey: imageDestPath,
            videoKey: videoDestPath
        }
    } catch (error) {
        console.error('[Media Actions] Copy live photo error:', error)
        return null
    }
}

// 注意：现在统一使用 requireAdmin() 进行权限验证，不再需要单独的权限检查函数

/**
 * 获取媒体列表
 */
export async function getMediaList(params: unknown): Promise<PaginatedMediaResponse> {
    try {
        // 验证管理员权限（只有管理员和超级管理员可以查看媒体）
        const admin = await requireAdmin(['superadmin', 'admin'])
        console.log('[Media Actions] Fetching media list for admin:', admin.id)

        // 使用统一的 Admin 客户端
        const supabase = getSupabaseAdminClient()

        // 验证参数
        const validated = mediaListParamsSchema.parse(params)
        const { status, girl_id, kind, min_user_level, date_from, date_to, search, sort_by, sort_order, page, limit } = validated

        console.log('[Media Actions] Query params:', { status, girl_id, kind, min_user_level, date_from, date_to, search, sort_by, sort_order, page, limit })

        // 构建查询 - 先不使用关联查询，避免权限问题
        let query = supabase
            .from('girls_media')
            .select('*', { count: 'exact' })

        // 过滤条件
        if (status) {
            query = query.eq('status', status)
        }
        if (girl_id) {
            query = query.eq('girl_id', girl_id)
        }
        if (kind) {
            query = query.eq('kind', kind)
        }
        if (min_user_level !== undefined) {
            query = query.eq('min_user_level', min_user_level)
        }
        if (date_from) {
            query = query.gte('created_at', date_from)
        }
        if (date_to) {
            query = query.lte('created_at', date_to)
        }
        if (search) {
            // 支持按技师名称 / 用户名 / 工号搜索（工号格式示例："1001" 或 "#1001"）
            let normalized = search.trim()
            if (normalized.startsWith('#')) {
                normalized = normalized.slice(1)
            }

            const isNumeric = /^\d+$/.test(normalized)

            let girlsQuery = supabase
                .from('girls')
                .select('id')

            if (isNumeric) {
                const girlNumber = parseInt(normalized, 10)
                girlsQuery = girlsQuery.or(
                    `name.ilike.%${search}%,username.ilike.%${search}%,girl_number.eq.${girlNumber}`
                )
            } else {
                girlsQuery = girlsQuery.or(
                    `name.ilike.%${search}%,username.ilike.%${search}%`
                )
            }

            const { data: girls } = await girlsQuery

            if (girls && girls.length > 0) {
                query = query.in('girl_id', (girls as any[]).map((g: any) => g.id))
            } else {
                // 如果没有找到匹配的技师，返回空结果
                return {
                    data: [],
                    total: 0,
                    page,
                    limit,
                    has_next: false,
                    has_prev: false
                }
            }
        }

        // 排序
        query = query.order(sort_by, { ascending: sort_order === 'asc' })

        // 分页
        const from = (page - 1) * limit
        const to = from + limit - 1
        query = query.range(from, to)

        const { data, error, count } = await query

        if (error) {
            console.error('[Media Actions] Error fetching media list:', error)
            console.error('[Media Actions] Error details:', error.message, error.code, error.details)
            throw new Error(`获取媒体列表失败: ${error.message}`)
        }

        console.log('[Media Actions] Fetched', data?.length, 'media items')

        // 如果有数据，额外获取关联的技师和审核人信息
        let items: MediaListItem[] = []

        if (data && data.length > 0) {
            const girlIds = [...new Set(data.map((item: any) => item.girl_id).filter(Boolean))]
            const reviewerIds = [...new Set(data.map((item: any) => item.reviewed_by).filter(Boolean))]

            // 获取技师信息
            const girlsMap: Record<string, { name: string; username: string; girl_number: number | null }> = {}
            if (girlIds.length > 0) {
                const { data: girls } = await supabase
                    .from('girls')
                    .select('id, name, username, girl_number')
                    .in('id', girlIds)

                if (girls) {
                    girls.forEach((girl: any) => {
                        girlsMap[girl.id] = {
                            name: girl.name,
                            username: girl.username,
                            girl_number: girl.girl_number ?? null,
                        }
                    })
                }
            }

            // 获取审核人信息
            const reviewersMap: Record<string, string> = {}
            if (reviewerIds.length > 0) {
                const { data: reviewers } = await supabase
                    .from('admin_profiles')
                    .select('id, display_name')
                    .in('id', reviewerIds)

                if (reviewers) {
                    reviewers.forEach((reviewer: any) => {
                        reviewersMap[reviewer.id] = reviewer.display_name
                    })
                }
            }

            // 格式化数据
            items = data.map((item: any) => ({
                ...item,
                girl_name: item.girl_id ? girlsMap[item.girl_id]?.name : undefined,
                girl_username: item.girl_id ? girlsMap[item.girl_id]?.username : undefined,
                girl_number: item.girl_id ? girlsMap[item.girl_id]?.girl_number ?? null : null,
                reviewer_name: item.reviewed_by ? reviewersMap[item.reviewed_by] : undefined,
            }))
        }

        return {
            data: items,
            total: count || 0,
            page,
            limit,
            has_next: count ? (page * limit) < count : false,
            has_prev: page > 1
        }
    } catch (error) {
        console.error('Error in getMediaList:', error)
        throw error
    }
}

/**
 * 获取媒体统计
 */
export async function getMediaStats(): Promise<MediaStats> {
    try {
        // 验证管理员权限（只有管理员和超级管理员可以查看统计）
        await requireAdmin(['superadmin', 'admin'])

        // 使用统一的 Admin 客户端
        const supabase = getSupabaseAdminClient()

        // 分别统计三种状态的数量，避免全表扫描加载数据
        const [pendingRes, approvedRes, rejectedRes] = await Promise.all([
            (supabase as any)
                .from('girls_media')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'pending'),
            (supabase as any)
                .from('girls_media')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'approved'),
            (supabase as any)
                .from('girls_media')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'rejected'),
        ])

        const pending_count = pendingRes.count || 0
        const approved_count = approvedRes.count || 0
        const rejected_count = rejectedRes.count || 0

        return {
            pending_count,
            approved_count,
            rejected_count,
            total_count: pending_count + approved_count + rejected_count,
        }
    } catch (error) {
        console.error('Error in getMediaStats:', error)
        throw error
    }
}

/**
 * 审核通过媒体
 */
export async function approveMedia(data: unknown): Promise<{ success: boolean; error?: string }> {
    try {
        // 验证权限
        // 验证管理员权限（只有管理员和超级管理员可以审核媒体）
        const admin = await requireAdmin(['superadmin', 'admin'])
        console.log('[Media Actions] Approving media, admin:', admin.id)

        // 使用统一的 Admin 客户端
        const supabase = getSupabaseAdminClient()

        // 验证参数
        const validated = approveMediaSchema.parse(data)
        const { id, min_user_level } = validated

        // 获取媒体信息
        const { data: media, error: fetchError } = await (supabase as any)
            .from('girls_media')
            .select('*, girls:girl_id(id, name)')
            .eq('id', id)
            .single()

        if (fetchError || !media) {
            return { success: false, error: '媒体不存在' }
        }

        // 检查该技师的媒体数量是否超过30
        const { count } = await supabase
            .from('girls_media')
            .select('*', { count: 'exact', head: true })
            .eq('girl_id', media.girl_id)
            .in('status', ['pending', 'approved'])

        if (count && count >= 30) {
            return { success: false, error: '该技师媒体数量已达上限（30个）' }
        }

        const isCloudflareVideo = media.provider === 'cloudflare' && media.kind === 'video'

        // Cloudflare 视频：无需文件拷贝，只更新状态和 cloudflare 元数据
        if (isCloudflareVideo) {
            const existingMeta = media.meta || {}
            const cfMeta = (existingMeta as any).cloudflare || {}
            const newMeta = {
                ...existingMeta,
                cloudflare: {
                    ...cfMeta,
                    uid: cfMeta.uid || media.storage_key,
                    ready: true,
                },
            }

            const { error: updateError } = await (supabase as any)
                .from('girls_media')
                .update({
                    status: 'approved',
                    min_user_level,
                    reviewed_by: admin.id,
                    reviewed_at: new Date().toISOString(),
                    meta: newMeta,
                })
                .eq('id', id)

            if (updateError) {
                console.error('[Media Actions] Error updating cloudflare media:', updateError)
                return { success: false, error: `更新失败: ${updateError.message}` }
            }

            console.log('[Media Actions] Cloudflare media approved successfully')
            revalidatePath('/dashboard/media')
            return { success: true }
        }

        // Supabase 媒体：处理文件拷贝，从 tmp-uploads 到 girls-media
        let newStorageKey = media.storage_key
        let newThumbKey = media.thumb_key
        let newMeta = { ...media.meta }

        if (media.kind === 'live_photo') {
            // Live Photo 校验
            const live = media.meta?.live
            if (!live || !live.image_key || !live.video_key) {
                return { success: false, error: 'Live Photo 缺少配对资源' }
            }

            // 拷贝 Live Photo 的两个文件
            console.log('[Media Actions] Copying Live Photo files...')
            const liveResult = await copyLivePhotoFiles(supabase, media.meta, media.girl_id, id)
            if (!liveResult) {
                return { success: false, error: 'Live Photo 文件拷贝失败' }
            }

            // 更新存储路径
            newStorageKey = liveResult.videoKey
            newThumbKey = liveResult.imageKey
            newMeta = {
                ...media.meta,
                live: {
                    image_key: liveResult.imageKey,
                    video_key: liveResult.videoKey
                }
            }
        } else {
            // 普通图片或视频
            const destPath = `${media.girl_id}/${id}_${media.kind}.${media.storage_key.split('.').pop()}`

            console.log('[Media Actions] Copying media file...')
            const copySuccess = await copyMediaFile(supabase, media.storage_key, destPath)
            if (!copySuccess) {
                return { success: false, error: '文件拷贝失败' }
            }

            newStorageKey = destPath

            // 如果有缩略图，也拷贝缩略图
            if (media.thumb_key) {
                const thumbDestPath = `${media.girl_id}/${id}_thumb.jpg`
                const thumbSuccess = await copyMediaFile(supabase, media.thumb_key, thumbDestPath)
                if (thumbSuccess) {
                    newThumbKey = thumbDestPath
                }
            }
        }

        // 更新媒体状态和存储路径
        const { error: updateError } = await (supabase as any)
            .from('girls_media')
            .update({
                status: 'approved',
                min_user_level,
                reviewed_by: admin.id,
                reviewed_at: new Date().toISOString(),
                storage_key: newStorageKey,
                thumb_key: newThumbKey,
                meta: newMeta
            })
            .eq('id', id)

        if (updateError) {
            console.error('[Media Actions] Error updating media:', updateError)
            return { success: false, error: `更新失败: ${updateError.message}` }
        }

        console.log('[Media Actions] Media approved successfully')

        revalidatePath('/dashboard/media')
        return { success: true }
    } catch (error) {
        console.error('Error in approveMedia:', error)
        return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
}

/**
 * 审核驳回媒体
 */
export async function rejectMedia(data: unknown): Promise<{ success: boolean; error?: string }> {
    try {
        // 验证权限
        // 验证管理员权限（只有管理员和超级管理员可以审核媒体）
        const admin = await requireAdmin(['superadmin', 'admin'])
        console.log('[Media Actions] Rejecting media, admin:', admin.id)

        // 使用统一的 Admin 客户端
        const supabase = getSupabaseAdminClient()

        // 验证参数
        const validated = rejectMediaSchema.parse(data)
        const { id, reason } = validated

        // 获取媒体信息
        const { data: media, error: fetchError } = await (supabase as any)
            .from('girls_media')
            .select('girl_id, storage_key, thumb_key')
            .eq('id', id)
            .single()

        if (fetchError || !media) {
            return { success: false, error: '媒体不存在' }
        }

        // 更新媒体状态
        const { error: updateError } = await (supabase as any)
            .from('girls_media')
            .update({
                status: 'rejected',
                reject_reason: reason,
                reviewed_by: admin.id,
                reviewed_at: new Date().toISOString()
            })
            .eq('id', id)

        if (updateError) {
            console.error('Error updating media:', updateError)
            return { success: false, error: `更新失败: ${updateError.message}` }
        }

        // 驳回后文件保留在 tmp-uploads 中，不删除（用户可能需要恢复）
        console.log('[Media Actions] Media rejected, files kept in tmp-uploads')

        revalidatePath('/dashboard/media')
        return { success: true }
    } catch (error) {
        console.error('Error in rejectMedia:', error)
        return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
}

/**
 * 批量审核通过媒体
 */
export async function batchApproveMedia(data: unknown): Promise<{ success: boolean; error?: string }> {
    try {
        // 验证管理员权限（只有管理员和超级管理员可以批量审核媒体）
        const admin = await requireAdmin(['superadmin', 'admin'])
        console.log('[Media Actions] Batch approving media, admin:', admin.id)

        // 使用统一的 Admin 客户端
        const supabase = getSupabaseAdminClient()

        const validated = batchApproveMediaSchema.parse(data)
        const { ids, min_user_level } = validated

        // 获取所有媒体信息
        const { data: mediaList, error: fetchError } = await (supabase as any)
            .from('girls_media')
            .select('*')
            .in('id', ids)

        if (fetchError || !mediaList) {
            return { success: false, error: '获取媒体信息失败' }
        }

        // 逐个处理文件拷贝
        const successIds: string[] = []
        const failedIds: string[] = []

        for (const media of mediaList) {
            try {
                const isCloudflareVideo = media.provider === 'cloudflare' && media.kind === 'video'

                // Cloudflare 视频：只更新状态与 cloudflare 元数据
                if (isCloudflareVideo) {
                    const existingMeta = media.meta || {}
                    const cfMeta = (existingMeta as any).cloudflare || {}
                    const newMeta = {
                        ...existingMeta,
                        cloudflare: {
                            ...cfMeta,
                            uid: cfMeta.uid || media.storage_key,
                            ready: true,
                        },
                    }

                    const { error: updateError } = await (supabase as any)
                        .from('girls_media')
                        .update({
                            status: 'approved',
                            min_user_level,
                            reviewed_by: admin.id,
                            reviewed_at: new Date().toISOString(),
                            meta: newMeta,
                        })
                        .eq('id', (media as any).id)

                    if (updateError) {
                        console.error(`[Batch Approve] Failed to update cloudflare media: ${media.id}`, updateError)
                        failedIds.push(media.id)
                    } else {
                        successIds.push(media.id)
                    }
                    continue
                }

                // Supabase 媒体：仍然走文件拷贝逻辑
                let newStorageKey = media.storage_key
                let newThumbKey = media.thumb_key
                let newMeta = { ...media.meta }

                if (media.kind === 'live_photo') {
                    // Live Photo 文件拷贝
                    const liveResult = await copyLivePhotoFiles(supabase, media.meta, media.girl_id, media.id)
                    if (!liveResult) {
                        console.error(`[Batch Approve] Failed to copy live photo: ${media.id}`)
                        failedIds.push(media.id)
                        continue
                    }
                    newStorageKey = liveResult.videoKey
                    newThumbKey = liveResult.imageKey
                    newMeta = {
                        ...media.meta,
                        live: {
                            image_key: liveResult.imageKey,
                            video_key: liveResult.videoKey
                        }
                    }
                } else {
                    // 普通图片或视频
                    const destPath = `${media.girl_id}/${media.id}_${media.kind}.${media.storage_key.split('.').pop()}`
                    const copySuccess = await copyMediaFile(supabase, media.storage_key, destPath)
                    if (!copySuccess) {
                        console.error(`[Batch Approve] Failed to copy media: ${media.id}`)
                        failedIds.push(media.id)
                        continue
                    }
                    newStorageKey = destPath

                    // 拷贝缩略图
                    if (media.thumb_key) {
                        const thumbDestPath = `${media.girl_id}/${media.id}_thumb.jpg`
                        const thumbSuccess = await copyMediaFile(supabase, media.thumb_key, thumbDestPath)
                        if (thumbSuccess) {
                            newThumbKey = thumbDestPath
                        }
                    }
                }

                // 更新单个媒体
                const { error: updateError } = await (supabase as any)
                    .from('girls_media')
                    .update({
                        status: 'approved',
                        min_user_level,
                        reviewed_by: admin.id,
                        reviewed_at: new Date().toISOString(),
                        storage_key: newStorageKey,
                        thumb_key: newThumbKey,
                        meta: newMeta
                    })
                    .eq('id', (media as any).id)

                if (updateError) {
                    console.error(`[Batch Approve] Failed to update media: ${media.id}`, updateError)
                    failedIds.push(media.id)
                } else {
                    successIds.push(media.id)
                }
            } catch (error) {
                console.error(`[Batch Approve] Error processing media: ${media.id}`, error)
                failedIds.push(media.id)
            }
        }

        console.log(`[Batch Approve] Success: ${successIds.length}, Failed: ${failedIds.length}`)

        revalidatePath('/dashboard/media')

        if (failedIds.length > 0) {
            return {
                success: true,
                error: `部分媒体审批失败: ${successIds.length} 成功, ${failedIds.length} 失败`
            }
        }

        return { success: true }
    } catch (error) {
        console.error('Error in batchApproveMedia:', error)
        return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
}

/**
 * 批量审核驳回媒体
 */
export async function batchRejectMedia(data: unknown): Promise<{ success: boolean; error?: string }> {
    try {
        // 验证管理员权限（只有管理员和超级管理员可以批量审核媒体）
        const admin = await requireAdmin(['superadmin', 'admin'])
        console.log('[Media Actions] Batch rejecting media, admin:', admin.id)

        // 使用统一的 Admin 客户端
        const supabase = getSupabaseAdminClient()

        const validated = batchRejectMediaSchema.parse(data)
        const { ids, reason } = validated

        // 批量更新
        const { error: updateError } = await (supabase as any)
            .from('girls_media')
            .update({
                status: 'rejected',
                reject_reason: reason,
                reviewed_by: admin.id,
                reviewed_at: new Date().toISOString()
            })
            .in('id', ids)

        if (updateError) {
            console.error('Error batch updating media:', updateError)
            return { success: false, error: `批量更新失败: ${updateError.message}` }
        }

        revalidatePath('/dashboard/media')
        return { success: true }
    } catch (error) {
        console.error('Error in batchRejectMedia:', error)
        return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
}

/**
 * 删除媒体
 */
export async function deleteMedia(data: unknown): Promise<{ success: boolean; error?: string }> {
    try {
        // 验证管理员权限（只有管理员和超级管理员可以删除媒体）
        const admin = await requireAdmin(['superadmin', 'admin'])
        console.log('[Media Actions] Deleting media, admin:', admin.id)

        // 使用统一的 Admin 客户端
        const supabase = getSupabaseAdminClient()

        const validated = deleteMediaSchema.parse(data)
        const { id } = validated

        // 获取媒体信息（包含 kind 和 meta，方便处理 Cloudflare 视频）
        const { data: media, error: fetchError } = await (supabase as any)
            .from('girls_media')
            .select('girl_id, storage_key, thumb_key, status, provider, kind, meta')
            .eq('id', id)
            .single()

        if (fetchError || !media) {
            return { success: false, error: '媒体不存在' }
        }

        // 删除数据库记录
        const { error: deleteError } = await (supabase as any)
            .from('girls_media')
            .delete()
            .eq('id', id)

        if (deleteError) {
            console.error('Error deleting media:', deleteError)
            return { success: false, error: `删除失败: ${deleteError.message}` }
        }

        // 删除 Supabase 存储中的文件（Cloudflare 媒体不走 Supabase Storage）
        if (media.provider === 'supabase') {
            if (media.storage_key) {
                const bucket = media.status === 'approved' ? 'girls-media' : 'tmp-uploads'
                await supabase.storage.from(bucket).remove([media.storage_key])
            }
            if (media.thumb_key) {
                const bucket = media.status === 'approved' ? 'girls-media' : 'tmp-uploads'
                await supabase.storage.from(bucket).remove([media.thumb_key])
            }
        }

        // 删除 Cloudflare Stream 源视频（仅针对 Cloudflare 提供商的视频）
        if (media.provider === 'cloudflare' && media.kind === 'video') {
            const meta = (media as any).meta || {}
            const cfUid = meta.cloudflare?.uid || media.storage_key

            const accountId = process.env.CF_ACCOUNT_ID
            const apiToken = process.env.CF_STREAM_TOKEN

            if (!accountId || !apiToken) {
                console.error('[Media Actions] Cloudflare 删除配置缺失，无法删除源视频')
            } else if (cfUid) {
                try {
                    const resp = await fetch(
                        `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${cfUid}`,
                        {
                            method: 'DELETE',
                            headers: {
                                Authorization: `Bearer ${apiToken}`,
                            },
                        },
                    )

                    if (!resp.ok && resp.status !== 404) {
                        console.error('[Media Actions] 删除 Cloudflare 视频失败:', resp.status, await resp.text())
                    }
                } catch (err) {
                    console.error('[Media Actions] 调用 Cloudflare Stream 删除接口异常:', err)
                }
            }
        }

        revalidatePath('/dashboard/media')
        return { success: true }
    } catch (error) {
        console.error('Error in deleteMedia:', error)
        return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
}

/**
 * 媒体重排序
 */
export async function reorderMedia(data: unknown): Promise<{ success: boolean; error?: string }> {
    try {
        // 验证管理员权限（只有管理员和超级管理员可以重排序媒体）
        const admin = await requireAdmin(['superadmin', 'admin'])
        console.log('[Media Actions] Reordering media, admin:', admin.id)

        // 使用统一的 Admin 客户端
        const supabase = getSupabaseAdminClient()

        const validated = reorderMediaSchema.parse(data)
        const { girl_id, items } = validated

        // 批量更新排序
        for (const item of items) {
            const { error } = await (supabase as any)
                .from('girls_media')
                .update({ sort_order: item.sort_order })
                .eq('id', item.id)
                .eq('girl_id', girl_id) // 确保只能排序同一技师的媒体

            if (error) {
                console.error('Error updating sort_order:', error)
                return { success: false, error: `排序更新失败: ${error.message}` }
            }
        }

        revalidatePath('/dashboard/media')
        return { success: true }
    } catch (error) {
        console.error('Error in reorderMedia:', error)
        return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
}

/**
 * 生成签名 URL
 */
export async function generateSignedUrl(data: unknown): Promise<SignUrlResponse | null> {
    try {
        // 验证管理员权限（只有管理员和超级管理员可以生成签名URL）
        await requireAdmin(['superadmin', 'admin'])

        // 使用统一的 Admin 客户端
        const supabase = getSupabaseAdminClient()

        const validated = signUrlSchema.parse(data)
        const { key, bucket, expires_in } = validated

        // 生成签名 URL
        const { data: signedData, error } = await supabase
            .storage
            .from(bucket)
            .createSignedUrl(key, expires_in || 3600)

        if (error || !signedData) {
            console.error('Error generating signed URL:', error)
            throw new Error(`生成签名URL失败: ${error?.message}`)
        }

        return {
            url: signedData.signedUrl,
            expires_at: new Date(Date.now() + (expires_in || 3600) * 1000).toISOString()
        }
    } catch (error) {
        console.error('Error in generateSignedUrl:', error)
        return null
    }
}

/**
 * 修改媒体的会员等级
 */
export async function updateMediaLevel(data: { id: string; min_user_level: number }): Promise<{ success: boolean; error?: string }> {
    try {
        // 验证管理员权限（只有管理员和超级管理员可以修改媒体等级）
        const admin = await requireAdmin(['superadmin', 'admin'])
        console.log('[Media Actions] Updating media level, admin:', admin.id)

        // 使用统一的 Admin 客户端
        const supabase = getSupabaseAdminClient()

        const { id, min_user_level } = data

        // 验证等级范围
        if (min_user_level < 0 || min_user_level > 10) {
            return { success: false, error: '会员等级必须在 0-10 之间' }
        }

        // 更新等级
        const { error } = await (supabase as any)
            .from('girls_media')
            .update({ min_user_level })
            .eq('id', id)
            .eq('status', 'approved') // 只能修改已发布的媒体

        if (error) {
            console.error('Error updating media level:', error)
            return { success: false, error: `更新失败: ${error.message}` }
        }

        revalidatePath('/dashboard/media')
        return { success: true }
    } catch (error) {
        console.error('Error in updateMediaLevel:', error)
        return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
}

/**
 * 恢复为待审核状态（从驳回箱恢复）
 */
export async function restoreToPending(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        // 验证管理员权限（只有管理员和超级管理员可以恢复媒体）
        const admin = await requireAdmin(['superadmin', 'admin'])
        console.log('[Media Actions] Restoring to pending, admin:', admin.id)

        // 使用统一的 Admin 客户端
        const supabase = getSupabaseAdminClient()

        // 更新状态
        const { error } = await (supabase as any)
            .from('girls_media')
            .update({
                status: 'pending',
                reject_reason: null,
                reviewed_by: null,
                reviewed_at: null,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .eq('status', 'rejected')

        if (error) {
            console.error('Error restoring media:', error)
            return { success: false, error: `恢复失败: ${error.message}` }
        }

        revalidatePath('/dashboard/media')
        return { success: true }
    } catch (error) {
        console.error('Error in restoreToPending:', error)
        return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
}
