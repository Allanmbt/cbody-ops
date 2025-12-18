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
 * 订单管理统计数据（轻量级）
 */
export interface AdminOrderStats {
  total: number              // 总订单数
  active: number             // 进行中（confirmed, en_route, arrived, in_service）
  completed: number          // 已完成
  cancelled: number          // 已取消
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

    const { count: totalCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })

    const { count: activeCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .in('status', ['confirmed', 'en_route', 'arrived', 'in_service'])

    const { count: completedCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')

    const { count: cancelledCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'cancelled')

    return {
      ok: true as const,
      data: {
        total: totalCount || 0,
        active: activeCount || 0,
        completed: completedCount || 0,
        cancelled: cancelledCount || 0
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
 * 检查订单的结算状态
 */
export async function checkOrderSettlementStatus(orderId: string): Promise<ApiResponse<{
  hasSettlement: boolean
  settlementStatus: string | null
  canUpgrade: boolean
}>> {
  try {
    await requireAdmin(['superadmin', 'admin', 'support'])
    const supabase = getSupabaseAdminClient()

    const { data, error } = await supabase
      .from('order_settlements')
      .select('id, settlement_status')
      .eq('order_id', orderId)
      .maybeSingle()

    if (!error && data) {
      const settlement = data as { id: string; settlement_status: string }
      return {
        ok: true,
        data: {
          hasSettlement: true,
          settlementStatus: settlement.settlement_status,
          canUpgrade: settlement.settlement_status === 'pending'
        }
      }
    } else {
      return {
        ok: true,
        data: {
          hasSettlement: false,
          settlementStatus: null,
          canUpgrade: false
        }
      }
    }
  } catch (error) {
    console.error('[检查结算状态] 失败:', error)
    return {
      ok: false,
      error: "检查结算状态失败"
    }
  }
}

/**
 * 获取订单可升级的服务列表（订单管理专用）
 * 区别于订单监管：
 * 1. 只能对已完成订单（completed）进行升级
 * 2. 订单的结算记录必须存在且为待核验状态（settlement_status = 'pending'）
 * 3. 升级逻辑与订单监管相同：
 *    - 相同服务：只能选择更长时长（价格可以相同或更高）
 *    - 不同服务：价格必须≥当前服务价格
 * 4. 升级后需要同步更新 order_settlements 表中的相关提成和金额
 */
export async function getUpgradableServicesForCompleted(orderId: string): Promise<{ ok: true; data: any[] } | { ok: false; error: string }> {
  try {
    await requireAdmin(['superadmin', 'admin', 'support'])
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

    // 2. 检查订单状态，必须是已完成的订单
    if (order.status !== 'completed') {
      return { ok: false, error: "只能对已完成的订单进行升级" }
    }

    // 3. 检查订单结算记录，必须是待核验状态
    const { data: settlementData, error: settlementError } = await supabase
      .from('order_settlements')
      .select('id, settlement_status')
      .eq('order_id', orderId)
      .maybeSingle()

    if (settlementError || !settlementData) {
      return { ok: false, error: "订单结算记录不存在" }
    }

    const settlement = settlementData as { id: string; settlement_status: string }

    if (settlement.settlement_status !== 'pending') {
      return { ok: false, error: "订单已核验，无法升级服务" }
    }

    // 4. 获取该技师绑定的所有服务（与订单监管逻辑相同）
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

    // 5. 获取所有技师绑定服务的时长配置
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

    // 6. 筛选可升级的服务（与订单监管逻辑相同）
    const upgradableServices = allDurations
      .map((d: any) => {
        const duration = d.service_durations
        const price = d.custom_price || duration.default_price

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
    console.error('[订单管理-升级服务] 获取可升级服务失败:', error)
    return { ok: false, error: "获取可升级服务失败" }
  }
}

/**
 * 执行已完成订单的服务升级（订单管理专用）
 * 与订单监管升级的区别：
 * 1. 订单状态必须是 completed
 * 2. 必须同步更新 order_settlements 表的金额和提成
 * 3. 结算状态必须保持为 pending
 */
export async function upgradeCompletedOrderService(orderId: string, newServiceDurationId: number): Promise<{ ok: true; data: any } | { ok: false; error: string }> {
  try {
    await requireAdmin(['superadmin', 'admin', 'support'])
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
    if (order.status !== 'completed') {
      return { ok: false, error: "只能对已完成的订单进行升级" }
    }

    // 3. 检查订单结算记录
    const { data: settlementData, error: settlementQueryError } = await supabase
      .from('order_settlements')
      .select(`
        id,
        settlement_status,
        service_fee,
        extra_fee,
        service_commission_rate,
        extra_commission_rate,
        platform_should_get,
        customer_paid_to_platform,
        settlement_amount
      `)
      .eq('order_id', orderId)
      .maybeSingle()

    if (settlementQueryError || !settlementData) {
      return { ok: false, error: "订单结算记录不存在" }
    }

    const settlement = settlementData as {
      id: string
      settlement_status: string
      service_fee: number
      extra_fee: number
      service_commission_rate: number
      extra_commission_rate: number
      platform_should_get: number
      customer_paid_to_platform: number
      settlement_amount: number
    }

    if (settlement.settlement_status !== 'pending') {
      return { ok: false, error: "订单已核验，无法升级服务" }
    }

    // 4. 获取新服务时长和价格，包括服务名称和提成比例
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

    // 5. 验证升级规则
    if (newServiceId === order.service_id) {
      if (newDuration <= order.service_duration) {
        return { ok: false, error: "同一服务必须升级到更长时长" }
      }
    } else {
      if (newPrice < order.service_price) {
        return { ok: false, error: "更换服务的价格不能低于当前服务" }
      }
    }

    // 6. 计算新的金额
    const priceDifference = newPrice - order.service_price
    const newTotalAmount = order.total_amount + priceDifference
    const newServiceFee = order.service_fee + priceDifference

    // 7. 计算新的结算数据
    // 🔧 关键修复：如果更换了服务，使用新服务的提成比例；否则使用原提成比例
    const isServiceChanged = newServiceId !== order.service_id
    const finalServiceCommissionRate = isServiceChanged && newServiceCommissionRate !== null
      ? newServiceCommissionRate
      : settlement.service_commission_rate

    const newPlatformShouldGet = newServiceFee * finalServiceCommissionRate + settlement.extra_fee * settlement.extra_commission_rate
    const newSettlementAmount = newPlatformShouldGet - settlement.customer_paid_to_platform

    // 8. 更新订单信息
    const { error: updateOrderError } = await (supabase
      .from('orders') as any)
      .update({
        service_id: newServiceId,
        service_duration_id: newServiceDurationId,
        service_duration: newDuration,
        service_price: newPrice,
        service_fee: newServiceFee,
        total_amount: newTotalAmount,
        service_name: newServiceName,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)

    if (updateOrderError) {
      console.error('[订单管理-升级服务] 更新订单失败:', updateOrderError)
      return { ok: false, error: "更新订单失败" }
    }

    // 9. 同步更新结算记录
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
      console.error('[订单管理-升级服务] 更新结算记录失败:', updateSettlementError)
      return { ok: false, error: "更新结算记录失败" }
    }

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
        new_total: newTotalAmount,
        old_commission_rate: settlement.service_commission_rate,
        new_commission_rate: finalServiceCommissionRate,
        new_platform_should_get: newPlatformShouldGet,
        new_settlement_amount: newSettlementAmount
      }
    }
  } catch (error) {
    console.error('[订单管理-升级服务] 执行升级失败:', error)
    return { ok: false, error: "升级服务失败" }
  }
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
