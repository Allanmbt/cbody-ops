"use server"

import { getSupabaseAdminClient } from "@/lib/supabase"
import {
    girlFormSchema,
    girlStatusSchema,
    girlMediaSchema,
    girlListParamsSchema,
    type GirlFormData,
    type GirlStatusData,
    type GirlMediaData,
    type GirlListParams
} from "@/lib/validations/girl"
import type {
    ApiResponse,
    PaginatedResponse,
    Girl,
    GirlWithStatus,
    GirlStatus,
    GirlMedia,
    GirlStatusType
} from "@/lib/types/girl"

// 检查管理员权限 - 简化版本，使用管理员客户端绕过 RLS
async function checkAdminPermission(): Promise<{ ok: boolean; error?: string; profile?: any }> {
    try {
        // 暂时跳过认证检查，直接允许操作（用于调试）
        console.log('检查管理员权限 - 调试模式：跳过认证检查')
        return { ok: true, profile: { role: 'superadmin', id: 'debug-admin' } }
    } catch (error) {
        console.error('权限检查失败:', error)
        return { ok: false, error: "权限验证失败，请重新登录" }
    }
}

// 获取城市列表
export async function getCities(): Promise<ApiResponse<any[]>> {
    try {
        const supabase = getSupabaseAdminClient()
        const { data, error } = await supabase
            .from('cities')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true })

        if (error) {
            console.error('获取城市失败:', error)
            return { ok: false, error: "获取城市列表失败" }
        }

        return { ok: true, data: data || [] }
    } catch (error) {
        console.error('获取城市异常:', error)
        return { ok: false, error: "获取城市列表异常" }
    }
}

// 获取分类列表
export async function getCategories(): Promise<ApiResponse<any[]>> {
    try {
        const supabase = getSupabaseAdminClient()
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true })

        if (error) {
            console.error('获取分类失败:', error)
            return { ok: false, error: "获取分类列表失败" }
        }

        return { ok: true, data: data || [] }
    } catch (error) {
        console.error('获取分类异常:', error)
        return { ok: false, error: "获取分类列表异常" }
    }
}

// 获取技师列表
export async function getGirls(params: GirlListParams): Promise<ApiResponse<PaginatedResponse<GirlWithStatus>>> {
    try {
        // 验证参数
        const validatedParams = girlListParamsSchema.parse(params)
        const { page, limit, search, city_id, category_id, status, is_verified, is_blocked, badge, sort_by, sort_order } = validatedParams

        const supabase = getSupabaseAdminClient()
        let query = (supabase as any)
            .from('girls')
            .select(`
        *,
        city:cities(id, name),
        category:categories(id, name),
        status:girls_status(status, current_lat, current_lng, next_available_time, updated_at)
      `, { count: 'exact' })

        // 搜索条件
        if (search) {
            query = query.or(`name.ilike.%${search}%,username.ilike.%${search}%,girl_number.eq.${parseInt(search) || 0}`)
        }

        // 城市筛选
        if (city_id) {
            query = query.eq('city_id', city_id)
        }

        // 分类筛选
        if (category_id) {
            query = query.eq('category_id', category_id)
        }

        // 认证状态筛选
        if (typeof is_verified === 'boolean') {
            query = query.eq('is_verified', is_verified)
        }

        // 屏蔽状态筛选
        if (typeof is_blocked === 'boolean') {
            query = query.eq('is_blocked', is_blocked)
        }

        // 徽章筛选
        if (badge) {
            query = query.eq('badge', badge)
        }

        // 排序
        query = query.order(sort_by, { ascending: sort_order === 'asc' })

        // 分页
        const from = (page - 1) * limit
        const to = from + limit - 1
        query = query.range(from, to)

        const { data, error, count } = await query

        if (error) {
            console.error('获取技师列表失败:', error)
            return { ok: false, error: "获取技师列表失败" }
        }

        const totalPages = Math.ceil((count || 0) / limit)

        return {
            ok: true,
            data: {
                data: data || [],
                total: count || 0,
                page,
                limit,
                totalPages
            }
        }
    } catch (error) {
        console.error('获取技师列表异常:', error)
        return { ok: false, error: "获取技师列表异常" }
    }
}

// 创建技师
export async function createGirl(formData: GirlFormData): Promise<ApiResponse<Girl>> {
    try {
        // 检查权限
        const permissionCheck = await checkAdminPermission()
        if (!permissionCheck.ok) {
            return { ok: false, error: permissionCheck.error }
        }

        // 验证表单数据
        const validatedData = girlFormSchema.parse(formData)

        const supabase = getSupabaseAdminClient()

        // 检查工号是否重复
        const { data: existingGirl } = await (supabase as any)
            .from('girls')
            .select('id')
            .eq('girl_number', validatedData.girl_number)
            .single()

        if (existingGirl) {
            return { ok: false, error: "工号已存在，请更换" }
        }

        // 检查用户名是否重复
        const { data: existingUsername } = await (supabase as any)
            .from('girls')
            .select('id')
            .eq('username', validatedData.username)
            .single()

        if (existingUsername) {
            return { ok: false, error: "用户名已存在，请更换" }
        }

        // 创建技师
        const { data, error } = await (supabase as any)
            .from('girls')
            .insert(validatedData)
            .select(`
        *,
        city:cities(id, name),
        category:categories(id, name)
      `)
            .single()

        if (error) {
            console.error('创建技师失败:', error)
            if (error.code === '23505') {
                return { ok: false, error: "工号或用户名已存在，请更换" }
            }
            return { ok: false, error: "创建技师失败" }
        }

        return { ok: true, data }
    } catch (error) {
        console.error('创建技师异常:', error)
        return { ok: false, error: "创建技师异常" }
    }
}

// 更新技师
export async function updateGirl(id: string, formData: GirlFormData): Promise<ApiResponse<Girl>> {
    try {
        // 检查权限
        const permissionCheck = await checkAdminPermission()
        if (!permissionCheck.ok) {
            return { ok: false, error: permissionCheck.error }
        }

        // 验证表单数据
        const validatedData = girlFormSchema.parse(formData)

        const supabase = getSupabaseAdminClient()

        // 检查工号是否与其他技师重复
        const { data: existingGirl } = await (supabase as any)
            .from('girls')
            .select('id')
            .eq('girl_number', validatedData.girl_number)
            .neq('id', id)
            .single()

        if (existingGirl) {
            return { ok: false, error: "工号已存在，请更换" }
        }

        // 检查用户名是否与其他技师重复
        const { data: existingUsername } = await (supabase as any)
            .from('girls')
            .select('id')
            .eq('username', validatedData.username)
            .neq('id', id)
            .single()

        if (existingUsername) {
            return { ok: false, error: "用户名已存在，请更换" }
        }

        // 更新技师
        const { data, error } = await (supabase as any)
            .from('girls')
            .update({ ...validatedData, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select(`
        *,
        city:cities(id, name),
        category:categories(id, name)
      `)
            .single()

        if (error) {
            console.error('更新技师失败:', error)
            if (error.code === '23505') {
                return { ok: false, error: "工号或用户名已存在，请更换" }
            }
            return { ok: false, error: "更新技师失败" }
        }

        return { ok: true, data }
    } catch (error) {
        console.error('更新技师异常:', error)
        return { ok: false, error: "更新技师异常" }
    }
}

// 切换技师屏蔽状态
export async function toggleGirlBlockedStatus(id: string): Promise<ApiResponse<Girl>> {
    try {
        // 检查权限
        const permissionCheck = await checkAdminPermission()
        if (!permissionCheck.ok) {
            return { ok: false, error: permissionCheck.error }
        }

        const supabase = getSupabaseAdminClient()

        // 获取当前状态
        const { data: currentGirl, error: fetchError } = await (supabase as any)
            .from('girls')
            .select('is_blocked')
            .eq('id', id)
            .single()

        if (fetchError) {
            console.error('获取技师状态失败:', fetchError)
            return { ok: false, error: "获取技师状态失败" }
        }

        // 切换状态
        const { data, error } = await (supabase as any)
            .from('girls')
            .update({
                is_blocked: !(currentGirl as any).is_blocked,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select(`
        *,
        city:cities(id, name),
        category:categories(id, name)
      `)
            .single()

        if (error) {
            console.error('切换技师状态失败:', error)
            return { ok: false, error: "切换技师状态失败" }
        }

        return { ok: true, data }
    } catch (error) {
        console.error('切换技师状态异常:', error)
        return { ok: false, error: "切换技师状态异常" }
    }
}

// 切换技师认证状态
export async function toggleGirlVerifiedStatus(id: string): Promise<ApiResponse<Girl>> {
    try {
        // 检查权限
        const permissionCheck = await checkAdminPermission()
        if (!permissionCheck.ok) {
            return { ok: false, error: permissionCheck.error }
        }

        const supabase = getSupabaseAdminClient()

        // 获取当前状态
        const { data: currentGirl, error: fetchError } = await (supabase as any)
            .from('girls')
            .select('is_verified')
            .eq('id', id)
            .single()

        if (fetchError) {
            console.error('获取技师认证状态失败:', fetchError)
            return { ok: false, error: "获取技师认证状态失败" }
        }

        // 切换状态
        const { data, error } = await (supabase as any)
            .from('girls')
            .update({
                is_verified: !(currentGirl as any).is_verified,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select(`
        *,
        city:cities(id, name),
        category:categories(id, name)
      `)
            .single()

        if (error) {
            console.error('切换技师认证状态失败:', error)
            return { ok: false, error: "切换技师认证状态失败" }
        }

        return { ok: true, data }
    } catch (error) {
        console.error('切换技师认证状态异常:', error)
        return { ok: false, error: "切换技师认证状态异常" }
    }
}

// 获取技师状态
export async function getGirlStatus(girlId: string): Promise<ApiResponse<GirlStatus>> {
    try {
        const supabase = getSupabaseAdminClient()
        const { data, error } = await (supabase as any)
            .from('girls_status')
            .select('*')
            .eq('girl_id', girlId)
            .single()

        if (error) {
            console.error('获取技师状态失败:', error)
            return { ok: false, error: "获取技师状态失败" }
        }

        return { ok: true, data }
    } catch (error) {
        console.error('获取技师状态异常:', error)
        return { ok: false, error: "获取技师状态异常" }
    }
}

// 更新技师状态
export async function updateGirlStatus(girlId: string, statusData: GirlStatusData): Promise<ApiResponse<GirlStatus>> {
    try {
        // 检查权限
        const permissionCheck = await checkAdminPermission()
        if (!permissionCheck.ok) {
            return { ok: false, error: permissionCheck.error }
        }

        // 验证数据
        const validatedData = girlStatusSchema.parse(statusData)

        const supabase = getSupabaseAdminClient()

        // 尝试更新，如果不存在则创建
        const { data, error } = await (supabase as any)
            .from('girls_status')
            .upsert({
                girl_id: girlId,
                ...validatedData,
                updated_at: new Date().toISOString()
            })
            .select('*')
            .single()

        if (error) {
            console.error('更新技师状态失败:', error)
            return { ok: false, error: "更新技师状态失败" }
        }

        return { ok: true, data }
    } catch (error) {
        console.error('更新技师状态异常:', error)
        return { ok: false, error: "更新技师状态异常" }
    }
}

// 获取技师媒体
export async function getGirlMedia(girlId: string): Promise<ApiResponse<GirlMedia[]>> {
    try {
        const supabase = getSupabaseAdminClient()
        const { data, error } = await (supabase as any)
            .from('girls_media')
            .select('*')
            .eq('girl_id', girlId)
            .order('sort_order', { ascending: true })

        if (error) {
            console.error('获取技师媒体失败:', error)
            return { ok: false, error: "获取技师媒体失败" }
        }

        return { ok: true, data: data || [] }
    } catch (error) {
        console.error('获取技师媒体异常:', error)
        return { ok: false, error: "获取技师媒体异常" }
    }
}

// 添加技师媒体
export async function addGirlMedia(girlId: string, mediaData: GirlMediaData): Promise<ApiResponse<GirlMedia>> {
    try {
        // 检查权限
        const permissionCheck = await checkAdminPermission()
        if (!permissionCheck.ok) {
            return { ok: false, error: permissionCheck.error }
        }

        // 验证数据
        const validatedData = girlMediaSchema.parse(mediaData)

        const supabase = getSupabaseAdminClient()

        // 添加媒体
        const { data, error } = await (supabase as any)
            .from('girls_media')
            .insert({
                girl_id: girlId,
                ...validatedData
            })
            .select('*')
            .single()

        if (error) {
            console.error('添加技师媒体失败:', error)
            return { ok: false, error: "添加技师媒体失败" }
        }

        return { ok: true, data }
    } catch (error) {
        console.error('添加技师媒体异常:', error)
        return { ok: false, error: "添加技师媒体异常" }
    }
}

// 删除技师媒体
export async function deleteGirlMedia(mediaId: string): Promise<ApiResponse> {
    try {
        // 检查权限
        const permissionCheck = await checkAdminPermission()
        if (!permissionCheck.ok) {
            return { ok: false, error: permissionCheck.error }
        }

        const supabase = getSupabaseAdminClient()

        // 删除媒体
        const { error } = await (supabase as any)
            .from('girls_media')
            .delete()
            .eq('id', mediaId)

        if (error) {
            console.error('删除技师媒体失败:', error)
            return { ok: false, error: "删除技师媒体失败" }
        }

        return { ok: true }
    } catch (error) {
        console.error('删除技师媒体异常:', error)
        return { ok: false, error: "删除技师媒体异常" }
    }
}
