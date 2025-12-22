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
    const admin = await requireAdmin(['superadmin', 'admin', 'support'], { allowMumuForOperations: true })
    const supabase = getSupabaseAdminClient()

    // 判断是否需要过滤 sort_order < 998 的技师
    const shouldFilterSortOrder = admin.role !== 'superadmin' && admin.role !== 'admin'

    // 在线技师（已授权：is_blocked=false + is_verified=true）
    // 需要 JOIN girls_status 表获取状态
    let onlineQuery = supabase
      .from('girls_status')
      .select('girl_id, girls!inner(id)', { count: 'exact', head: true })
      .eq('status', 'available')
      .eq('girls.is_blocked', false)
      .eq('girls.is_verified', true)
    if (shouldFilterSortOrder) onlineQuery = onlineQuery.gte('girls.sort_order', 998)
    const { count: onlineCount } = await onlineQuery

    // 忙碌技师
    let busyQuery = supabase
      .from('girls_status')
      .select('girl_id, girls!inner(id)', { count: 'exact', head: true })
      .eq('status', 'busy')
      .eq('girls.is_blocked', false)
      .eq('girls.is_verified', true)
    if (shouldFilterSortOrder) busyQuery = busyQuery.gte('girls.sort_order', 998)
    const { count: busyCount } = await busyQuery

    // 离线技师
    let offlineQuery = supabase
      .from('girls_status')
      .select('girl_id, girls!inner(id)', { count: 'exact', head: true })
      .eq('status', 'offline')
      .eq('girls.is_blocked', false)
      .eq('girls.is_verified', true)
    if (shouldFilterSortOrder) offlineQuery = offlineQuery.gte('girls.sort_order', 998)
    const { count: offlineCount } = await offlineQuery

    // 计算今日上线率（已授权技师总数）
    let totalQuery = supabase
      .from('girls')
      .select('*', { count: 'exact', head: true })
      .eq('is_blocked', false)
      .eq('is_verified', true)
    if (shouldFilterSortOrder) totalQuery = totalQuery.gte('sort_order', 998)
    const { count: totalCount } = await totalQuery

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    // 今日上线过的技师数量
    let todayOnlineQuery = supabase
      .from('girls_status')
      .select('girl_id, girls!inner(id)', { count: 'exact', head: true })
      .eq('girls.is_blocked', false)
      .eq('girls.is_verified', true)
      .gte('last_online_at', todayStart.toISOString())
    if (shouldFilterSortOrder) todayOnlineQuery = todayOnlineQuery.gte('girls.sort_order', 998)
    const { count: todayOnlineCount } = await todayOnlineQuery

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
 * ✅ 优化：使用视图，从2次查询减少到1次，移除客户端排序
 */
export async function getMonitoringTherapists(filters: MonitoringTherapistFilters = {}) {
  try {
    const admin = await requireAdmin(['superadmin', 'admin', 'support'], { allowMumuForOperations: true })
    const supabase = getSupabaseAdminClient()

    // 判断是否需要过滤 sort_order < 998 的技师
    const shouldFilterSortOrder = admin.role !== 'superadmin' && admin.role !== 'admin'

    const {
      search,
      status,
      city,
      only_abnormal = false,
      page = 1,
      limit = 50
    } = filters

    // ✅ 优化：使用视图 v_therapist_monitoring，一次查询包含所有数据
    let query = (supabase as any)
      .from('v_therapist_monitoring')
      .select('*', { count: 'exact' })

    // 添加 sort_order 过滤
    if (shouldFilterSortOrder) {
      query = query.gte('sort_order', 998)
    }

    // ✅ 优化：状态筛选（直接在视图的 status 字段上）
    if (status && status.length > 0) {
      query = query.in('status', status)
    } else if (!only_abnormal) {
      // 默认显示在线和忙碌
      query = query.in('status', ['available', 'busy'])
    }

    // 城市筛选
    if (city) {
      const cityId = parseInt(city)
      if (!isNaN(cityId)) {
        query = query.eq('city_id', cityId)
      }
    }

    // 搜索（工号、姓名、用户名）- 不区分大小写
    if (search) {
      const girlNumber = parseInt(search)
      if (!isNaN(girlNumber)) {
        // 纯数字：按工号精确匹配
        query = query.or(`girl_number.eq.${girlNumber},name.ilike.%${search}%,username.ilike.%${search}%`)
      } else {
        // 文本：按姓名或用户名模糊匹配（ilike 不区分大小写）
        query = query.or(`name.ilike.%${search}%,username.ilike.%${search}%`)
      }
    }

    // ✅ 优化：使用数据库排序（status_order 字段），移除客户端排序
    query = query.order('status_order', { ascending: true })
      .order('girl_number', { ascending: true })

    // 分页
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data: therapistsData, error, count } = await query

    if (error) {
      console.error('[技师监控] 查询失败:', error)
      return { ok: false, error: `查询技师失败: ${error.message}` }
    }

    // ✅ 优化：视图已包含所有数据（技师+状态+城市+订单），无需额外处理
    // 数据已在数据库中排序，无需客户端排序
    const therapistsWithOrders = (therapistsData || []).map((t: any) => ({
      ...t,
      // 构建 city 对象（兼容前端）
      city: t.city_code ? {
        id: t.city_id,
        code: t.city_code,
        name: t.city_name
      } : null,
      // 构建 current_order 对象（兼容前端）
      current_order: t.current_order_id ? {
        id: t.current_order_id,
        order_number: t.current_order_number,
        status: t.current_order_status
      } : null
    }))

    const totalPages = Math.ceil((count || 0) / limit)

    return {
      ok: true as const,
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
    return { ok: false as const, error: "查询技师异常" }
  }
}

/**
 * 获取技师在线时长统计
 */
export async function getTherapistWorkStats(therapistId: string): Promise<{ ok: boolean; data?: TherapistWorkStats; error?: string }> {
  try {
    await requireAdmin(['superadmin', 'admin', 'support'], { allowMumuForOperations: true })
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
    const admin = await requireAdmin(['superadmin', 'admin', 'support'], { allowMumuForOperations: true })
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
    const admin = await requireAdmin(['superadmin', 'admin', 'support'], { allowMumuForOperations: true })
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

/**
 * 更新技师状态（available/busy/offline）
 */
export async function updateTherapistStatus(
  therapistId: string,
  newStatus: 'available' | 'busy' | 'offline'
): Promise<{ ok: boolean; error?: string }> {
  try {
    const admin = await requireAdmin(['superadmin', 'admin', 'support'], { allowMumuForOperations: true })
    const supabase = getSupabaseAdminClient()

    // 更新 girls_status 表的 status 字段
    const { error: updateError } = await (supabase as any)
      .from('girls_status')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('girl_id', therapistId)

    if (updateError) {
      console.error('[更新技师状态] 更新失败:', updateError)
      return { ok: false, error: "更新状态失败" }
    }

    console.log(`[更新技师状态] 技师 ${therapistId} 状态更新为 ${newStatus}, 操作人: ${admin.display_name}`)

    return { ok: true }
  } catch (error) {
    console.error('[更新技师状态] 操作异常:', error)
    return { ok: false, error: "更新状态异常" }
  }
}
