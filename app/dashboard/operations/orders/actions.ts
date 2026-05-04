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
  service_type?: 'outcall' | 'incall'
  has_add_time?: boolean
  time_range?: 'today' | 'yesterday' | '3days' | '7days' | 'custom'
  start_date?: string
  end_date?: string
  only_abnormal?: boolean
  page?: number
  limit?: number
}

async function fetchOrderTimeExtensions(supabase: any, orderIds: string[]) {
  if (orderIds.length === 0) return new Map<string, any[]>()

  const { data, error } = await supabase
    .from('order_time_extensions')
    .select('*')
    .in('order_id', orderIds)
    .neq('settlement_status', 'rejected')
    .order('reported_at', { ascending: false })

  if (error) {
    console.error('[订单监控-加钟] 获取明细失败:', error)
    return new Map<string, any[]>()
  }

  const map = new Map<string, any[]>()
  for (const item of data || []) {
    const list = map.get(item.order_id) || []
    list.push(item)
    map.set(item.order_id, list)
  }
  return map
}

function buildAddTimeSummary(items: any[] = []) {
  return {
    count: items.length,
    duration_minutes: items.reduce((sum, item) => sum + Number(item.duration_minutes || 0), 0),
    commission_thb: items.reduce((sum, item) => sum + Number(item.commission_thb_snapshot || 0), 0),
  }
}

/**
 * 获取订单统计数据
 * ✅ 优化：从6次查询合并为1次查询，性能提升5-6倍
 */
export async function getOrderStats(): Promise<{ ok: true; data: OrderStats } | { ok: false; error: string }> {
  try {
    const admin = await requireAdmin(['superadmin', 'admin', 'support'], { allowMumuForOperations: true })
    const supabase = getSupabaseAdminClient()

    // 判断是否需要过滤 sort_order < 998 的技师订单
    const shouldFilterSortOrder = admin.role !== 'superadmin' && admin.role !== 'admin'

    // 🔧 泰国时区(UTC+7)财务日计算:早晨6点为分界点
    const now = new Date()
    // 将UTC时间转为泰国时间(+7小时)
    const thailandTime = new Date(now.getTime() + 7 * 60 * 60 * 1000)

    // 获取泰国时间的日期和小时
    const year = thailandTime.getUTCFullYear()
    const month = thailandTime.getUTCMonth()
    const date = thailandTime.getUTCDate()
    const hours = thailandTime.getUTCHours()

    // 计算今日财务日起点(泰国6点)
    let todayStartThailand
    if (hours < 6) {
      // 泰国时间小于6点,财务日从昨天6点开始
      todayStartThailand = new Date(Date.UTC(year, month, date - 1, 6, 0, 0, 0))
    } else {
      // 泰国时间>=6点,财务日从今天6点开始
      todayStartThailand = new Date(Date.UTC(year, month, date, 6, 0, 0, 0))
    }

    // 转回UTC时间(泰国时间-7小时)
    const todayStart = new Date(todayStartThailand.getTime() - 7 * 60 * 60 * 1000)

    // 明天财务日起点
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

    const todayStartISO = todayStart.toISOString()
    const tomorrowStartISO = tomorrowStart.toISOString()
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()

    // ✅ 优化：使用 RPC 函数一次性获取所有统计数据
    const { data, error } = await (supabase as any).rpc('get_order_stats', {
      p_today_start: todayStartISO,
      p_tomorrow_start: tomorrowStartISO,
      p_ten_minutes_ago: tenMinutesAgo,
      p_filter_sort_order: shouldFilterSortOrder
    })

    if (error) {
      console.error('[订单统计] RPC调用失败，回退到多次查询:', error)
      // 回退方案：如果RPC不存在，使用原来的多次查询
      return await getOrderStatsLegacy(supabase, todayStartISO, tomorrowStartISO, tenMinutesAgo, shouldFilterSortOrder)
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
 * ✅ 所有统计都限制为今日6:00到明天6:00的订单
 */
async function getOrderStatsLegacy(
  supabase: any,
  todayStart: string,
  tomorrowStart: string,
  tenMinutesAgo: string,
  shouldFilterSortOrder: boolean = false
): Promise<{ ok: true; data: OrderStats }> {
  // 如果需要过滤 sort_order，先获取符合条件的技师ID列表
  let allowedGirlIds: string[] | null = null
  if (shouldFilterSortOrder) {
    const { data: girls } = await supabase
      .from('girls')
      .select('id')
      .gte('sort_order', 998)
    allowedGirlIds = girls ? girls.map((g: any) => g.id) : []

    // 如果没有符合条件的技师，直接返回空统计
    if (allowedGirlIds && allowedGirlIds.length === 0) {
      return {
        ok: true as const,
        data: {
          pending: 0,
          pending_overtime: 0,
          active: 0,
          active_abnormal: 0,
          today_completed: 0,
          today_cancelled: 0
        }
      }
    }
  }

  // 待确认（今日6:00到明天6:00）
  let pendingQuery = supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
    .gte('created_at', todayStart)
    .lt('created_at', tomorrowStart)
  if (allowedGirlIds && allowedGirlIds.length > 0) pendingQuery = pendingQuery.in('girl_id', allowedGirlIds)
  const { count: pendingCount } = await pendingQuery

  // 待确认超时（今日6:00到明天6:00且10分钟前创建）
  let pendingOvertimeQuery = supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
    .gte('created_at', todayStart)
    .lt('created_at', tomorrowStart)
    .lt('created_at', tenMinutesAgo)
  if (allowedGirlIds && allowedGirlIds.length > 0) pendingOvertimeQuery = pendingOvertimeQuery.in('girl_id', allowedGirlIds)
  const { count: pendingOvertimeCount } = await pendingOvertimeQuery

  // 进行中（今日6:00到明天6:00）
  let activeQuery = supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .in('status', ['confirmed', 'en_route', 'arrived', 'in_service'])
    .gte('created_at', todayStart)
    .lt('created_at', tomorrowStart)
  if (allowedGirlIds && allowedGirlIds.length > 0) activeQuery = activeQuery.in('girl_id', allowedGirlIds)
  const { count: activeCount } = await activeQuery

  // 今日完成（今日6:00到明天6:00且已完成）
  let todayCompletedQuery = supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'completed')
    .gte('created_at', todayStart)
    .lt('created_at', tomorrowStart)
  if (allowedGirlIds && allowedGirlIds.length > 0) todayCompletedQuery = todayCompletedQuery.in('girl_id', allowedGirlIds)
  const { count: todayCompletedCount } = await todayCompletedQuery

  // 今日取消（今日6:00到明天6:00创建的订单）
  let todayOrderIdsQuery = supabase
    .from('orders')
    .select('id')
    .gte('created_at', todayStart)
    .lt('created_at', tomorrowStart)
  if (allowedGirlIds && allowedGirlIds.length > 0) todayOrderIdsQuery = todayOrderIdsQuery.in('girl_id', allowedGirlIds)
  const { data: todayOrderIds } = await todayOrderIdsQuery

  const todayOrderIdList = (todayOrderIds || []).map((o: any) => o.id)

  // 统计今日取消且订单是今日创建的
  const { count: todayCancelledCount } = todayOrderIdList.length > 0
    ? await supabase
        .from('order_cancellations')
        .select('*', { count: 'exact', head: true })
        .gte('cancelled_at', todayStart)
        .lt('cancelled_at', tomorrowStart)
        .in('order_id', todayOrderIdList)
    : { count: 0 }

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
    const admin = await requireAdmin(['superadmin', 'admin', 'support'], { allowMumuForOperations: true })
    const supabase = getSupabaseAdminClient()

    // 判断是否需要过滤 sort_order < 998 的技师订单
    const shouldFilterSortOrder = admin.role !== 'superadmin' && admin.role !== 'admin'

    const {
      search,
      status,
      service_type,
      has_add_time,
      time_range = 'today',
      start_date,
      end_date,
      only_abnormal = false,
      page = 1,
      limit = 50
    } = filters

    // 如果需要过滤 sort_order，先获取符合条件的技师ID列表
    let allowedGirlIds: string[] | null = null
    if (shouldFilterSortOrder) {
      const { data: girls } = await supabase
        .from('girls')
        .select('id')
        .gte('sort_order', 998)
      allowedGirlIds = girls ? girls.map((g: any) => g.id) : []

      // 如果没有符合条件的技师，直接返回空结果
      if (allowedGirlIds.length === 0) {
        return {
          ok: true as const,
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

    // ✅ 优化：查询订单，暂时不 JOIN user_profiles（因为外键关系复杂）
    let query = supabase
      .from('orders')
      .select(`
        *,
        girl:girls!girl_id(id, girl_number, username, name, avatar_url),
        service:services!service_id(id, code, title)
      `, { count: 'exact' })

    // 添加 sort_order 过滤
    if (allowedGirlIds && allowedGirlIds.length > 0) {
      query = query.in('girl_id', allowedGirlIds)
    }

    // 🔧 时间范围筛选(泰国时区UTC+7,以早晨6点为分界点)
    // 注意:当有搜索条件时,不限制时间范围,允许搜索全部订单
    if (!search) {
      const now = new Date()
      // 将UTC时间转为泰国时间(+7小时)
      const thailandTime = new Date(now.getTime() + 7 * 60 * 60 * 1000)

      // 获取泰国时间的日期和小时
      const year = thailandTime.getUTCFullYear()
      const month = thailandTime.getUTCMonth()
      const date = thailandTime.getUTCDate()
      const hours = thailandTime.getUTCHours()

      // 计算今日财务日起点(泰国6点)
      let todayStartThailand
      if (hours < 6) {
        todayStartThailand = new Date(Date.UTC(year, month, date - 1, 6, 0, 0, 0))
      } else {
        todayStartThailand = new Date(Date.UTC(year, month, date, 6, 0, 0, 0))
      }

      // 转回UTC时间
      const todayStart = new Date(todayStartThailand.getTime() - 7 * 60 * 60 * 1000)
      const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
      const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)

      if (time_range === 'today') {
        // 今日：今天6点到明天6点
        query = query.gte('created_at', todayStart.toISOString())
          .lt('created_at', tomorrowStart.toISOString())
      } else if (time_range === 'yesterday') {
        // 昨日：昨天6点到今天6点
        query = query.gte('created_at', yesterdayStart.toISOString())
          .lt('created_at', todayStart.toISOString())
      } else if (time_range === '3days') {
        // 最近3天：从3天前的6点到明天6点
        const threeDaysAgoStart = new Date(todayStart)
        threeDaysAgoStart.setDate(threeDaysAgoStart.getDate() - 3)
        query = query.gte('created_at', threeDaysAgoStart.toISOString())
          .lt('created_at', tomorrowStart.toISOString())
      } else if (time_range === '7days') {
        // 最近7天：从7天前的6点到明天6点
        const sevenDaysAgoStart = new Date(todayStart)
        sevenDaysAgoStart.setDate(sevenDaysAgoStart.getDate() - 7)
        query = query.gte('created_at', sevenDaysAgoStart.toISOString())
          .lt('created_at', tomorrowStart.toISOString())
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

    if (service_type) {
      query = query.eq('service_type', service_type)
    }

    if (has_add_time === true) {
      const { data: addTimeRows, error: addTimeError } = await supabase
        .from('order_time_extensions')
        .select('order_id')
        .neq('settlement_status', 'rejected')

      if (addTimeError) {
        console.error('[订单监控-加钟] 筛选失败:', addTimeError)
        return { ok: false as const, error: "筛选加钟订单失败" }
      }

      const addTimeOrderIds = Array.from(new Set((addTimeRows || []).map((row: any) => row.order_id).filter(Boolean)))
      if (addTimeOrderIds.length === 0) {
        return {
          ok: true as const,
          data: {
            orders: [],
            total: 0,
            page,
            limit,
            totalPages: 0
          }
        }
      }
      query = query.in('id', addTimeOrderIds)
    }

    // 搜索（允许空搜索）
    let girlIdsFromSearch: string[] = []
    if (search) {
      let girlSearchQuery = supabase
        .from('girls')
        .select('id')
        .or(`girl_number.eq.${parseInt(search) || 0},name.ilike.%${search}%,username.ilike.%${search}%`)

      // 如果需要过滤 sort_order，在搜索时也要过滤
      if (shouldFilterSortOrder) {
        girlSearchQuery = girlSearchQuery.gte('sort_order', 998)
      }

      const { data: matchedGirls } = await girlSearchQuery

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

    const orderIds = (ordersData || []).map((order: any) => order.id).filter(Boolean)
    const extensionsMap = await fetchOrderTimeExtensions(supabase, orderIds)

    // 数据处理：订单列表
    let ordersWithUsers: any[] = (ordersData || []).map((order: any) => {
      const extensions = extensionsMap.get(order.id) || []
      return {
        ...order,
        service_type: order.service_type || 'outcall',
        incall_requested_at: order.incall_requested_at || null,
        incall_location_snapshot: order.incall_location_snapshot || null,
        add_time_summary: buildAddTimeSummary(extensions),
        time_extensions: extensions,
      }
    })

    if (has_add_time === false) {
      ordersWithUsers = ordersWithUsers.filter((order) => (order.add_time_summary?.count || 0) === 0)
    }

    // 客户名称/电话搜索过滤（如果有搜索条件，允许空搜索）
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

/**
 * 获取订单可升级的服务列表
 * 规则：
 * 1. 相同服务：只能选择更长时长（价格可以相同或更高）
 * 2. 不同服务：价格必须≥当前服务价格
 * 3. 只能选择该技师已绑定并开启的服务
 * 4. 订单必须是未完成状态（pending/confirmed/en_route/arrived/in_service）
 * 注：都是基于服务基础价格，与车费和其他费用无关
 */
export async function getUpgradableServices(orderId: string): Promise<{ ok: true; data: any[] } | { ok: false; error: string }> {
  try {
    await requireAdmin(['superadmin', 'admin', 'support'], { allowMumuForOperations: true })
    const supabase = getSupabaseAdminClient()

    // 1. 获取订单详情
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('id, girl_id, service_id, service_duration_id, service_duration, service_price, status')
      .eq('id', orderId)
      .maybeSingle()

    if (orderError || !orderData) {
      return { ok: false, error: "订单不存在" }
    }

    const order = orderData as {
      id: string
      girl_id: string
      service_id: number
      service_duration_id: number
      service_duration: number
      service_price: number
      status: string
    }

    // 2. 检查订单状态，已完成的不能升级
    if (order.status === 'completed' || order.status === 'cancelled') {
      return { ok: false, error: "已完成或已取消的订单无法升级服务" }
    }

    // 3. 获取该技师绑定的所有服务（不限于当前服务）
    const { data: girlServices, error: servicesError } = await supabase
      .from('admin_girl_services')
      .select(`
        id,
        service_id,
        is_qualified,
        services!inner (
          id,
          code,
          title,
          is_active
        )
      `)
      .eq('girl_id', order.girl_id)
      .eq('is_qualified', true)
      .eq('services.is_active', true)

    if (servicesError || !girlServices || girlServices.length === 0) {
      return { ok: false, error: "技师未绑定任何服务" }
    }

    // 4. 获取所有技师绑定服务的时长配置
    const girlServiceIds = girlServices.map((s: any) => s.id)

    const { data: allDurations, error: durationsError } = await supabase
      .from('girl_service_durations')
      .select(`
        id,
        admin_girl_service_id,
        service_duration_id,
        custom_price,
        is_active,
        service_durations!inner (
          id,
          service_id,
          duration_minutes,
          default_price,
          is_active
        )
      `)
      .in('admin_girl_service_id', girlServiceIds)
      .eq('is_active', true)
      .eq('service_durations.is_active', true)

    if (durationsError || !allDurations || allDurations.length === 0) {
      return { ok: false, error: "技师未配置任何服务时长选项" }
    }

    // 5. 筛选可升级的服务
    const upgradableServices = allDurations
      .map((d: any) => {
        const duration = d.service_durations
        const price = d.custom_price || duration.default_price

        // 找到对应的服务信息
        const serviceInfo = girlServices.find((s: any) => s.id === d.admin_girl_service_id) as any

        return {
          service_duration_id: d.service_duration_id,
          service_id: duration.service_id,
          duration_minutes: duration.duration_minutes,
          price: price,
          service_name: serviceInfo?.services?.title || {},
          is_active: d.is_active,
          is_qualified: true
        }
      })
      .filter((s: any) => {
        // 排除当前选中的服务时长
        if (s.service_duration_id === order.service_duration_id) {
          return false
        }

        // 相同服务：只能选更长时长（价格可以相同）
        if (s.service_id === order.service_id) {
          return s.duration_minutes > order.service_duration
        }

        // 不同服务：价格必须≥当前服务价格
        return s.price >= order.service_price
      })
      .sort((a: any, b: any) => {
        // 先按服务ID排序，再按时长排序
        if (a.service_id !== b.service_id) {
          return a.service_id - b.service_id
        }
        return a.duration_minutes - b.duration_minutes
      })

    if (upgradableServices.length === 0) {
      return { ok: false, error: "暂无可升级的服务选项" }
    }

    return {
      ok: true,
      data: upgradableServices
    }
  } catch (error) {
    console.error('[升级服务] 获取可升级服务失败:', error)
    return { ok: false, error: "获取可升级服务失败" }
  }
}

/**
 * 执行服务升级
 * 规则：
 * 1. 相同服务：只能升级到更长时长（价格可以相同或更高）
 * 2. 不同服务：价格必须≥当前服务价格
 * 3. 更新订单的服务时长和价格信息
 * 4. 如果订单结算记录已存在（未完成状态也可能有），需同步更新结算金额和提成
 * 5. 记录审计日志
 */
export async function upgradeOrderService(orderId: string, newServiceDurationId: number): Promise<{ ok: true; data: any } | { ok: false; error: string }> {
  try {
    await requireAdmin(['superadmin', 'admin', 'support'], { allowMumuForOperations: true })
    const supabase = getSupabaseAdminClient()

    // 1. 获取订单当前信息
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        girl_id,
        service_id,
        service_duration_id,
        service_duration,
        service_price,
        service_fee,
        service_name,
        extra_fee,
        travel_fee,
        discount_amount,
        total_amount,
        status
      `)
      .eq('id', orderId)
      .maybeSingle()

    if (orderError || !orderData) {
      return { ok: false, error: "订单不存在" }
    }

    const order = orderData as {
      id: string
      girl_id: string
      service_id: number
      service_duration_id: number
      service_duration: number
      service_price: number
      service_fee: number
      service_name: any
      extra_fee: number
      travel_fee: number
      discount_amount: number
      total_amount: number
      status: string
    }

    // 2. 检查订单状态
    if (order.status === 'completed') {
      return { ok: false, error: "已完成的订单无法升级服务" }
    }

    if (order.status === 'cancelled') {
      return { ok: false, error: "已取消的订单无法升级服务" }
    }

    // 3. 获取新服务时长和价格，包括服务名称和提成比例（支持跨服务升级）
    const { data: girlServiceDurationData, error: durationError } = await supabase
      .from('girl_service_durations')
      .select(`
        id,
        custom_price,
        is_active,
        admin_girl_services!inner (
          girl_id,
          service_id,
          is_qualified,
          services!inner (
            id,
            title,
            commission_rate
          )
        ),
        service_durations!inner (
          id,
          service_id,
          duration_minutes,
          default_price,
          is_active
        )
      `)
      .eq('service_duration_id', newServiceDurationId)
      .eq('is_active', true)
      .eq('service_durations.is_active', true)
      .eq('admin_girl_services.girl_id', order.girl_id)
      .eq('admin_girl_services.is_qualified', true)
      .maybeSingle()

    if (durationError || !girlServiceDurationData) {
      return { ok: false, error: "目标服务不可用或技师未绑定" }
    }

    const girlServiceDuration = girlServiceDurationData as any
    const newServiceId = girlServiceDuration.service_durations.service_id
    const newDuration = girlServiceDuration.service_durations.duration_minutes
    const newPrice = girlServiceDuration.custom_price || girlServiceDuration.service_durations.default_price
    const newServiceName = girlServiceDuration.admin_girl_services.services.title
    const newServiceCommissionRate = girlServiceDuration.admin_girl_services.services.commission_rate

    // 4. 验证升级规则
    if (newServiceId === order.service_id) {
      // 相同服务：必须升级到更长时长
      if (newDuration <= order.service_duration) {
        return { ok: false, error: "同一服务必须升级到更长时长" }
      }
    } else {
      // 不同服务：价格必须≥当前服务价格
      if (newPrice < order.service_price) {
        return { ok: false, error: "更换服务的价格不能低于当前服务" }
      }
    }

    // 5. 计算新的总金额
    const priceDifference = newPrice - order.service_price
    const newTotalAmount = order.total_amount + priceDifference
    const newServiceFee = order.service_fee + priceDifference
    const isServiceChanged = newServiceId !== order.service_id

    // 6. 更新订单信息（包括服务ID和服务名称，支持跨服务升级）
    const { error: updateOrderError } = await (supabase
      .from('orders') as any)
      .update({
        service_id: newServiceId,  // 更新服务ID（支持跨服务升级）
        service_duration_id: newServiceDurationId,
        service_duration: newDuration,
        service_price: newPrice,
        service_fee: newServiceFee,
        total_amount: newTotalAmount,
        service_name: newServiceName,  // 更新服务名称（多语言JSONB）
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)

    if (updateOrderError) {
      console.error('[升级服务] 更新订单失败:', updateOrderError)
      return { ok: false, error: "更新订单失败" }
    }

    // 7. 检查并更新结算记录（如果存在）
    const { data: settlementData, error: settlementQueryError } = await supabase
      .from('order_settlements')
      .select('id, service_fee, service_commission_rate, extra_fee, extra_commission_rate, customer_paid_to_platform')
      .eq('order_id', orderId)
      .maybeSingle()

    if (settlementQueryError) {
      console.error('[升级服务] 查询结算记录失败:', settlementQueryError)
      // 不阻断升级流程，只记录错误
    }

    // 如果结算记录存在，更新金额和提成
    if (settlementData) {
      const settlement = settlementData as {
        id: string
        service_fee: number
        service_commission_rate: number
        extra_fee: number
        extra_commission_rate: number
        customer_paid_to_platform: number
      }

      // 🔧 关键修复：如果更换了服务，使用新服务的提成比例；否则使用原提成比例
      const finalServiceCommissionRate = isServiceChanged && newServiceCommissionRate !== null
        ? newServiceCommissionRate
        : settlement.service_commission_rate

      const newPlatformShouldGet = newServiceFee * finalServiceCommissionRate + settlement.extra_fee * settlement.extra_commission_rate
      const newSettlementAmount = newPlatformShouldGet - settlement.customer_paid_to_platform

      const settlementUpdateData: any = {
        service_fee: newServiceFee,
        platform_should_get: newPlatformShouldGet,
        settlement_amount: newSettlementAmount,
        updated_at: new Date().toISOString()
      }

      // 🔧 如果更换了服务，同时更新提成比例
      if (isServiceChanged) {
        settlementUpdateData.service_commission_rate = finalServiceCommissionRate
      }

      const { error: updateSettlementError } = await (supabase
        .from('order_settlements') as any)
        .update(settlementUpdateData)
        .eq('id', settlement.id)

      if (updateSettlementError) {
        console.error('[升级服务] 更新结算记录失败:', updateSettlementError)
        // 不阻断升级流程，只记录错误
      }
    }

    // 8. 记录审计日志（如果需要）
    // TODO: 可以在 audit_logs 表记录升级操作

    return {
      ok: true,
      data: {
        order_id: orderId,
        old_service_id: order.service_id,
        new_service_id: newServiceId,
        service_changed: isServiceChanged,
        old_duration: order.service_duration,
        new_duration: newDuration,
        old_price: order.service_price,
        new_price: newPrice,
        price_difference: priceDifference,
        new_total: newTotalAmount
      }
    }
  } catch (error) {
    console.error('[升级服务] 执行升级失败:', error)
    return { ok: false, error: "升级服务失败" }
  }
}
