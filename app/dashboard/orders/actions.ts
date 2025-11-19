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

    // 注意：user_id 引用 auth.users（跨 schema），需要特殊处理
    // 先查询订单基本信息和 public schema 的关联
    let query = supabase
      .from('orders')
      .select(`
        *,
        girl:girls!girl_id(id, girl_number, username, name, avatar_url),
        service:services!service_id(id, code, title),
        service_duration_detail:service_durations!service_duration_id(id, duration_minutes)
      `, { count: 'exact' })

    console.log('[订单查询] 开始执行查询...')

    // 搜索条件（订单号、技师工号、技师名）
    // 注意：由于 PostgREST 限制，关联表搜索需要特殊处理
    let girlIdsFromSearch: string[] = []
    if (search) {
      // 先搜索 girls 表获取匹配的技师 ID
      const { data: matchedGirls } = await supabase
        .from('girls')
        .select('id')
        .or(`girl_number.eq.${parseInt(search) || 0},name.ilike.%${search}%,username.ilike.%${search}%`)

      if (matchedGirls && matchedGirls.length > 0) {
        girlIdsFromSearch = matchedGirls.map((g: any) => g.id)
        console.log('[订单查询] 找到匹配技师:', girlIdsFromSearch.length, '个')
      }

      // 在 orders 表中搜索订单号 或 匹配的技师ID
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

    // 获取用户信息（auth.users 在不同 schema，需要单独查询）
    let ordersWithUsers: any[] = ordersData || []
    if (ordersData && ordersData.length > 0) {
      const userIds = [...new Set((ordersData as any[]).map((o: any) => o.user_id).filter(Boolean))]
      console.log('[订单查询] 查询用户信息:', userIds.length, '个用户')

      if (userIds.length > 0) {
        const { data: usersData } = await supabase.auth.admin.listUsers()
        console.log('[订单查询] 用户查询完成:', usersData.users.length, '个用户')

        const usersMap = new Map(
          usersData.users.map(u => [
            u.id,
            {
              id: u.id,
              email: u.email ?? null,
              raw_user_meta_data: u.user_metadata || {}
            }
          ])
        )

        ordersWithUsers = (ordersData as any[]).map((order: any) => ({
          ...order,
          user: usersMap.get(order.user_id) || null
        }))
      }
    }

    // 如果有搜索，总数应该是过滤后的数量
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
