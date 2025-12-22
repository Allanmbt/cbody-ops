"use server"

import { getSupabaseAdminClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/auth"

/**
 * 会话统计
 */
export interface ChatStats {
    active: number        // 活跃会话（24小时内有消息）
    today_new: number     // 今日新增
    locked: number        // 已锁定会话
}

/**
 * 会话筛选参数
 */
export interface ChatThreadFilters {
    search?: string                    // 搜索参与者
    thread_type?: 'c2g' | 's2c' | 's2g' | 'all'  // 会话类型
    only_active?: boolean              // 仅活跃（24小时内有消息）
    has_order?: boolean                // 有关联订单
    page?: number
    limit?: number
}

/**
 * 获取会话统计
 */
export async function getChatStats() {
    try {
        const admin = await requireAdmin(['superadmin', 'admin', 'support'], { allowMumuForOperations: true })
        const supabase = getSupabaseAdminClient()

        // 判断是否需要过滤 sort_order < 998 的技师会话
        const shouldFilterSortOrder = admin.role !== 'superadmin' && admin.role !== 'admin'

        // ✅ 优化：使用 RPC 函数一次性获取所有统计（3次查询 → 1次）
        const { data: rpcData, error: rpcError } = await (supabase as any).rpc('get_chat_stats', {
            p_filter_sort_order: shouldFilterSortOrder
        })

        if (!rpcError && rpcData) {
            return {
                ok: true as const,
                data: rpcData as ChatStats
            }
        }

        // 回退方案：如果 RPC 不可用，使用原来的方式
        console.warn('[会话统计] RPC 不可用，使用回退方案')

        // 如果需要过滤，先获取允许的技师ID列表
        let allowedGirlIds: string[] | null = null
        if (shouldFilterSortOrder) {
            const { data: girls } = await supabase
                .from('girls')
                .select('id')
                .gte('sort_order', 998)
            allowedGirlIds = girls ? girls.map((g: any) => g.id) : []
        }

        const now = new Date()
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

        // 活跃会话（需要过滤技师）
        let activeQuery = supabase
            .from('chat_threads')
            .select('*', { count: 'exact', head: true })
            .gte('last_message_at', yesterday.toISOString())

        // 过滤：只统计 girl_id 为 null（非技师会话）或在允许列表中的会话
        if (allowedGirlIds !== null) {
            if (allowedGirlIds.length > 0) {
                activeQuery = activeQuery.or(`girl_id.is.null,girl_id.in.(${allowedGirlIds.join(',')})`)
            } else {
                // 如果没有允许的技师，只统计非技师会话
                activeQuery = activeQuery.is('girl_id', null)
            }
        }
        const { count: activeCount } = await activeQuery

        // 今日新增会话
        let todayNewQuery = supabase
            .from('chat_threads')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', todayStart.toISOString())

        if (allowedGirlIds !== null) {
            if (allowedGirlIds.length > 0) {
                todayNewQuery = todayNewQuery.or(`girl_id.is.null,girl_id.in.(${allowedGirlIds.join(',')})`)
            } else {
                todayNewQuery = todayNewQuery.is('girl_id', null)
            }
        }
        const { count: todayNewCount } = await todayNewQuery

        // 已锁定会话
        let lockedQuery = supabase
            .from('chat_threads')
            .select('*', { count: 'exact', head: true })
            .eq('is_locked', true)

        if (allowedGirlIds !== null) {
            if (allowedGirlIds.length > 0) {
                lockedQuery = lockedQuery.or(`girl_id.is.null,girl_id.in.(${allowedGirlIds.join(',')})`)
            } else {
                lockedQuery = lockedQuery.is('girl_id', null)
            }
        }
        const { count: lockedCount } = await lockedQuery

        return {
            ok: true as const,
            data: {
                active: activeCount || 0,
                today_new: todayNewCount || 0,
                locked: lockedCount || 0
            } as ChatStats
        }
    } catch (error) {
        console.error('[会话统计] 获取失败:', error)
        return { ok: false as const, error: "获取会话统计失败" }
    }
}

/**
 * 获取会话列表
 */
export async function getChatThreads(filters: ChatThreadFilters = {}) {
    try {
        const admin = await requireAdmin(['superadmin', 'admin', 'support'], { allowMumuForOperations: true })
        const supabase = getSupabaseAdminClient()

        // 判断是否需要过滤 sort_order < 998 的技师会话
        const shouldFilterSortOrder = admin.role !== 'superadmin' && admin.role !== 'admin'

        const {
            search,
            thread_type,
            only_active = false,
            has_order = false,
            page = 1,
            limit = 50
        } = filters

        // ✅ 优化：使用视图查询，预关联用户和技师信息（移除 N+1 查询）
        let query = supabase
            .from('v_chat_monitoring')
            .select('*', { count: 'exact' })

        // 添加 sort_order 过滤（视图应包含 girl_sort_order 字段）
        if (shouldFilterSortOrder) {
            // 过滤：girl_id 为 null 或 girl_sort_order >= 998
            query = query.or('girl_id.is.null,girl_sort_order.gte.998')
        }

        // 类型筛选
        if (thread_type && thread_type !== 'all') {
            query = query.eq('thread_type', thread_type)
        }

        // 仅活跃（24小时内有消息）
        if (only_active) {
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
            query = query.gte('last_message_at', yesterday.toISOString())
        }

        // ✅ 优化：有订单筛选（数据库层面）
        if (has_order) {
            query = query.not('related_order', 'is', null)
        }

        // ✅ 优化：搜索筛选（支持参与者名称/用户名 + 订单号）
        if (search) {
            // 尝试搜索订单号（如果输入包含订单号特征）
            query = query.or(`customer_display_name.ilike.%${search}%,customer_username.ilike.%${search}%,girl_name.ilike.%${search}%,girl_username.ilike.%${search}%,support_display_name.ilike.%${search}%,support_username.ilike.%${search}%,related_order->>order_number.ilike.%${search}%`)
        }

        // 排序：最后消息时间倒序
        query = query.order('last_message_at', { ascending: false, nullsFirst: false })

        // 分页
        const from = (page - 1) * limit
        const to = from + limit - 1
        query = query.range(from, to)

        const { data: threadsData, error, count } = await query

        if (error) {
            console.error('[会话监管] 查询失败:', error)
            return { ok: false as const, error: `查询会话失败: ${error.message}` }
        }

        if (!threadsData || threadsData.length === 0) {
            return {
                ok: true as const,
                data: {
                    threads: [],
                    total: count || 0,
                    page,
                    limit,
                    totalPages: 0
                }
            }
        }

        // ✅ 优化：视图已包含所有关联数据，直接格式化即可
        const enrichedThreads = threadsData.map((thread: any) => {
            // 组装客户信息（包含完整用户资料）
            const customer = thread.customer_user_id ? {
                id: thread.customer_user_id,
                username: thread.customer_username,
                display_name: thread.customer_display_name,
                avatar_url: thread.customer_avatar_url,
                level: thread.customer_level,
                phone_country_code: thread.customer_phone_country_code,
                phone_number: thread.customer_phone_number,
                country_code: thread.customer_country_code,
                language_code: thread.customer_language_code,
                credit_score: thread.customer_credit_score
            } : null

            // 组装技师信息
            const girl = thread.girl_id_full ? {
                id: thread.girl_id_full,
                girl_number: thread.girl_number,
                name: thread.girl_name,
                username: thread.girl_username,
                avatar_url: thread.girl_avatar_url
            } : null

            // 组装客服信息
            const support = thread.support_user_id ? {
                id: thread.support_user_id,
                username: thread.support_username,
                display_name: thread.support_display_name,
                avatar_url: thread.support_avatar_url
            } : null

            return {
                id: thread.id,
                thread_type: thread.thread_type,
                customer_id: thread.customer_id,
                girl_id: thread.girl_id,
                support_id: thread.support_id,
                is_locked: thread.is_locked,
                last_message_at: thread.last_message_at,
                last_message_text: thread.last_message_text,
                created_at: thread.created_at,
                updated_at: thread.updated_at,
                customer,
                girl,
                support,
                order: thread.related_order,
                unread_counts: {} // 暂时不显示未读数，后续可用 RPC 优化
            }
        })

        const totalPages = Math.ceil((count || 0) / limit)

        return {
            ok: true as const,
            data: {
                threads: enrichedThreads,
                total: count || 0,
                page,
                limit,
                totalPages
            }
        }
    } catch (error) {
        console.error('[会话监管] 查询异常:', error)
        return { ok: false as const, error: "查询会话异常" }
    }
}

/**
 * 锁定/解锁会话
 */
export async function toggleThreadLock(
    threadId: string,
    isLocked: boolean
): Promise<{ ok: boolean; error?: string }> {
    try {
        const admin = await requireAdmin(['superadmin', 'admin', 'support'], { allowMumuForOperations: true })
        const supabase = getSupabaseAdminClient()

        const { error: updateError } = await (supabase as any)
            .from('chat_threads')
            .update({
                is_locked: isLocked,
                updated_at: new Date().toISOString()
            })
            .eq('id', threadId)

        if (updateError) {
            console.error('[锁定会话] 更新失败:', updateError)
            return { ok: false, error: "锁定会话失败" }
        }

        console.log(`[锁定会话] 会话 ${threadId} ${isLocked ? '已锁定' : '已解锁'}, 操作人: ${admin.display_name}`)

        return { ok: true }
    } catch (error) {
        console.error('[锁定会话] 操作异常:', error)
        return { ok: false, error: "锁定会话异常" }
    }
}

/**
 * 获取客户订单历史
 */
export async function getCustomerOrderHistory(
    customerId: string,
    page = 1,
    limit = 20
): Promise<{ ok: boolean; data?: { orders: any[]; total: number; page: number; limit: number; totalPages: number }; error?: string }> {
    try {
        const admin = await requireAdmin(['superadmin', 'admin', 'support'], { allowMumuForOperations: true })
        const supabase = getSupabaseAdminClient()

        // 判断是否需要过滤 sort_order < 998 的技师订单
        const shouldFilterSortOrder = admin.role !== 'superadmin' && admin.role !== 'admin'

        // 如果需要过滤，先获取允许的技师ID列表
        let allowedGirlIds: string[] | null = null
        if (shouldFilterSortOrder) {
            const { data: girls } = await supabase
                .from('girls')
                .select('id')
                .gte('sort_order', 998)
            allowedGirlIds = girls ? girls.map((g: any) => g.id) : []

            // 如果没有允许的技师，返回空结果
            if (allowedGirlIds.length === 0) {
                return {
                    ok: true,
                    data: {
                        orders: [],
                        total: 0,
                        page,
                        limit,
                        totalPages: 0
                    }
                }
            }
        }

        // 查询客户的订单历史（订单表使用 user_id 而不是 customer_id）
        let query = supabase
            .from('orders')
            .select(`
                id,
                order_number,
                status,
                total_amount,
                service_name,
                created_at,
                girl:girls!girl_id(id, girl_number, name, avatar_url, sort_order)
            `, { count: 'exact' })
            .eq('user_id', customerId)
            .order('created_at', { ascending: false })

        // 添加 girl_id 过滤
        if (allowedGirlIds && allowedGirlIds.length > 0) {
            query = query.in('girl_id', allowedGirlIds)
        }

        // 分页
        const from = (page - 1) * limit
        const to = from + limit - 1
        query = query.range(from, to)

        const { data: ordersData, error, count } = await query

        if (error) {
            console.error('[客户订单历史] 查询失败:', error)
            return { ok: false, error: "查询订单历史失败" }
        }

        const totalPages = Math.ceil((count || 0) / limit)

        return {
            ok: true,
            data: {
                orders: ordersData || [],
                total: count || 0,
                page,
                limit,
                totalPages
            }
        }
    } catch (error) {
        console.error('[客户订单历史] 查询异常:', error)
        return { ok: false, error: "查询订单历史异常" }
    }
}

/**
 * 获取用户邮箱（从 auth.users）
 */
export async function getUserEmail(userId: string): Promise<{ ok: boolean; email?: string; error?: string }> {
    try {
        await requireAdmin(['superadmin', 'admin', 'support'], { allowMumuForOperations: true })
        const supabase = getSupabaseAdminClient()

        const { data, error } = await supabase.auth.admin.getUserById(userId)

        if (error || !data.user) {
            return { ok: false, error: "获取用户邮箱失败" }
        }

        return { ok: true, email: data.user.email }
    } catch (error) {
        console.error('[获取用户邮箱] 异常:', error)
        return { ok: false, error: "获取用户邮箱异常" }
    }
}

/**
 * 获取会话消息列表
 */
export async function getChatMessages(threadId: string, page = 1, limit = 50) {
    try {
        await requireAdmin(['superadmin', 'admin', 'support'], { allowMumuForOperations: true })
        const supabase = getSupabaseAdminClient()

        const from = (page - 1) * limit
        const to = from + limit - 1

        const { data: messagesData, error, count } = await supabase
            .from('chat_messages')
            .select(`
        id,
        sender_id,
        sender_role,
        content_type,
        text_content,
        attachment_url,
        attachment_meta,
        order_id,
        created_at
      `, { count: 'exact' })
            .eq('thread_id', threadId)
            .order('created_at', { ascending: false })
            .range(from, to)

        if (error) {
            console.error('[会话消息] 查询失败:', error)
            return { ok: false, error: `查询消息失败: ${error.message}` }
        }

        // 查询发送者信息
        const senderIds = new Set<string>()
        messagesData?.forEach((msg: any) => {
            if (msg.sender_id) senderIds.add(msg.sender_id)
        })

        const sendersMap = new Map()
        if (senderIds.size > 0) {
            const { data: usersData } = await supabase
                .from('user_profiles')
                .select('id, username, display_name, avatar_url')
                .in('id', Array.from(senderIds))

            if (usersData) {
                usersData.forEach((user: any) => {
                    sendersMap.set(user.id, user)
                })
            }

            // 查询技师信息
            const { data: girlsData } = await supabase
                .from('girls')
                .select('id, user_id, girl_number, name, username, avatar_url')
                .in('user_id', Array.from(senderIds))

            if (girlsData) {
                girlsData.forEach((girl: any) => {
                    sendersMap.set(girl.user_id, {
                        ...girl,
                        display_name: girl.name,
                        username: girl.username
                    })
                })
            }
        }

        // ✅ 为图片消息生成签名 URL
        const enrichedMessages = await Promise.all(
            (messagesData || []).map(async (msg: any) => {
                let signedImageUrl: string | null = null

                // 如果是图片消息且有 attachment_url，生成签名 URL
                if (msg.content_type === 'image' && msg.attachment_url) {
                    try {
                        const { data: signedData } = await supabase
                            .storage
                            .from('chat-images')
                            .createSignedUrl(msg.attachment_url, 3600) // 1小时有效期

                        if (signedData?.signedUrl) {
                            signedImageUrl = signedData.signedUrl
                        }
                    } catch (error) {
                        console.error('[会话消息] 生成图片签名URL失败:', error)
                        // 失败不阻断，继续返回原路径
                    }
                }

                return {
                    ...msg,
                    sender: sendersMap.get(msg.sender_id) || null,
                    // 优先使用签名 URL，否则使用原路径
                    attachment_url: signedImageUrl || msg.attachment_url
                }
            })
        )

        return {
            ok: true,
            data: {
                messages: enrichedMessages || [],
                total: count || 0,
                page,
                limit
            }
        }
    } catch (error) {
        console.error('[会话消息] 查询异常:', error)
        return { ok: false, error: "查询消息异常" }
    }
}
