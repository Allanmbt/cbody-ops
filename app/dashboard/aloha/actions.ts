"use server"

import { getSupabaseAdminClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/auth"
import type { AlohaGirl, UpdateStatusData } from "@/lib/features/aloha"

type ApiResponse<T> =
  | { ok: true; data: T; error?: never }
  | { ok: false; data?: never; error: string }

interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

/**
 * 获取清迈女孩列表（仅 available/busy 状态且未屏蔽）
 */
export async function getChiangMaiGirls(
  page: number = 1,
  limit: number = 20
): Promise<ApiResponse<PaginatedResponse<AlohaGirl>>> {
  try {
    const admin = await requireAdmin()

    // 特殊权限检查：只有 display_name=AlohaAdmin 的 support 可以访问
    if (!(admin.display_name === 'AlohaAdmin' && admin.role === 'support')) {
      return { ok: false, error: "无权限访问" }
    }

    const supabase = getSupabaseAdminClient()

    // 获取清迈城市ID
    const { data: city } = await supabase
      .from('cities')
      .select('id')
      .eq('code', 'CNX')
      .single()

    if (!city) {
      return { ok: false, error: "清迈城市未配置" }
    }

    // 查询未屏蔽且状态为 available/busy 的女孩
    let query = supabase
      .from('girls')
      .select(`
        id,
        girl_number,
        name,
        avatar_url,
        girls_status!inner(status, next_available_time)
      `, { count: 'exact' })
      .eq('city_id', (city as { id: string }).id)
      .eq('is_blocked', false)
      .in('girls_status.status', ['available', 'busy'])

    // 分页
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to).order('girl_number', { ascending: true })

    const { data, error, count } = await query

    if (error) {
      console.error('[Aloha] 查询女孩列表失败:', error)
      return { ok: false, error: "查询列表失败" }
    }

    // 转换数据格式
    const girls: AlohaGirl[] = (data as any[])?.map((item: any) => ({
      id: item.id,
      girl_number: item.girl_number?.toString() || '',
      name: item.name,
      avatar_url: item.avatar_url,
      status: item.girls_status.status,
      next_available_time: item.girls_status.next_available_time
    })) || []

    const totalPages = Math.ceil((count || 0) / limit)

    return {
      ok: true,
      data: {
        data: girls,
        total: count || 0,
        page,
        limit,
        totalPages
      }
    }
  } catch (error) {
    console.error('[Aloha] 查询异常:', error)
    return { ok: false, error: "查询异常" }
  }
}

/**
 * 更新女孩状态
 */
export async function updateGirlStatus(
  params: UpdateStatusData
): Promise<ApiResponse<void>> {
  try {
    const admin = await requireAdmin()

    // 特殊权限检查
    if (!(admin.display_name === 'AlohaAdmin' && admin.role === 'support')) {
      return { ok: false, error: "无权限操作" }
    }

    const supabase = getSupabaseAdminClient()

    // 获取当前状态
    const { data: statusData, error: fetchError } = await supabase
      .from('girls_status')
      .select('status, girl_id')
      .eq('girl_id', params.girl_id)
      .single()

    if (fetchError || !statusData) {
      return { ok: false, error: "女孩不存在" }
    }

    const currentStatus = statusData.status

    // 如果是 offline 状态，不允许操作
    if (currentStatus === 'offline') {
      return { ok: false, error: "女孩处于离线状态，无法操作" }
    }

    let updateData: any

    if (currentStatus === 'busy') {
      // busy -> available：清除 next_available_time
      updateData = {
        status: 'available',
        next_available_time: null
      }
    } else {
      // available -> busy：设置 next_available_time
      const now = new Date()
      const nextAvailableTime = new Date(now.getTime() + params.minutes * 60 * 1000)
      updateData = {
        status: 'busy',
        next_available_time: nextAvailableTime.toISOString()
      }
    }

    const { error: updateError } = await supabase
      .from('girls_status')
      .update(updateData)
      .eq('girl_id', params.girl_id)

    if (updateError) {
      console.error('[Aloha] 更新状态失败:', updateError)
      return { ok: false, error: "更新状态失败" }
    }

    return { ok: true, data: undefined }
  } catch (error) {
    console.error('[Aloha] 更新状态异常:', error)
    return { ok: false, error: "更新状态异常" }
  }
}
