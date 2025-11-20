"use server"

import { getSupabaseAdminClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/auth"
import type { OrderStatus } from "@/lib/features/orders"

/**
 * 订单统计数据
 */
export interface OrderStats {
  pending: number           // 待确认
  pending_overtime: number  // 待确认超时
  active: number           // 进行中（confirmed + en_route + arrived + in_service）
  active_abnormal: number  // 进行中异常
  today_completed: number  // 今日完成
  today_cancelled: number  // 今日取消
}

/**
 * 监控订单筛选参数
 */
export interface MonitoringOrderFilters {
  search?: string
  status?: OrderStatus[]
  time_range?: 'today' | '3days' | '7days' | 'custom'
  start_date?: string
  end_date?: string
  only_abnormal?: boolean
  page?: number
  limit?: number
}

/**
 * 获取订单统计数据
 */
export async function getOrderStats() {
  try {
    await requireAdmin()
    const supabase = getSupabaseAdminClient()

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

    // 待确认订单
    const { count: pendingCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')

    // 待确认超时 (超过10分钟)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { count: pendingOvertimeCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .lt('created_at', tenMinutesAgo)

    // 进行中订单
    const { count: activeCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .in('status', ['confirmed', 'en_route', 'arrived', 'in_service'])

    // 今日完成
    const { count: todayCompletedCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('completed_at', todayStart)

    // 今日取消
    const { count: todayCancelledCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'cancelled')
      .gte('updated_at', todayStart)

    // TODO: 计算进行中异常数量（需要结合技师状态、预计时间等）
    const activeAbnormalCount = 0

    return {
      ok: true,
      data: {
        pending: pendingCount || 0,
        pending_overtime: pendingOvertimeCount || 0,
        active: activeCount || 0,
        active_abnormal: activeAbnormalCount,
        today_completed: todayCompletedCount || 0,
        today_cancelled: todayCancelledCount || 0
      } as OrderStats
    }
  } catch (error) {
    console.error('[订单统计] 获取失败:', error)
    return { ok: false, error: "获取订单统计失败" }
  }
}

/**
 * 获取监控订单列表
 */
export async function getMonitoringOrders(filters: MonitoringOrderFilters = {}) {
  try {
    await requireAdmin()
    const supabase = getSupabaseAdminClient()

    const {
      search,
      status,
      time_range = 'today',
      start_date,
      end_date,
      only_abnormal = false,
      page = 1,
      limit = 50
    } = filters

    // 构建查询
    let query = supabase
      .from('orders')
      .select(`
        *,
        girl:girls!girl_id(id, girl_number, username, name, avatar_url),
        service:services!service_id(id, code, title)
      `, { count: 'exact' })

    // 时间范围筛选
    let timeStart: string
    const now = new Date()

    if (time_range === 'today') {
      timeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      query = query.gte('created_at', timeStart)
    } else if (time_range === '3days') {
      timeStart = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      query = query.gte('created_at', timeStart)
    } else if (time_range === '7days') {
      timeStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      query = query.gte('created_at', timeStart)
    } else if (time_range === 'custom' && start_date) {
      query = query.gte('created_at', start_date)
      if (end_date) {
        query = query.lte('created_at', end_date)
      }
    }

    // 状态筛选
    if (status && status.length > 0) {
      query = query.in('status', status)
    } else if (only_abnormal) {
      // 仅异常订单：默认显示待确认和进行中
      query = query.in('status', ['pending', 'confirmed', 'en_route', 'arrived', 'in_service'])
    }

    // 搜索
    let girlIdsFromSearch: string[] = []
    if (search) {
      const { data: matchedGirls } = await supabase
        .from('girls')
        .select('id')
        .or(`girl_number.eq.${parseInt(search) || 0},name.ilike.%${search}%,username.ilike.%${search}%`)

      if (matchedGirls && matchedGirls.length > 0) {
        girlIdsFromSearch = matchedGirls.map((g: any) => g.id)
      }

      if (girlIdsFromSearch.length > 0) {
        query = query.or(`order_number.ilike.%${search}%,girl_id.in.(${girlIdsFromSearch.join(',')})`)
      } else {
        query = query.ilike('order_number', `%${search}%`)
      }
    }

    // 排序：优先显示待确认，然后按创建时间倒序
    query = query.order('status', { ascending: true })
      .order('created_at', { ascending: false })

    // 分页
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data: ordersData, error, count } = await query

    if (error) {
      console.error('[订单监控] 查询失败:', error)
      return { ok: false, error: `查询订单失败: ${error.message}` }
    }

    // 获取用户信息
    let ordersWithUsers: any[] = ordersData || []
    if (ordersData && ordersData.length > 0) {
      const userIds = [...new Set((ordersData as any[]).map((o: any) => o.user_id).filter(Boolean))]

      if (userIds.length > 0) {
        const { data: usersData } = await supabase.auth.admin.listUsers()

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

        // 客户名称/电话搜索过滤
        if (search) {
          const searchLower = search.toLowerCase()
          ordersWithUsers = ordersWithUsers.filter((order: any) => {
            if (order.order_number.toLowerCase().includes(searchLower)) return true
            if (girlIdsFromSearch.length > 0 && girlIdsFromSearch.includes(order.girl_id)) return true

            const contactName = order.address_snapshot?.contact?.n
            if (contactName && contactName.toLowerCase().includes(searchLower)) return true

            const contactPhone = order.address_snapshot?.contact?.p
            if (contactPhone && contactPhone.toLowerCase().includes(searchLower)) return true

            return false
          })
        }
      }
    }

    const totalPages = Math.ceil((count || 0) / limit)

    return {
      ok: true,
      data: {
        orders: ordersWithUsers,
        total: count || 0,
        page,
        limit,
        totalPages
      }
    }
  } catch (error) {
    console.error('[订单监控] 查询异常:', error)
    return { ok: false, error: "查询订单异常" }
  }
}
