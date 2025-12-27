"use server"

import { getSupabaseAdminClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/auth"
import {
  girlAttendanceListParamsSchema,
  type GirlAttendanceListParams,
  type GirlAttendanceStats,
  type City,
  type ApiResponse
} from "@/lib/features/girl-attendance"

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
 * 获取城市列表
 */
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
