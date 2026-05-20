"use server"

import { getSupabaseAdminClient } from "@/lib/supabase"
import { requireAdmin, getCurrentAdminFromServerAction } from "@/lib/auth"
import {
  girlAttendanceListParamsSchema,
  girlPerformanceSnapshotParamsSchema,
  type GirlAttendanceListParams,
  type GirlAttendanceStats,
  type GirlPerformanceSnapshot,
  type City,
  type ApiResponse
} from "@/lib/features/girl-attendance"

/**
 * 获取当前管理员信息
 */
export async function getCurrentAdminInfo(): Promise<ApiResponse<{ role: string }>> {
  try {
    const admin = await getCurrentAdminFromServerAction()

    if (!admin) {
      return { ok: false, error: '未登录' }
    }

    return { ok: true, data: { role: admin.role } }
  } catch (error) {
    console.error('[获取管理员信息] 异常:', error)
    return { ok: false, error: '获取管理员信息失败' }
  }
}

/**
 * 获取技师考勤统计列表
 */
export async function getGirlAttendanceStats(
  params: GirlAttendanceListParams
): Promise<ApiResponse<GirlAttendanceStats[]>> {
  try {
    await requireAdmin(['superadmin', 'admin', 'support'])

    const validated = girlAttendanceListParamsSchema.parse(params)
    const { search, city_id, sort_by, sort_order } = validated

    const supabase = getSupabaseAdminClient()

    let query = supabase
      .from('v_girl_attendance_stats')
      .select('*')

    // 搜索：支持技师名称或工号
    if (search) {
      const searchNum = parseInt(search)
      if (!isNaN(searchNum)) {
        query = query.eq('girl_number', searchNum)
      } else {
        query = query.ilike('name', `%${search}%`)
      }
    }

    // 城市筛选
    if (city_id) {
      query = query.eq('city_id', city_id)
    }

    // 排序
    query = query.order(sort_by, { ascending: sort_order === 'asc' } as any)

    const { data, error } = await query

    if (error) {
      console.error('[技师考勤统计] 查询失败:', error)
      return { ok: false, error: '获取考勤统计失败' }
    }

    return { ok: true, data: data as GirlAttendanceStats[] }
  } catch (error) {
    console.error('[技师考勤统计] 异常:', error)
    return { ok: false, error: error instanceof Error ? error.message : '获取考勤统计异常' }
  }
}

/**
 * 获取单个技师业绩快照
 */
export async function getGirlPerformanceSnapshot(
  girlId: string
): Promise<ApiResponse<GirlPerformanceSnapshot | null>> {
  try {
    await requireAdmin(['superadmin', 'admin', 'support'])

    const validated = girlPerformanceSnapshotParamsSchema.parse({ girl_id: girlId })
    const supabase = getSupabaseAdminClient()

    const { data, error } = await (supabase as any).rpc('get_girl_performance_snapshot', {
      p_girl_id: validated.girl_id
    })

    if (error) {
      console.error('[技师业绩快照] 查询失败:', error)
      return { ok: false, error: '获取业绩快照失败' }
    }

    if (!data || data.length === 0) {
      return { ok: true, data: null }
    }

    const snapshot = data[0]

    return {
      ok: true,
      data: {
        booking_efficiency_rate: Number(snapshot.booking_efficiency_rate || 0),
        extension_rate: Number(snapshot.extension_rate || 0),
        extra_time_total_minutes: Number(snapshot.extra_time_total_minutes || 0),
        arrived_cancellation_rate: Number(snapshot.arrived_cancellation_rate || 0),
        repeat_client_rate: Number(snapshot.repeat_client_rate || 0),
        favorite_growth_count: Number(snapshot.favorite_growth_count || 0),
        performance_index: Number(snapshot.performance_index || 0),
        performance_level: snapshot.performance_level,
        window_days: Number(snapshot.window_days || 90),
        generated_at: snapshot.generated_at
      }
    }
  } catch (error) {
    console.error('[技师业绩快照] 异常:', error)
    return { ok: false, error: error instanceof Error ? error.message : '获取业绩快照异常' }
  }
}

// 获取城市列表
export async function getCities(): Promise<ApiResponse<City[]>> {
  try {
    await requireAdmin(['superadmin', 'admin', 'support'])

    const supabase = getSupabaseAdminClient()

    const { data, error } = await supabase
      .from('cities')
      .select('id, name')
      .order('name')

    if (error) {
      console.error('[城市列表] 查询失败:', error)
      return { ok: false, error: '获取城市列表失败' }
    }

    return { ok: true, data: data as City[] }
  } catch (error) {
    console.error('[城市列表] 异常:', error)
    return { ok: false, error: error instanceof Error ? error.message : '获取城市列表异常' }
  }
}

/**
 * 根据考勤表现批量更新技师诚信分
 * 仅超级管理员可执行
 */
export async function updateTrustScoresByAttendance(): Promise<ApiResponse<{ updated_count: number }>> {
  try {
    // 严格权限验证：仅超级管理员
    const admin = await requireAdmin(['superadmin'])

    const supabase = getSupabaseAdminClient()

    // 执行批量更新 SQL
    const { data, error } = await supabase.rpc('update_trust_scores_by_attendance')

    if (error) {
      console.error('[诚信分更新] 执行失败:', error)
      return { ok: false, error: '更新诚信分失败' }
    }

    // 记录操作日志
    await supabase.from('audit_logs').insert({
      admin_id: admin.id,
      action: 'update_trust_scores',
      target_type: 'girls',
      target_id: null,
      payload: { source: 'attendance_stats' },
      ip_address: null
    } as any)

    console.log('[诚信分更新] 成功更新技师诚信分')

    return { ok: true, data: { updated_count: data || 0 } }
  } catch (error) {
    console.error('[诚信分更新] 异常:', error)
    return { ok: false, error: error instanceof Error ? error.message : '更新诚信分异常' }
  }
}
