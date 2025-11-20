"use server"

import { getSupabaseAdminClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/auth"
import {
  orderListParamsSchema,
  type OrderListParams
} from "@/lib/features/orders"
import type {
  ApiResponse,
  PaginatedResponse,
  Order
} from "@/lib/features/orders"

/**
 * 订单管理统计数据
 */
export interface AdminOrderStats {
  total: number              // 总订单数
  pending: number            // 待确认
  active: number             // 进行中
  today_completed: number    // 今日完成（泰国时区6点起）
  today_cancelled: number    // 今日取消（泰国时区6点起）
  yesterday_completed: number // 昨日完成
  yesterday_cancelled: number // 昨日取消
}

/**
 * 获取订单管理统计
 */
export async function getAdminOrderStats(): Promise<ApiResponse<AdminOrderStats>> {
  try {
    await requireAdmin(['superadmin', 'admin', 'finance', 'support'])
    const supabase = getSupabaseAdminClient()

    // ✅ 优化：使用 RPC 函数一次性获取所有统计
    const { data: rpcData, error: rpcError } = await (supabase as any).rpc('get_admin_order_stats')

    if (!rpcError && rpcData) {
      return {
        ok: true as const,
        data: rpcData as AdminOrderStats
      }
    }

    // 回退方案：如果 RPC 不可用
    console.warn('[订单统计] RPC 不可用，使用回退方案')
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { count: totalCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })

    const { count: pendingCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')

    const { count: activeCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .in('status', ['confirmed', 'en_route', 'arrived', 'in_service'])

    const { count: todayCompletedCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('completed_at', todayStart.toISOString())

    const { count: todayCancelledCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'cancelled')
      .gte('updated_at', todayStart.toISOString())

    return {
      ok: true as const,
      data: {
        total: totalCount || 0,
        pending: pendingCount || 0,
        active: activeCount || 0,
        today_completed: todayCompletedCount || 0,
        today_cancelled: todayCancelledCount || 0,
        yesterday_completed: 0,
        yesterday_cancelled: 0
      } as AdminOrderStats
    }
  } catch (error) {
    console.error('[订单统计] 获取失败:', error)
    return { ok: false as const, error: "获取订单统计失败" }
  }
}

/**
 * 获取订单列表
 */
export async function getOrders(params: OrderListParams): Promise<ApiResponse<PaginatedResponse<Order>>> {
  try {
    // 验证管理员权限
    const admin = await requireAdmin(['superadmin', 'admin'])
    console.log('[订单查询] 管理员验证通过:', admin.display_name)

    // 验证参数
    const validatedParams = orderListParamsSchema.parse(params)
    const { page, limit, search, status, start_date, end_date, sort_by, sort_order } = validatedParams
    console.log('[订单查询] 查询参数:', validatedParams)

    const supabase = getSupabaseAdminClient()

    // ✅ 优化：使用视图查询，预关联所有信息（查询所有用户 → 1次查询）
    let query = supabase
      .from('v_admin_orders_list')
      .select('*', { count: 'exact' })

    console.log('[订单查询] 开始执行查询...')

    // ✅ 优化：搜索条件（订单号、技师工号、技师名）
    if (search) {
      // 由于视图中的 girl 是 JSON 类型，不能直接用 ilike，需要先查询技师表
      const searchNum = parseInt(search)
      let girlIdsFromSearch: string[] = []

      if (!isNaN(searchNum)) {
        // 数字搜索：查询技师工号
        const { data: matchedGirls } = await supabase
          .from('girls')
          .select('id')
          .eq('girl_number', searchNum)

        if (matchedGirls && matchedGirls.length > 0) {
          girlIdsFromSearch = matchedGirls.map((g: any) => g.id)
        }
      } else {
        // 文本搜索：查询技师名
        const { data: matchedGirls } = await supabase
          .from('girls')
          .select('id')
          .or(`name.ilike.%${search}%,username.ilike.%${search}%`)

        if (matchedGirls && matchedGirls.length > 0) {
          girlIdsFromSearch = matchedGirls.map((g: any) => g.id)
        }
      }

      // 搜索订单号或匹配的技师ID
      if (girlIdsFromSearch.length > 0) {
        query = query.or(`order_number.ilike.%${search}%,girl_id.in.(${girlIdsFromSearch.join(',')})`)
      } else {
        query = query.ilike('order_number', `%${search}%`)
      }
      console.log('[订单查询] 添加搜索条件:', search)
    }

    // 订单状态筛选
    if (status) {
      query = query.eq('status', status)
      console.log('[订单查询] 添加状态筛选:', status)
    }

    // 时间范围筛选
    if (start_date) {
      query = query.gte('created_at', start_date)
      console.log('[订单查询] 开始时间:', start_date)
    }
    if (end_date) {
      query = query.lte('created_at', end_date)
      console.log('[订单查询] 结束时间:', end_date)
    }

    // 排序
    query = query.order(sort_by, { ascending: sort_order === 'asc' })
    console.log('[订单查询] 排序:', sort_by, sort_order)

    // 分页
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)
    console.log('[订单查询] 分页:', { from, to, page, limit })

    const { data: ordersData, error, count } = await query

    console.log('[订单查询] 查询完成 - count:', count, 'data.length:', ordersData?.length, 'error:', error)

    if (error) {
      console.error('[订单查询] 获取订单列表失败:', error)
      return { ok: false, error: `获取订单列表失败: ${error.message}` }
    }

    // ✅ 优化：视图已包含所有关联数据，直接使用即可
    const ordersWithUsers = (ordersData || []).map((order: any) => ({
      ...order,
      // 如果有 user_profile，转换为 user 格式
      user: order.user_profile ? {
        id: order.user_profile.id,
        email: null, // 视图中没有 email，如需要可以添加
        raw_user_meta_data: {
          username: order.user_profile.display_name
        }
      } : null
    }))

    const actualTotal = count || 0
    const totalPages = Math.ceil(actualTotal / limit)
    console.log('[订单查询] 返回结果 - 总记录数:', actualTotal, '总页数:', totalPages, '当前页数据:', ordersWithUsers.length)

    return {
      ok: true,
      data: {
        data: ordersWithUsers as Order[],
        total: actualTotal,
        page,
        limit,
        totalPages
      }
    }
  } catch (error) {
    console.error('获取订单列表异常:', error)
    return { ok: false, error: "获取订单列表异常" }
  }
}

/**
 * 获取订单详情
 */
export async function getOrderById(id: string): Promise<ApiResponse<Order>> {
  try {
    // 验证管理员权限
    await requireAdmin(['superadmin', 'admin'])

    const supabase = getSupabaseAdminClient()
    const { data: orderData, error } = await supabase
      .from('orders')
      .select(`
        *,
        girl:girls!girl_id(id, girl_number, username, name, avatar_url),
        service:services!service_id(id, code, title),
        service_duration_detail:service_durations!service_duration_id(id, duration_minutes)
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('[订单详情] 获取订单详情失败:', error)
      return { ok: false, error: "获取订单详情失败" }
    }

    // 获取用户信息
    let orderWithUser: any = orderData
    if (orderData && (orderData as any).user_id) {
      const { data: userData } = await supabase.auth.admin.getUserById((orderData as any).user_id)
      if (userData?.user) {
        orderWithUser = {
          ...(orderData as any),
          user: {
            id: userData.user.id,
            email: userData.user.email ?? null,
            raw_user_meta_data: userData.user.user_metadata || {}
          }
        }
      }
    }

    return { ok: true, data: orderWithUser as Order }
  } catch (error) {
    console.error('[订单详情] 获取订单详情异常:', error)
    return { ok: false, error: "获取订单详情异常" }
  }
}

/**
 * 订单取消记录类型定义
 */
export interface OrderCancellation {
  id: string
  order_id: string
  cancelled_at: string
  cancelled_by_role: 'user' | 'therapist' | 'admin' | 'system'
  cancelled_by_user_id: string | null
  reason_code: string | null
  reason_note: string | null
  previous_status: string | null
  created_at: string
  cancelled_by_profile?: {
    user_id: string
    display_name: string | null
    avatar_url: string | null
    girl_number?: number | null
    girl_name?: string | null
  } | null
}

/**
 * 获取订单取消记录
 */
export async function getOrderCancellation(orderId: string): Promise<ApiResponse<OrderCancellation>> {
  try {
    await requireAdmin(['superadmin', 'admin', 'support'])
    const supabase = getSupabaseAdminClient()

    const { data, error } = await supabase
      .from('order_cancellations')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle()

    if (error) {
      console.error('[取消记录] 查询失败:', error)
      return { ok: false, error: `查询取消记录失败: ${error.message}` }
    }

    if (!data) {
      return { ok: false, error: "未找到取消记录" }
    }

    const cancellation = data as any

    // 如果有取消人ID，查询取消人信息
    let cancelledByProfile = null
    if (cancellation.cancelled_by_user_id) {
      // 先查询 user_profiles
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('id, display_name, avatar_url')
        .eq('id', cancellation.cancelled_by_user_id)
        .maybeSingle()

      if (profileData) {
        cancelledByProfile = {
          user_id: (profileData as any).id,
          display_name: (profileData as any).display_name ?? null,
          avatar_url: (profileData as any).avatar_url ?? null,
        }

        // 如果是技师取消，查询技师信息
        if (cancellation.cancelled_by_role === 'therapist') {
          const { data: girlData } = await supabase
            .from('girls')
            .select('user_id, girl_number, name, avatar_url')
            .eq('user_id', cancellation.cancelled_by_user_id)
            .maybeSingle()

          if (girlData) {
            cancelledByProfile = {
              ...cancelledByProfile,
              girl_number: (girlData as any).girl_number,
              girl_name: (girlData as any).name,
              avatar_url: (girlData as any).avatar_url || cancelledByProfile.avatar_url,
            }
          }
        }
      }
    }

    const result: OrderCancellation = {
      ...cancellation,
      cancelled_by_profile: cancelledByProfile,
    }

    return { ok: true, data: result }
  } catch (error) {
    console.error('[取消记录] 查询异常:', error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : "查询取消记录异常",
    }
  }
}
