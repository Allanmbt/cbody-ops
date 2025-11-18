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

        // 获取服务基本信息
        const { data: service, error: serviceError } = await supabase
            .from('services')
            .select(`
                *,
                category:categories(id, code, name)
            `)
            .eq('id', serviceId)
            .single()

        if (serviceError) {
            console.error('获取服务信息失败:', serviceError)
            return { ok: false, error: "获取服务信息失败" }
        }

        // 获取服务时长列表
        const { data: durations, error: durationsError } = await supabase
            .from('service_durations')
            .select('*')
            .eq('service_id', serviceId)
            .eq('is_active', true)
            .order('duration_minutes', { ascending: true })

        if (durationsError) {
            console.error('获取时长信息失败:', durationsError)
        }

        return {
            ok: true,
            data: {
                ...(service as any),
                durations: durations || []
            }
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

        // 构建基础查询
        let query = supabase
            .from('girls')
            .select(`
                id,
                girl_number,
                username,
                name,
                avatar_url,
                city:cities(id, name)
            `, { count: 'exact' })

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

        // 获取每个技师的分类和绑定信息
        const girlsWithBinding = await Promise.all(
            (girls || []).map(async (girl: any) => {
                // 获取分类
                const { data: categoryData } = await supabase
                    .from('girls_categories')
                    .select(`
                        category_id,
                        categories:category_id(id, name)
                    `)
                    .eq('girl_id', girl.id)

                const categories = (categoryData || [])
                    .map((item: any) => item.categories)
                    .filter(Boolean)

                // 如果有分类筛选，检查是否匹配
                if (category_id) {
                    const hasCategory = (categoryData || []).some(
                        (item: any) => item.category_id === category_id
                    )
                    if (!hasCategory) {
                        return null // 不匹配，跳过
                    }
                }

                // 获取绑定信息
                const { data: binding } = await supabase
                    .from('admin_girl_services')
                    .select('id, is_qualified, notes')
                    .eq('girl_id', girl.id)
                    .eq('service_id', serviceId)
                    .single()

                let bindingInfo = null
                if (binding) {
                    // 统计已启用的时长数量
                    const { count: durationsCount } = await supabase
                        .from('girl_service_durations')
                        .select('id', { count: 'exact', head: true })
                        .eq('admin_girl_service_id', (binding as any).id)
                        .eq('is_active', true)

                    bindingInfo = {
                        id: (binding as any).id,
                        is_qualified: (binding as any).is_qualified,
                        notes: (binding as any).notes,
                        enabled_durations_count: durationsCount || 0
                    }
                }

                // 根据绑定状态筛选
                if (bind_status !== 'all') {
                    if (bind_status === 'unbound' && bindingInfo) {
                        return null
                    }
                    if (bind_status === 'bound-enabled' && (!bindingInfo || !bindingInfo.is_qualified)) {
                        return null
                    }
                    if (bind_status === 'bound-disabled' && (!bindingInfo || bindingInfo.is_qualified)) {
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
                    categories,
                    binding: bindingInfo
                }
            })
        )

        // 过滤掉null项（不匹配筛选条件的）
        const filteredGirls = girlsWithBinding.filter(g => g !== null) as ServiceGirlBindItem[]

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
