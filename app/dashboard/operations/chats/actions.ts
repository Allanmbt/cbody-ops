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
        await requireAdmin()
        const supabase = getSupabaseAdminClient()

        const now = new Date()
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

        // 活跃会话（24小时内有消息）
        const { count: activeCount } = await supabase
            .from('chat_threads')
            .select('*', { count: 'exact', head: true })
            .gte('last_message_at', yesterday.toISOString())

        // 今日新增会话
        const { count: todayNewCount } = await supabase
            .from('chat_threads')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', todayStart.toISOString())

        // 已锁定会话
        const { count: lockedCount } = await supabase
            .from('chat_threads')
            .select('*', { count: 'exact', head: true })
            .eq('is_locked', true)

        return {
            ok: true,
            data: {
                active: activeCount || 0,
                today_new: todayNewCount || 0,
                locked: lockedCount || 0
            } as ChatStats
        }
    } catch (error) {
        console.error('[会话统计] 获取失败:', error)
        return { ok: false, error: "获取会话统计失败" }
    }
}

/**
 * 获取会话列表
 */
export async function getChatThreads(filters: ChatThreadFilters = {}) {
    try {
        await requireAdmin()
        const supabase = getSupabaseAdminClient()

        const {
            search,
            thread_type,
            only_active = false,
            has_order = false,
            page = 1,
            limit = 50
        } = filters

        // 构建查询
        let query = supabase
            .from('chat_threads')
            .select(`
        id,
        thread_type,
        customer_id,
        girl_id,
        support_id,
        is_locked,
        last_message_at,
        last_message_text,
        created_at,
        updated_at
      `, { count: 'exact' })

        // 类型筛选
        if (thread_type && thread_type !== 'all') {
            query = query.eq('thread_type', thread_type)
        }

        // 仅活跃（24小时内有消息）
        if (only_active) {
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
            query = query.gte('last_message_at', yesterday.toISOString())
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
            return { ok: false, error: `查询会话失败: ${error.message}` }
        }

        if (!threadsData || threadsData.length === 0) {
            return {
                ok: true,
                data: {
                    threads: [],
                    total: count || 0,
                    page,
                    limit,
                    totalPages: 0
                }
            }
        }

        // 提取所有用户ID和技师ID
        const userIds = new Set<string>()
        const girlIds = new Set<string>()

        threadsData.forEach((thread: any) => {
            if (thread.customer_id) userIds.add(thread.customer_id)
            if (thread.support_id) userIds.add(thread.support_id)
            if (thread.girl_id) girlIds.add(thread.girl_id)
        })

        // 批量查询用户信息
        const usersMap = new Map()
        if (userIds.size > 0) {
            const { data: usersData } = await supabase
                .from('user_profiles')
                .select('id, username, display_name, avatar_url')
                .in('id', Array.from(userIds))

            if (usersData) {
                usersData.forEach((user: any) => {
                    usersMap.set(user.id, user)
                })
            }
        }

        // 批量查询技师信息
        const girlsMap = new Map()
        if (girlIds.size > 0) {
            const { data: girlsData } = await supabase
                .from('girls')
                .select('id, girl_number, name, username, avatar_url')
                .in('id', Array.from(girlIds))

            if (girlsData) {
                girlsData.forEach((girl: any) => {
                    girlsMap.set(girl.id, girl)
                })
            }
        }

        // 批量查询未读数（通过 chat_receipts）
        const unreadMap = new Map()
        for (const thread of threadsData as any[]) {
            const threadId = thread.id

            // 获取该线程的所有参与者的已读记录
            const { data: receiptsData } = await supabase
                .from('chat_receipts')
                .select('user_id, last_read_at')
                .eq('thread_id', threadId)

            // 获取该线程的消息总数和最后消息时间
            const { count: totalMessages } = await supabase
                .from('chat_messages')
                .select('*', { count: 'exact', head: true })
                .eq('thread_id', threadId)

            const receiptsMap = new Map()
            if (receiptsData) {
                receiptsData.forEach((r: any) => {
                    receiptsMap.set(r.user_id, r.last_read_at)
                })
            }

            // 计算每个参与者的未读数
            const unreadCounts: any = {}

            if (thread.customer_id) {
                const lastRead = receiptsMap.get(thread.customer_id)
                const { count } = await supabase
                    .from('chat_messages')
                    .select('*', { count: 'exact', head: true })
                    .eq('thread_id', threadId)
                    .neq('sender_id', thread.customer_id)
                    .gt('created_at', lastRead || '1970-01-01')

                unreadCounts.customer = count || 0
            }

            if (thread.girl_id) {
                const girlUserId = girlsMap.get(thread.girl_id)?.user_id
                if (girlUserId) {
                    const lastRead = receiptsMap.get(girlUserId)
                    const { count } = await supabase
                        .from('chat_messages')
                        .select('*', { count: 'exact', head: true })
                        .eq('thread_id', threadId)
                        .neq('sender_id', girlUserId)
                        .gt('created_at', lastRead || '1970-01-01')

                    unreadCounts.girl = count || 0
                }
            }

            unreadMap.set(threadId, unreadCounts)
        }

        // 批量查询关联订单
        const ordersMap = new Map()
        if (has_order) {
            const threadIds = threadsData.map((t: any) => t.id)
            const { data: messagesWithOrders } = await supabase
                .from('chat_messages')
                .select('thread_id, order_id, orders(order_number)')
                .in('thread_id', threadIds)
                .not('order_id', 'is', null)

            if (messagesWithOrders) {
                messagesWithOrders.forEach((msg: any) => {
                    if (!ordersMap.has(msg.thread_id)) {
                        ordersMap.set(msg.thread_id, msg.orders)
                    }
                })
            }
        }

        // 组装数据
        let enrichedThreads = threadsData.map((thread: any) => {
            const customer = thread.customer_id ? usersMap.get(thread.customer_id) : null
            const girl = thread.girl_id ? girlsMap.get(thread.girl_id) : null
            const support = thread.support_id ? usersMap.get(thread.support_id) : null
            const unreadCounts = unreadMap.get(thread.id) || {}
            const order = ordersMap.get(thread.id)

            return {
                ...thread,
                customer,
                girl,
                support,
                unread_counts: unreadCounts,
                order
            }
        })

        // 搜索筛选（在内存中进行）
        if (search) {
            const searchLower = search.toLowerCase()
            enrichedThreads = enrichedThreads.filter((thread: any) => {
                const customerName = thread.customer?.display_name || thread.customer?.username || ''
                const girlName = thread.girl?.name || thread.girl?.username || ''
                const supportName = thread.support?.display_name || thread.support?.username || ''

                return (
                    customerName.toLowerCase().includes(searchLower) ||
                    girlName.toLowerCase().includes(searchLower) ||
                    supportName.toLowerCase().includes(searchLower)
                )
            })
        }

        // 有订单筛选
        if (has_order) {
            enrichedThreads = enrichedThreads.filter((thread: any) => thread.order)
        }

        const totalPages = Math.ceil((count || 0) / limit)

        return {
            ok: true,
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
        return { ok: false, error: "查询会话异常" }
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
        const admin = await requireAdmin(['superadmin', 'admin', 'support'])
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
 * 获取会话消息列表
 */
export async function getChatMessages(threadId: string, page = 1, limit = 50) {
    try {
        await requireAdmin()
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

        const enrichedMessages = messagesData?.map((msg: any) => ({
            ...msg,
            sender: sendersMap.get(msg.sender_id) || null
        }))

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
