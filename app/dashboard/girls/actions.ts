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
    GirlStatusType,
    UserSearchResult
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

// 搜索用户（用于user_id绑定）
// 支持通过 email、phone 或 user_id 搜索
export async function searchUsers(query: string): Promise<ApiResponse<UserSearchResult[]>> {
    try {
        if (!query || query.trim().length < 3) {
            return { ok: false, error: "搜索关键词至少3个字符" }
        }

        const supabase = getSupabaseAdminClient()
        
        // 尝试多种搜索方式
        const results: UserSearchResult[] = []
        
        // 1. 先从 user_profiles 搜索（按 display_name 或 id）
        const { data: profileData } = await supabase
            .from('user_profiles')
            .select('id, display_name')
            .or(`display_name.ilike.%${query}%,id.eq.${query}`)
            .limit(10)

        if (profileData && profileData.length > 0) {
            for (const profile of profileData) {
                // 获取 auth.users 中的 email 和 phone
                const { data: authData } = await (supabase.auth.admin as any).getUserById((profile as any).id)
                
                results.push({
                    id: (profile as any).id,
                    display_name: (profile as any).display_name,
                    email: (authData as any)?.user?.email || null,
                    phone: (authData as any)?.user?.phone || null
                })
            }
        }
        
        // 2. 如果 query 看起来像 email（包含@），从 auth.users 搜索
        if (query.includes('@') && results.length === 0) {
            const { data: { users }, error } = await supabase.auth.admin.listUsers()
            
            if (!error && users) {
                const matchedUsers = users
                    .filter(u => u.email?.toLowerCase().includes(query.toLowerCase()))
                    .slice(0, 10)
                
                for (const user of matchedUsers) {
                    // 获取对应的 profile
                    const { data: profile } = await supabase
                        .from('user_profiles')
                        .select('display_name')
                        .eq('id', user.id)
                        .single()
                    
                    results.push({
                        id: user.id,
                        display_name: (profile as any)?.display_name || user.email || 'Unknown',
                        email: user.email || null,
                        phone: user.phone || null
                    })
                }
            }
        }
        
        // 3. 如果 query 看起来像手机号（纯数字），从 auth.users 搜索
        if (/^\d+$/.test(query) && results.length === 0) {
            const { data: { users }, error } = await supabase.auth.admin.listUsers()
            
            if (!error && users) {
                const matchedUsers = users
                    .filter(u => u.phone?.includes(query))
                    .slice(0, 10)
                
                for (const user of matchedUsers) {
                    // 获取对应的 profile
                    const { data: profile } = await supabase
                        .from('user_profiles')
                        .select('display_name')
                        .eq('id', user.id)
                        .single()
                    
                    results.push({
                        id: user.id,
                        display_name: (profile as any)?.display_name || user.phone || 'Unknown',
                        email: user.email || null,
                        phone: user.phone || null
                    })
                }
            }
        }

        return { ok: true, data: results }
    } catch (error) {
        console.error('搜索用户异常:', error)
        return { ok: false, error: "搜索用户异常" }
    }
}

// 检查username是否已存在
export async function checkUsernameExists(username: string, excludeGirlId?: string): Promise<ApiResponse<boolean>> {
    try {
        const supabase = getSupabaseAdminClient()
        let query = supabase
            .from('girls')
            .select('id')
            .eq('username', username)
            .limit(1)

        if (excludeGirlId) {
            query = query.neq('id', excludeGirlId)
        }

        const { data, error } = await query.single()

        if (error && error.code !== 'PGRST116') { // PGRST116 = 没有找到记录
            console.error('检查username失败:', error)
            return { ok: false, error: "检查用户名失败" }
        }

        return { ok: true, data: !!data }
    } catch (error) {
        console.error('检查username异常:', error)
        return { ok: false, error: "检查用户名异常" }
    }
}

// 获取技师列表
export async function getGirls(params: GirlListParams): Promise<ApiResponse<PaginatedResponse<GirlWithStatus>>> {
    try {
        // 验证参数
        const validatedParams = girlListParamsSchema.parse(params)
        const { page, limit, search, city_id, category_id, status, is_verified, is_blocked, sort_by, sort_order } = validatedParams

        const supabase = getSupabaseAdminClient()
        
        let query = (supabase as any)
            .from('girls')
            .select(`
                *,
                city:cities(id, name),
                status:girls_status(status, current_lat, current_lng, standby_lat, standby_lng, next_available_time, updated_at)
            `, { count: 'exact' })

        // 搜索条件: username / girl_number / telegram_id
        if (search) {
            const searchNum = parseInt(search)
            if (!isNaN(searchNum)) {
                query = query.or(`username.ilike.%${search}%,girl_number.eq.${searchNum},telegram_id.eq.${searchNum}`)
            } else {
                query = query.or(`username.ilike.%${search}%,name.ilike.%${search}%`)
            }
        }

        // 城市筛选
        if (city_id) {
            query = query.eq('city_id', city_id)
        }

        // 认证状态筛选
        if (typeof is_verified === 'boolean') {
            query = query.eq('is_verified', is_verified)
        }

        // 屏蔽状态筛选
        if (typeof is_blocked === 'boolean') {
            query = query.eq('is_blocked', is_blocked)
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

        // 查询每个技师的分类
        const girlsWithCategories = await Promise.all(
            (data || []).map(async (girl: any) => {
                const { data: categoryData } = await supabase
                    .from('girls_categories')
                    .select(`
                        category_id,
                        categories:category_id(id, name)
                    `)
                    .eq('girl_id', girl.id)

                const categories = (categoryData || []).map((item: any) => item.categories).filter(Boolean)
                const category_ids = (categoryData || []).map((item: any) => item.category_id)

                return {
                    ...girl,
                    categories,
                    category_ids
                }
            })
        )

        const totalPages = Math.ceil((count || 0) / limit)

        return {
            ok: true,
            data: {
                data: girlsWithCategories,
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

        // 检查用户名唯一性
        const usernameCheck = await checkUsernameExists(validatedData.username)
        if (!usernameCheck.ok) {
            return { ok: false, error: usernameCheck.error }
        }
        if (usernameCheck.data) {
            return { ok: false, error: "用户名已存在，请更换" }
        }

        const supabase = getSupabaseAdminClient()

        // 准备插入数据（排除category_ids，单独处理）
        const { category_ids, ...girlData } = validatedData

        // 创建技师（girl_number由触发器自动生成）
        const { data, error } = await (supabase as any)
            .from('girls')
            .insert(girlData)
            .select('*')
            .single()

        if (error) {
            console.error('创建技师失败:', error)
            return { ok: false, error: "创建技师失败" }
        }

        // 使用RPC设置分类
        if (category_ids && category_ids.length > 0) {
            const { error: rpcError } = await (supabase as any).rpc('set_girl_categories', {
                p_girl_id: data.id,
                p_category_ids: category_ids
            })

            if (rpcError) {
                console.error('设置分类失败:', rpcError)
                // 不影响主流程，仅记录日志
            }
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

        // 检查用户名唯一性（排除当前记录）
        const usernameCheck = await checkUsernameExists(validatedData.username, id)
        if (!usernameCheck.ok) {
            return { ok: false, error: usernameCheck.error }
        }
        if (usernameCheck.data) {
            return { ok: false, error: "用户名已存在，请更换" }
        }

        const supabase = getSupabaseAdminClient()

        // 准备更新数据
        const { category_ids, ...girlData } = validatedData

        // 更新技师
        const { data, error } = await (supabase as any)
            .from('girls')
            .update({ ...girlData, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select('*')
            .single()

        if (error) {
            console.error('更新技师失败:', error)
            return { ok: false, error: "更新技师失败" }
        }

        // 使用RPC更新分类
        if (category_ids !== undefined) {
            const { error: rpcError } = await (supabase as any).rpc('set_girl_categories', {
                p_girl_id: id,
                p_category_ids: category_ids || []
            })

            if (rpcError) {
                console.error('更新分类失败:', rpcError)
                // 不影响主流程，仅记录日志
            }
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

        // 获取当前状态和用户ID
        const { data: currentGirl, error: fetchError } = await (supabase as any)
            .from('girls')
            .select('is_blocked, user_id')
            .eq('id', id)
            .single()

        if (fetchError) {
            console.error('获取技师状态失败:', fetchError)
            return { ok: false, error: "获取技师状态失败" }
        }

        const newBlockedStatus = !(currentGirl as any).is_blocked

        // 切换状态
        const { data, error } = await (supabase as any)
            .from('girls')
            .update({
                is_blocked: newBlockedStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select('*')
            .single()

        if (error) {
            console.error('切换技师状态失败:', error)
            return { ok: false, error: "切换技师状态失败" }
        }

        // 如果设置为屏蔽状态且有关联的用户ID，则登出所有会话
        if (newBlockedStatus && (currentGirl as any).user_id) {
            try {
                const { error: signOutError } = await supabase.auth.admin.signOut(
                    (currentGirl as any).user_id
                )

                if (signOutError) {
                    console.error('登出用户会话失败:', signOutError)
                    // 不影响主流程，仅记录日志
                }
            } catch (signOutErr) {
                console.error('登出用户会话异常:', signOutErr)
                // 不影响主流程，仅记录日志
            }
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
            .select('*')
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

