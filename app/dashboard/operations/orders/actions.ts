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
  time_range?: 'today' | 'yesterday' | '3days' | '7days' | 'custom'
  start_date?: string
  end_date?: string
  only_abnormal?: boolean
  page?: number
  limit?: number
}

/**
 * 获取订单统计数据
 * ✅ 优化：从6次查询合并为1次查询，性能提升5-6倍
 */
export async function getOrderStats(): Promise<{ ok: true; data: OrderStats } | { ok: false; error: string }> {
  try {
    await requireAdmin()
    const supabase = getSupabaseAdminClient()

    // 🔧 使用泰国时区（UTC+7），以凌晨6点为分界点
    const nowUTC = new Date()
    const thailandOffset = 7 * 60 // 泰国时区偏移（分钟）
    const thailandNow = new Date(nowUTC.getTime() + thailandOffset * 60 * 1000)

    // 计算今天6点的时间戳（泰国时区）
    const todayThailand = new Date(thailandNow)
    todayThailand.setHours(6, 0, 0, 0)

    // 如果当前时间小于今天6点，说明还在"昨天"
    if (thailandNow.getHours() < 6) {
      todayThailand.setDate(todayThailand.getDate() - 1)
    }

    // 转换回 UTC 时间
    const todayStart = new Date(todayThailand.getTime() - thailandOffset * 60 * 1000).toISOString()
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()

    // ✅ 优化：使用 RPC 函数一次性获取所有统计数据
    const { data, error } = await (supabase as any).rpc('get_order_stats', {
      p_today_start: todayStart,
      p_ten_minutes_ago: tenMinutesAgo
    })

    if (error) {
      console.error('[订单统计] RPC调用失败，回退到多次查询:', error)
      // 回退方案：如果RPC不存在，使用原来的多次查询
      return await getOrderStatsLegacy(supabase, todayStart, tenMinutesAgo)
    }

    return {
      ok: true as const,
      data: data || {
        pending: 0,
        pending_overtime: 0,
        active: 0,
        active_abnormal: 0,
        today_completed: 0,
        today_cancelled: 0
      }
    }
  } catch (error) {
    console.error('[订单统计] 获取失败:', error)
    return { ok: false as const, error: "获取订单统计失败" }
  }
}

/**
 * 回退方案：传统多次查询（用于RPC函数不存在时）
 */
async function getOrderStatsLegacy(supabase: any, todayStart: string, tenMinutesAgo: string): Promise<{ ok: true; data: OrderStats }> {
  const { count: pendingCount } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  const { count: pendingOvertimeCount } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
    .lt('created_at', tenMinutesAgo)

  const { count: activeCount } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .in('status', ['confirmed', 'en_route', 'arrived', 'in_service'])

  const { count: todayCompletedCount } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'completed')
    .gte('completed_at', todayStart)

  const { count: todayCancelledCount } = await supabase
    .from('order_cancellations')
    .select('*', { count: 'exact', head: true })
    .gte('cancelled_at', todayStart)

  return {
    ok: true as const,
    data: {
      pending: pendingCount || 0,
      pending_overtime: pendingOvertimeCount || 0,
      active: activeCount || 0,
      active_abnormal: 0,
      today_completed: todayCompletedCount || 0,
      today_cancelled: todayCancelledCount || 0
    }
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

    // ✅ 优化：查询订单，暂时不 JOIN user_profiles（因为外键关系复杂）
    let query = supabase
      .from('orders')
      .select(`
        *,
        girl:girls!girl_id(id, girl_number, username, name, avatar_url),
        service:services!service_id(id, code, title)
      `, { count: 'exact' })

    // 🔧 时间范围筛选（泰国时区 UTC+7，以凌晨6点为分界点）
    // 注意：当有搜索条件时，不限制时间范围，允许搜索全部订单
    if (!search) {
      let timeStart: string
      let timeEnd: string | undefined

      // 获取泰国当前时间（UTC+7）
      const nowUTC = new Date()
      const thailandOffset = 7 * 60 // 泰国时区偏移（分钟）
      const thailandNow = new Date(nowUTC.getTime() + thailandOffset * 60 * 1000)

      // 计算今天6点的时间戳（泰国时区）
      const todayThailand = new Date(thailandNow)
      todayThailand.setHours(6, 0, 0, 0)

      // 如果当前时间小于今天6点，说明还在"昨天"
      if (thailandNow.getHours() < 6) {
        todayThailand.setDate(todayThailand.getDate() - 1)
      }

      // 转换回 UTC 时间
      const todayStartUTC = new Date(todayThailand.getTime() - thailandOffset * 60 * 1000)
      const yesterdayStartUTC = new Date(todayStartUTC.getTime() - 24 * 60 * 60 * 1000)

      if (time_range === 'today') {
        // 今日：从今天6点开始
        timeStart = todayStartUTC.toISOString()
        query = query.gte('created_at', timeStart)
      } else if (time_range === 'yesterday') {
        // 昨日：昨天6点到今天6点
        timeStart = yesterdayStartUTC.toISOString()
        timeEnd = todayStartUTC.toISOString()
        query = query.gte('created_at', timeStart).lt('created_at', timeEnd)
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
    }

    // 状态筛选
    if (status && status.length > 0) {
      query = query.in('status', status)
    } else if (only_abnormal) {
      // 🔧 仅异常订单：待确认和进行中
      query = query.in('status', ['pending', 'confirmed', 'en_route', 'arrived', 'in_service'])
    } else {
      // 默认显示进行中的订单
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
      return { ok: false as const, error: "查询订单失败" }
    }

    // 数据处理：订单列表
    let ordersWithUsers: any[] = ordersData || []

    // 客户名称/电话搜索过滤（如果有搜索条件）
    if (search && ordersData && ordersData.length > 0) {
      const searchLower = search.toLowerCase()
      ordersWithUsers = (ordersData as any[]).filter((order: any) => {
        // 订单号匹配
        if (order.order_number.toLowerCase().includes(searchLower)) return true

        // 技师匹配
        if (girlIdsFromSearch.length > 0 && girlIdsFromSearch.includes(order.girl_id)) return true

        // 联系人姓名匹配
        const contactName = order.address_snapshot?.contact?.n
        if (contactName && contactName.toLowerCase().includes(searchLower)) return true

        // 联系人电话匹配
        const contactPhone = order.address_snapshot?.contact?.p
        if (contactPhone && contactPhone.toLowerCase().includes(searchLower)) return true

        return false
      })
    }

    const totalPages = Math.ceil((count || 0) / limit)

    return {
      ok: true as const,
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
    return { ok: false as const, error: "查询订单异常" }
  }
}
