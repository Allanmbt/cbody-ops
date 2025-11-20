"use server"

import { getSupabaseAdminClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/auth"
import {
    girlFormSchema,
    girlStatusSchema,
    girlMediaSchema,
    girlListParamsSchema,
    type GirlFormData,
    type GirlStatusData,
    type GirlMediaData,
    type GirlListParams
} from "@/lib/features/girls"
import type {
    ApiResponse,
    PaginatedResponse,
    Girl,
    GirlWithStatus,
    GirlStatus,
    GirlMedia,
    GirlStatusType,
    UserSearchResult
} from "@/lib/features/girls"

// 注意：所有函数现在使用 requireAdmin() 进行统一的权限验证
// 不再需要单独的 checkAdminPermission 函数

/**
 * 技师管理统计数据
 */
export interface AdminGirlStats {
    total: number      // 总技师数
    verified: number   // 已认证
    pending: number    // 待审核
    online: number     // 在线技师
}

/**
 * 获取技师管理统计
 */
export async function getAdminGirlStats(): Promise<ApiResponse<AdminGirlStats>> {
    try {
        await requireAdmin(['superadmin', 'admin', 'support'])
        const supabase = getSupabaseAdminClient()

        // ✅ 优化：使用 RPC 函数一次性获取所有统计
        const { data: rpcData, error: rpcError } = await (supabase as any).rpc('get_admin_girl_stats')

        if (!rpcError && rpcData) {
            return {
                ok: true as const,
                data: rpcData as AdminGirlStats
            }
        }

        // 回退方案：如果 RPC 不可用
        console.warn('[技师统计] RPC 不可用，使用回退方案')

        const { count: totalCount } = await supabase
            .from('girls')
            .select('*', { count: 'exact', head: true })
            .is('deleted_at', null)

        const { count: verifiedCount } = await supabase
            .from('girls')
            .select('*', { count: 'exact', head: true })
            .eq('is_verified', true)
            .is('deleted_at', null)

        const { count: pendingCount } = await supabase
            .from('girls')
            .select('*', { count: 'exact', head: true })
            .eq('is_blocked', true)
            .is('deleted_at', null)

        const { count: onlineCount } = await supabase
            .from('girls_status')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'available')

        return {
            ok: true as const,
            data: {
                total: totalCount || 0,
                verified: verifiedCount || 0,
                pending: pendingCount || 0,
                online: onlineCount || 0
            } as AdminGirlStats
        }
    } catch (error) {
        console.error('[技师统计] 获取失败:', error)
        return { ok: false as const, error: "获取技师统计失败" }
    }
}

// 获取城市列表
export async function getCities(): Promise<ApiResponse<any[]>> {
    try {
        // 验证管理员权限（客服也可以查看）
        await requireAdmin(['superadmin', 'admin', 'support'])
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
        // 验证管理员权限（客服也可以查看）
        await requireAdmin(['superadmin', 'admin', 'support'])
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
        // 验证管理员权限（只有管理员和超级管理员可以搜索用户）
        await requireAdmin(['superadmin', 'admin'])

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
        // 验证管理员权限
        await requireAdmin(['superadmin', 'admin'])
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

// 获取技师资料列表（轻量版，仅 girls + city + 分类）
// 用于后台资料管理，不关联实时 girls_status
export async function getGirlsProfileList(params: GirlListParams): Promise<ApiResponse<PaginatedResponse<GirlWithStatus>>> {
    try {
        await requireAdmin(['superadmin', 'admin', 'support'])

        const validatedParams = girlListParamsSchema.parse(params)
        const { page, limit, search, city_id, category_id, is_blocked, review_status, sort_by, sort_order } = validatedParams

        const supabase = getSupabaseAdminClient()

        let baseQuery = (supabase as any)
            .from('girls')
            .select(`
	                *,
	                city:cities(id, name)
	            `, { count: 'exact' })

        // 搜索: username / girl_number / telegram_id / name
        if (search) {
            const searchNum = parseInt(search)
            if (!isNaN(searchNum)) {
                baseQuery = baseQuery.or(`username.ilike.%${search}%,girl_number.eq.${searchNum},telegram_id.eq.${searchNum}`)
            } else {
                baseQuery = baseQuery.or(`username.ilike.%${search}%,name.ilike.%${search}%`)
            }
        }

        // 城市筛选
        if (city_id) {
            baseQuery = baseQuery.eq('city_id', city_id)
        }

        // 审核状态筛选（优先级高于单纯的 is_blocked 筛选）
        if (review_status === 'pending') {
            // 未审核：通常为被屏蔽且未删除
            baseQuery = baseQuery.eq('is_blocked', true).is('deleted_at', null)
        } else if (review_status === 'approved') {
            // 已通过：未屏蔽且未删除
            baseQuery = baseQuery.eq('is_blocked', false).is('deleted_at', null)
        } else if (review_status === 'deleted') {
            // 已注销：有 deleted_at 记录
            baseQuery = baseQuery.not('deleted_at', 'is', null)
        } else if (typeof is_blocked === 'boolean') {
            // 只有在未指定 review_status 时才按 is_blocked 筛选
            baseQuery = baseQuery.eq('is_blocked', is_blocked)
        }

        // 如果按分类筛选，先查出符合分类的 girl_id 列表，再用 IN 过滤
        if (category_id) {
            const { data: categoryRows, error: catError } = await (supabase as any)
                .from('girls_categories')
                .select('girl_id')
                .eq('category_id', category_id)

            if (catError) {
                console.error('按分类筛选技师失败:', catError)
                return { ok: false, error: '按分类筛选技师失败' }
            }

            const girlIds = (categoryRows || []).map((row: any) => row.girl_id)
            if (girlIds.length === 0) {
                return {
                    ok: true,
                    data: { data: [], total: 0, page, limit, totalPages: 0 }
                }
            }

            baseQuery = baseQuery.in('id', girlIds)
        }

        // 排序（默认使用 sort_order，其它字段按 schema 控制）
        const orderField = sort_by || 'sort_order'
        const from = (page - 1) * limit
        const to = from + limit - 1

        const { data, error, count } = await baseQuery
            .order(orderField, { ascending: sort_order === 'asc' })
            .range(from, to)

        if (error) {
            console.error('获取技师资料列表失败:', error)
            return { ok: false, error: '获取技师资料列表失败' }
        }

        const girlsData = (data || []) as GirlWithStatus[]
        const girlIds = girlsData.map(g => g.id)

        // 批量查询分类信息（最多一条额外查询，避免 N+1）
        let girlsWithCategories: GirlWithStatus[] = girlsData
        if (girlIds.length > 0) {
            const { data: catRows, error: catError } = await (supabase as any)
                .from('girls_categories')
                .select(`
	                    girl_id,
	                    category_id,
	                    categories:category_id(id, name)
	                `)
                .in('girl_id', girlIds)

            if (catError) {
                console.error('获取技师分类失败:', catError)
                // 不中断主流程，只返回无分类信息的数据
            } else {
                const map = new Map<string, { category_ids: number[]; categories: any[] }>()
                for (const row of catRows || []) {
                    const girlId = (row as any).girl_id as string
                    const entry = map.get(girlId) || { category_ids: [], categories: [] }
                    entry.category_ids.push((row as any).category_id)
                    if ((row as any).categories) {
                        entry.categories.push((row as any).categories)
                    }
                    map.set(girlId, entry)
                }

                girlsWithCategories = girlsData.map(girl => {
                    const extra = map.get(girl.id)
                    if (!extra) return girl
                    return {
                        ...girl,
                        category_ids: extra.category_ids,
                        categories: extra.categories,
                    }
                })
            }
        }

        const total = count || 0
        const totalPages = Math.ceil(total / limit)

        return {
            ok: true,
            data: {
                data: girlsWithCategories,
                total,
                page,
                limit,
                totalPages,
            },
        }
    } catch (error) {
        console.error('获取技师资料列表异常:', error)
        return { ok: false, error: '获取技师资料列表异常' }
    }
}

// 获取技师列表（完整业务版，包含 girls_status 等信息）
export async function getGirls(params: GirlListParams): Promise<ApiResponse<PaginatedResponse<GirlWithStatus>>> {
    try {
        // 验证管理员权限（客服也可以查看）
        await requireAdmin(['superadmin', 'admin', 'support'])

        // 验证参数
        const validatedParams = girlListParamsSchema.parse(params)
        const { page, limit, search, city_id, category_id, status, is_verified, is_blocked, sort_by, sort_order } = validatedParams

        const supabase = getSupabaseAdminClient()

        let query = (supabase as any)
            .from('girls')
            .select(`
                *,
                city:cities(id, name),
                status:girls_status(status, current_lat, current_lng, next_available_time, last_online_at, updated_at)
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
        // 验证管理员权限（只有管理员和超级管理员可以创建技师）
        await requireAdmin(['superadmin', 'admin'])

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
        // 验证管理员权限（只有管理员和超级管理员可以更新技师）
        await requireAdmin(['superadmin', 'admin'])


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
        // 验证管理员权限（只有管理员和超级管理员可以屏蔽/解封技师）
        await requireAdmin(['superadmin', 'admin'])


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
        // 验证管理员权限（只有管理员和超级管理员可以验证技师）
        await requireAdmin(['superadmin', 'admin'])


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
        // 验证管理员权限（客服也可以查看）
        await requireAdmin(['superadmin', 'admin', 'support'])
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
        // 验证管理员权限（只有管理员和超级管理员可以更新技师状态）
        await requireAdmin(['superadmin', 'admin'])


        // 验证数据
        const validatedData = girlStatusSchema.parse(statusData)

        const supabase = getSupabaseAdminClient()

        // 先检查技师是否存在
        const { data: girlExists, error: girlCheckError } = await (supabase as any)
            .from('girls')
            .select('id')
            .eq('id', girlId)
            .single()

        if (girlCheckError || !girlExists) {
            console.error('技师不存在:', girlCheckError)
            return { ok: false, error: "技师不存在" }
        }

        // 检查是否已有状态记录
        const { data: existingStatus } = await (supabase as any)
            .from('girls_status')
            .select('id')
            .eq('girl_id', girlId)
            .maybeSingle()

        let result
        if (existingStatus) {
            // 更新现有记录
            result = await (supabase as any)
                .from('girls_status')
                .update({
                    ...validatedData,
                    updated_at: new Date().toISOString()
                })
                .eq('girl_id', girlId)
                .select('*')
                .single()
        } else {
            // 创建新记录
            result = await (supabase as any)
                .from('girls_status')
                .insert({
                    girl_id: girlId,
                    ...validatedData,
                    updated_at: new Date().toISOString()
                })
                .select('*')
                .single()
        }

        const { data, error } = result

        if (error) {
            console.error('更新技师状态失败:', error)
            console.error('错误详情:', JSON.stringify(error, null, 2))
            return { ok: false, error: `更新失败: ${error.message || '未知错误'}` }
        }

        return { ok: true, data }
    } catch (error: any) {
        console.error('更新技师状态异常:', error)
        return { ok: false, error: `操作异常: ${error?.message || '未知错误'}` }
    }
}

// 获取技师媒体
export async function getGirlMedia(girlId: string): Promise<ApiResponse<GirlMedia[]>> {
    try {
        // 验证管理员权限（客服也可以查看）
        await requireAdmin(['superadmin', 'admin', 'support'])
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
        // 验证管理员权限（只有管理员和超级管理员可以添加技师媒体）
        await requireAdmin(['superadmin', 'admin'])


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
        // 验证管理员权限（只有管理员和超级管理员可以删除技师媒体）
        await requireAdmin(['superadmin', 'admin'])


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

