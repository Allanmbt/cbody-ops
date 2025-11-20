"use server"

import { getSupabaseAdminClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/auth"

/**
 * 技师状态统计
 */
export interface TherapistStats {
  online: number        // 在线
  busy: number         // 忙碌
  offline: number      // 离线
  today_online_rate: number  // 今日上线率
}

/**
 * 技师在线时长统计
 */
export interface TherapistWorkStats {
  today_hours: number      // 今日在线时长（小时）
  week_hours: number       // 近7日在线时长
  month_hours: number      // 近30日在线时长
  total_hours: number      // 总在线时长
}

/**
 * 监控技师筛选参数
 */
export interface MonitoringTherapistFilters {
  search?: string
  status?: ('available' | 'busy' | 'offline')[]
  city?: string
  only_abnormal?: boolean
  page?: number
  limit?: number
}

/**
 * 获取技师状态统计
 */
export async function getTherapistStats() {
  try {
    await requireAdmin()
    const supabase = getSupabaseAdminClient()

    // 在线技师（已授权：is_blocked=false + is_verified=true）
    // 需要 JOIN girls_status 表获取状态
    const { count: onlineCount } = await supabase
      .from('girls_status')
      .select('girl_id, girls!inner(id)', { count: 'exact', head: true })
      .eq('status', 'available')
      .eq('girls.is_blocked', false)
      .eq('girls.is_verified', true)

    // 忙碌技师
    const { count: busyCount } = await supabase
      .from('girls_status')
      .select('girl_id, girls!inner(id)', { count: 'exact', head: true })
      .eq('status', 'busy')
      .eq('girls.is_blocked', false)
      .eq('girls.is_verified', true)

    // 离线技师
    const { count: offlineCount } = await supabase
      .from('girls_status')
      .select('girl_id, girls!inner(id)', { count: 'exact', head: true })
      .eq('status', 'offline')
      .eq('girls.is_blocked', false)
      .eq('girls.is_verified', true)

    // 计算今日上线率（已授权技师总数）
    const { count: totalCount } = await supabase
      .from('girls')
      .select('*', { count: 'exact', head: true })
      .eq('is_blocked', false)
      .eq('is_verified', true)

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    // 今日上线过的技师数量
    const { count: todayOnlineCount } = await supabase
      .from('girls_status')
      .select('girl_id, girls!inner(id)', { count: 'exact', head: true })
      .eq('girls.is_blocked', false)
      .eq('girls.is_verified', true)
      .gte('last_online_at', todayStart.toISOString())

    const todayOnlineRate = totalCount && todayOnlineCount
      ? Math.round((todayOnlineCount / totalCount) * 100)
      : 0

    return {
      ok: true,
      data: {
        online: onlineCount || 0,
        busy: busyCount || 0,
        offline: offlineCount || 0,
        today_online_rate: todayOnlineRate
      } as TherapistStats
    }
  } catch (error) {
    console.error('[技师统计] 获取失败:', error)
    return { ok: false, error: "获取技师统计失败" }
  }
}

/**
 * 获取监控技师列表
 */
export async function getMonitoringTherapists(filters: MonitoringTherapistFilters = {}) {
  try {
    await requireAdmin()
    const supabase = getSupabaseAdminClient()

    const {
      search,
      status,
      city,
      only_abnormal = false,
      page = 1,
      limit = 50
    } = filters

    // 构建查询：JOIN girls、girls_status 和 cities 表
    // 只查询已授权技师：is_blocked=false + is_verified=true
    let query = supabase
      .from('girls')
      .select(`
        id,
        girl_number,
        username,
        name,
        avatar_url,
        city_id,
        is_blocked,
        is_verified,
        cities (
          id,
          code,
          name
        ),
        girls_status!inner (
          status,
          current_lat,
          current_lng,
          last_online_at,
          cooldown_until_at,
          next_available_time
        )
      `, { count: 'exact' })
      .eq('is_blocked', false)
      .eq('is_verified', true)

    // 状态筛选（在 girls_status 表上）
    if (status && status.length > 0) {
      query = query.in('girls_status.status', status)
    } else if (!only_abnormal) {
      // 默认显示在线和忙碌
      query = query.in('girls_status.status', ['available', 'busy'])
    }

    // 城市筛选（使用 city_id）
    if (city) {
      const cityId = parseInt(city)
      if (!isNaN(cityId)) {
        query = query.eq('city_id', cityId)
      }
    }

    // 搜索（工号、姓名、用户名）
    if (search) {
      const girlNumber = parseInt(search)
      if (!isNaN(girlNumber)) {
        query = query.or(`girl_number.eq.${girlNumber},name.ilike.%${search}%,username.ilike.%${search}%`)
      } else {
        query = query.or(`name.ilike.%${search}%,username.ilike.%${search}%`)
      }
    }

    // 排序：按工号（JOIN 查询中无法直接对嵌套字段排序，状态排序在客户端处理）
    query = query.order('girl_number', { ascending: true })

    // 分页
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data: therapistsData, error, count } = await query

    if (error) {
      console.error('[技师监控] 查询失败:', error)
      return { ok: false, error: `查询技师失败: ${error.message}` }
    }

    // 查询每个技师的当前订单（如果 busy）
    let therapistsWithOrders: any[] = therapistsData || []
    if (therapistsData && therapistsData.length > 0) {
      // 提取 girls_status 和 cities 并展平到主对象
      let flattenedTherapists = therapistsData.map((t: any) => ({
        ...t,
        status: t.girls_status?.status || 'offline',
        current_lat: t.girls_status?.current_lat || null,
        current_lng: t.girls_status?.current_lng || null,
        last_online_at: t.girls_status?.last_online_at || null,
        cooldown_until_at: t.girls_status?.cooldown_until_at || null,
        next_available_time: t.girls_status?.next_available_time || null,
        city: t.cities || null,
      }))

      // 按状态排序（available > busy > offline）
      const statusOrder: Record<string, number> = { available: 1, busy: 2, offline: 3 }
      flattenedTherapists.sort((a, b) => {
        const aOrder = statusOrder[a.status] || 999
        const bOrder = statusOrder[b.status] || 999
        return aOrder - bOrder
      })

      const busyTherapists = flattenedTherapists.filter((t: any) => t.status === 'busy')

      if (busyTherapists.length > 0) {
        const therapistIds = busyTherapists.map((t: any) => t.id)

        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select('id, order_number, status, girl_id')
          .in('girl_id', therapistIds)
          .in('status', ['confirmed', 'en_route', 'arrived', 'in_service'])

        if (ordersError) {
          console.error('[技师监控] 查询订单失败:', ordersError)
        }

        const ordersMap = new Map()
        if (ordersData && ordersData.length > 0) {
          ordersData.forEach((order: any) => {
            // 每个技师只显示第一个订单（如果有多个）
            if (!ordersMap.has(order.girl_id)) {
              ordersMap.set(order.girl_id, order)
            }
          })
          console.log(`[技师监控] 找到 ${ordersData.length} 个订单，关联到 ${ordersMap.size} 个技师`)
        }

        therapistsWithOrders = flattenedTherapists.map((therapist: any) => ({
          ...therapist,
          current_order: therapist.status === 'busy' ? ordersMap.get(therapist.id) : null
        }))
      } else {
        therapistsWithOrders = flattenedTherapists.map((therapist: any) => ({
          ...therapist,
          current_order: null
        }))
      }
    }

    const totalPages = Math.ceil((count || 0) / limit)

    return {
      ok: true,
      data: {
        therapists: therapistsWithOrders,
        total: count || 0,
        page,
        limit,
        totalPages
      }
    }
  } catch (error) {
    console.error('[技师监控] 查询异常:', error)
    return { ok: false, error: "查询技师异常" }
  }
}

/**
 * 获取技师在线时长统计
 */
export async function getTherapistWorkStats(therapistId: string): Promise<{ ok: boolean; data?: TherapistWorkStats; error?: string }> {
  try {
    await requireAdmin()
    const supabase = getSupabaseAdminClient()

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const monthStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    // 今日在线时长
    const { data: todaySessions } = await supabase
      .from('girl_work_sessions')
      .select('started_at, ended_at')
      .eq('girl_id', therapistId)
      .gte('started_at', todayStart.toISOString())

    // 近7日在线时长
    const { data: weekSessions } = await supabase
      .from('girl_work_sessions')
      .select('started_at, ended_at')
      .eq('girl_id', therapistId)
      .gte('started_at', weekStart.toISOString())

    // 近30日在线时长
    const { data: monthSessions } = await supabase
      .from('girl_work_sessions')
      .select('started_at, ended_at')
      .eq('girl_id', therapistId)
      .gte('started_at', monthStart.toISOString())

    // 总在线时长
    const { data: totalSessions } = await supabase
      .from('girl_work_sessions')
      .select('started_at, ended_at')
      .eq('girl_id', therapistId)

    const calculateHours = (sessions: any[]) => {
      if (!sessions || sessions.length === 0) return 0

      let totalMs = 0
      sessions.forEach((session: any) => {
        const start = new Date(session.started_at).getTime()
        const end = session.ended_at ? new Date(session.ended_at).getTime() : Date.now()
        totalMs += (end - start)
      })

      return Number((totalMs / (1000 * 60 * 60)).toFixed(1))
    }

    return {
      ok: true,
      data: {
        today_hours: calculateHours(todaySessions || []),
        week_hours: calculateHours(weekSessions || []),
        month_hours: calculateHours(monthSessions || []),
        total_hours: calculateHours(totalSessions || [])
      }
    }
  } catch (error) {
    console.error('[在线时长统计] 查询失败:', error)
    return { ok: false, error: "查询在线时长失败" }
  }
}

/**
 * 设置技师冷却时长
 */
export async function setTherapistCooldown(
  therapistId: string,
  hours: number
): Promise<{ ok: boolean; error?: string }> {
  try {
    const admin = await requireAdmin(['superadmin', 'admin'])
    const supabase = getSupabaseAdminClient()

    const cooldownUntil = new Date(Date.now() + hours * 60 * 60 * 1000)

    // 更新 girls_status 表（不是 girls 表！）
    const { error: updateError } = await (supabase as any)
      .from('girls_status')
      .update({
        cooldown_until_at: cooldownUntil.toISOString(),
        status: 'offline',  // 强制下线
        updated_at: new Date().toISOString()
      })
      .eq('girl_id', therapistId)

    if (updateError) {
      console.error('[设置冷却] 更新失败:', updateError)
      return { ok: false, error: "设置冷却失败" }
    }

    console.log(`[设置冷却] 技师 ${therapistId} 冷却至 ${cooldownUntil.toISOString()}, 操作人: ${admin.display_name}`)

    return { ok: true }
  } catch (error) {
    console.error('[设置冷却] 操作异常:', error)
    return { ok: false, error: "设置冷却异常" }
  }
}

/**
 * 取消技师冷却
 */
export async function cancelTherapistCooldown(
  therapistId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const admin = await requireAdmin(['superadmin', 'admin'])
    const supabase = getSupabaseAdminClient()

    // 更新 girls_status 表（不是 girls 表！）
    const { error: updateError } = await (supabase as any)
      .from('girls_status')
      .update({
        cooldown_until_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('girl_id', therapistId)

    if (updateError) {
      console.error('[取消冷却] 更新失败:', updateError)
      return { ok: false, error: "取消冷却失败" }
    }

    console.log(`[取消冷却] 技师 ${therapistId}, 操作人: ${admin.display_name}`)

    return { ok: true }
  } catch (error) {
    console.error('[取消冷却] 操作异常:', error)
    return { ok: false, error: "取消冷却异常" }
  }
}
