"use server"

import { getSupabaseAdminClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/auth"
import {
    serviceBindListParamsSchema,
    batchBindSchema,
    batchUnbindSchema,
    batchRestoreSchema,
    type ServiceBindListParams,
    type BatchBindData,
    type BatchUnbindData,
    type BatchRestoreData
} from "@/lib/features/services"
import type {
    ApiResponse,
    PaginatedResponse,
    ServiceGirlBindItem,
    Service,
    ServiceDuration
} from "@/lib/features/services"

// 注意：所有函数现在使用 requireAdmin() 进行统一的权限验证

// 获取服务详情（包含时长统计）
export async function getServiceDetail(serviceId: number): Promise<ApiResponse<Service & { durations?: ServiceDuration[] }>> {
    try {
        // 验证管理员权限
        await requireAdmin(['superadmin', 'admin'])
        const supabase = getSupabaseAdminClient()

        // ✅ 优化：一次性获取服务信息和时长列表（2次查询 → 1次）
        const { data: service, error: serviceError } = await supabase
            .from('services')
            .select(`
                *,
                category:categories(id, code, name),
                durations:service_durations!service_durations_service_id_fkey(*)
            `)
            .eq('id', serviceId)
            .eq('durations.is_active', true)
            .order('duration_minutes', { foreignTable: 'durations', ascending: true })
            .single()

        if (serviceError) {
            console.error('获取服务信息失败:', serviceError)
            return { ok: false, error: "获取服务信息失败" }
        }

        return {
            ok: true,
            data: service as any
        }
    } catch (error) {
        console.error('获取服务详情异常:', error)
        return { ok: false, error: "获取服务详情异常" }
    }
}

// 获取技师绑定列表
export async function getServiceGirlBindList(
    serviceId: number,
    params: ServiceBindListParams
): Promise<ApiResponse<PaginatedResponse<ServiceGirlBindItem>>> {
    try {
        // 验证管理员权限
        await requireAdmin(['superadmin', 'admin'])

        // 验证参数
        const validatedParams = serviceBindListParamsSchema.parse(params)
        const { page, limit, search, city_id, category_id, bind_status, sort_by, sort_order } = validatedParams

        const supabase = getSupabaseAdminClient()

        // ✅ 优化：使用视图查询，预关联所有数据（150次查询 → 1次）
        let query = supabase
            .from('v_admin_service_girl_binding')
            .select('*', { count: 'exact' })

        // 搜索条件
        if (search) {
            const searchNum = parseInt(search)
            if (!isNaN(searchNum)) {
                query = query.or(`username.ilike.%${search}%,girl_number.eq.${searchNum},name.ilike.%${search}%`)
            } else {
                query = query.or(`username.ilike.%${search}%,name.ilike.%${search}%`)
            }
        }

        // 城市筛选
        if (city_id) {
            query = query.eq('city_id', city_id)
        }

        // 只查询未屏蔽的技师
        query = query.eq('is_blocked', false)

        // 排序
        query = query.order(sort_by, { ascending: sort_order === 'asc' })

        // 分页
        const from = (page - 1) * limit
        const to = from + limit - 1
        query = query.range(from, to)

        const { data: girls, error, count } = await query

        if (error) {
            console.error('获取技师列表失败:', error)
            return { ok: false, error: "获取技师列表失败" }
        }

        // ✅ 优化：视图已包含所有数据，直接处理即可
        const filteredGirls = (girls || []).map((girl: any) => {
            // 从 service_bindings 中找到当前服务的绑定信息
            const serviceBindings = girl.service_bindings || []
            const binding = serviceBindings.find((b: any) => b.service_id === serviceId)

            // 分类筛选
            if (category_id) {
                const categories = girl.categories || []
                const hasCategory = categories.some((cat: any) => cat.id === category_id)
                if (!hasCategory) {
                    return null
                }
            }

            // 绑定状态筛选
            if (bind_status !== 'all') {
                if (bind_status === 'unbound' && binding) {
                    return null
                }
                if (bind_status === 'bound-enabled' && (!binding || !binding.is_qualified)) {
                    return null
                }
                if (bind_status === 'bound-disabled' && (!binding || binding.is_qualified)) {
                    return null
                }
            }

            return {
                id: girl.id,
                girl_number: girl.girl_number,
                username: girl.username,
                name: girl.name,
                avatar_url: girl.avatar_url,
                city: girl.city,
                categories: girl.categories || [],
                binding: binding ? {
                    id: binding.id,
                    is_qualified: binding.is_qualified,
                    notes: binding.notes,
                    enabled_durations_count: binding.enabled_durations_count || 0
                } : null
            }
        }).filter(g => g !== null) as ServiceGirlBindItem[]

        const totalPages = Math.ceil((count || 0) / limit)

        return {
            ok: true,
            data: {
                data: filteredGirls,
                total: count || 0,
                page,
                limit,
                totalPages
            }
        }
    } catch (error) {
        console.error('获取技师绑定列表异常:', error)
        return { ok: false, error: "获取技师绑定列表异常" }
    }
}

// 批量绑定技师
export async function batchBindGirls(data: BatchBindData): Promise<ApiResponse> {
    try {
        // 检查权限
        // 验证管理员权限（只有管理员和超级管理员可以操作服务绑定）
        await requireAdmin(['superadmin', 'admin'])


        // 验证数据
        const validatedData = batchBindSchema.parse(data)
        const { girl_ids, service_id, admin_id } = validatedData

        const supabase = getSupabaseAdminClient()

        // 批量UPSERT绑定记录
        const bindRecords = girl_ids.map(girl_id => ({
            girl_id,
            service_id,
            admin_id,
            is_qualified: true,
            updated_at: new Date().toISOString()
        }))

        const { error } = await (supabase as any)
            .from('admin_girl_services')
            .upsert(bindRecords, {
                onConflict: 'girl_id,service_id',
                ignoreDuplicates: false
            })

        if (error) {
            console.error('批量绑定失败:', error)
            return { ok: false, error: "批量绑定失败" }
        }

        return { ok: true, message: `成功绑定 ${girl_ids.length} 位技师` }
    } catch (error) {
        console.error('批量绑定异常:', error)
        return { ok: false, error: "批量绑定异常" }
    }
}

// 批量解绑技师（软删除）
export async function batchUnbindGirls(data: BatchUnbindData): Promise<ApiResponse> {
    try {
        // 检查权限
        // 验证管理员权限（只有管理员和超级管理员可以操作服务绑定）
        await requireAdmin(['superadmin', 'admin'])


        // 验证数据
        const validatedData = batchUnbindSchema.parse(data)
        const { girl_ids, service_id, admin_id, notes, disable_durations } = validatedData

        const supabase = getSupabaseAdminClient()

        // 批量更新绑定记录为不合格
        const { error: updateError } = await (supabase as any)
            .from('admin_girl_services')
            .update({
                is_qualified: false,
                notes,
                updated_at: new Date().toISOString()
            })
            .eq('service_id', service_id)
            .in('girl_id', girl_ids)

        if (updateError) {
            console.error('批量解绑失败:', updateError)
            return { ok: false, error: "批量解绑失败" }
        }

        // 如果需要禁用时长
        if (disable_durations) {
            // 获取所有绑定记录ID
            const { data: bindings } = await supabase
                .from('admin_girl_services')
                .select('id')
                .eq('service_id', service_id)
                .in('girl_id', girl_ids)

            if (bindings && bindings.length > 0) {
                const bindingIds = bindings.map((b: any) => b.id)

                // 批量禁用时长
                const { error: durationsError } = await (supabase as any)
                    .from('girl_service_durations')
                    .update({
                        is_active: false,
                        updated_at: new Date().toISOString()
                    })
                    .in('admin_girl_service_id', bindingIds)

                if (durationsError) {
                    console.error('禁用时长失败:', durationsError)
                    // 不影响主流程
                }
            }
        }

        return { ok: true, message: `成功解绑 ${girl_ids.length} 位技师` }
    } catch (error) {
        console.error('批量解绑异常:', error)
        return { ok: false, error: "批量解绑异常" }
    }
}

// 批量恢复绑定
export async function batchRestoreGirls(data: BatchRestoreData): Promise<ApiResponse> {
    try {
        // 检查权限
        // 验证管理员权限（只有管理员和超级管理员可以操作服务绑定）
        await requireAdmin(['superadmin', 'admin'])


        // 验证数据
        const validatedData = batchRestoreSchema.parse(data)
        const { girl_ids, service_id, admin_id, notes } = validatedData

        const supabase = getSupabaseAdminClient()

        // 批量恢复绑定
        const updateData: any = {
            is_qualified: true,
            updated_at: new Date().toISOString()
        }

        if (notes) {
            updateData.notes = notes
        }

        const { error } = await (supabase as any)
            .from('admin_girl_services')
            .update(updateData)
            .eq('service_id', service_id)
            .in('girl_id', girl_ids)

        if (error) {
            console.error('批量恢复失败:', error)
            return { ok: false, error: "批量恢复失败" }
        }

        return { ok: true, message: `成功恢复 ${girl_ids.length} 位技师` }
    } catch (error) {
        console.error('批量恢复异常:', error)
        return { ok: false, error: "批量恢复异常" }
    }
}

// 单个技师绑定
export async function bindSingleGirl(girlId: string, serviceId: number, adminId: string): Promise<ApiResponse> {
    return batchBindGirls({
        girl_ids: [girlId],
        service_id: serviceId,
        admin_id: adminId
    })
}

// 单个技师解绑
export async function unbindSingleGirl(
    girlId: string,
    serviceId: number,
    adminId: string,
    notes: string,
    disableDurations?: boolean
): Promise<ApiResponse> {
    return batchUnbindGirls({
        girl_ids: [girlId],
        service_id: serviceId,
        admin_id: adminId,
        notes,
        disable_durations: disableDurations || false
    })
}

// 单个技师恢复
export async function restoreSingleGirl(
    girlId: string,
    serviceId: number,
    adminId: string,
    notes?: string
): Promise<ApiResponse> {
    return batchRestoreGirls({
        girl_ids: [girlId],
        service_id: serviceId,
        admin_id: adminId,
        notes
    })
}
