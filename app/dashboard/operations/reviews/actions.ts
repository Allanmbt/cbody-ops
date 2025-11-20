"use server"

import { getSupabaseAdminClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/auth"

export type ReviewStatus = "pending" | "approved" | "rejected"

/**
 * 评论统计数据
 */
export interface ReviewStats {
    pending: number    // 待审核
    today_new: number  // 今日新增
    approved: number   // 已通过
    rejected: number   // 已驳回
}

export interface ReviewListFilters {
    status?: ReviewStatus | "all"
    page?: number
    limit?: number
}

export interface ReviewListItem {
    id: string
    order_id: string
    user_id: string
    girl_id: string
    service_id: number
    rating_service: number
    rating_attitude: number
    rating_emotion: number
    rating_similarity: number
    rating_overall: number
    comment_text: string | null
    min_user_level: number
    status: ReviewStatus
    reviewed_by: string | null
    reviewed_at: string | null
    reject_reason: string | null
    created_at: string
    updated_at: string
    order?: {
        id: string
        order_number: string
    } | null
    user_profile?: {
        user_id: string
        display_name: string | null
        avatar_url: string | null
    } | null
    girl?: {
        id: string
        girl_number: number
        name: string
        avatar_url: string | null
    } | null
}

export interface ReviewListResult {
    reviews: ReviewListItem[]
    total: number
    page: number
    limit: number
    totalPages: number
}

/**
 * 获取评论统计
 */
export async function getReviewStats() {
    try {
        await requireAdmin(["superadmin", "admin", "support"])
        const supabase = getSupabaseAdminClient()

        // ✅ 优化：使用 RPC 函数一次性获取所有统计（4次查询 → 1次）
        const { data: rpcData, error: rpcError } = await (supabase as any).rpc('get_review_stats')

        if (!rpcError && rpcData) {
            return {
                ok: true as const,
                data: rpcData as ReviewStats
            }
        }

        // 回退方案：如果 RPC 不可用
        console.warn('[评论统计] RPC 不可用，使用回退方案')
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)

        const { count: pendingCount } = await supabase
            .from('order_reviews')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending')

        const { count: todayNewCount } = await supabase
            .from('order_reviews')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', todayStart.toISOString())

        const { count: approvedCount } = await supabase
            .from('order_reviews')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'approved')

        const { count: rejectedCount } = await supabase
            .from('order_reviews')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'rejected')

        return {
            ok: true as const,
            data: {
                pending: pendingCount || 0,
                today_new: todayNewCount || 0,
                approved: approvedCount || 0,
                rejected: rejectedCount || 0
            } as ReviewStats
        }
    } catch (error) {
        console.error('[评论统计] 获取失败:', error)
        return { ok: false as const, error: "获取评论统计失败" }
    }
}

export async function getReviews(filters: ReviewListFilters = {}) {
    try {
        await requireAdmin(["superadmin", "admin", "support"])
        const supabase = getSupabaseAdminClient()

        const {
            status = "pending",
            page = 1,
            limit = 50,
        } = filters

        // ✅ 优化：使用视图查询，预关联订单、用户、技师信息（4次查询 → 1次）
        let query = supabase
            .from("v_review_monitoring")
            .select("*", { count: "exact" })

        // 状态筛选
        if (status && status !== "all") {
            query = query.eq("status", status)
        }

        // 排序：待审核优先，然后按创建时间倒序
        query = query.order("created_at", { ascending: false })

        // 分页
        const from = (page - 1) * limit
        const to = from + limit - 1
        query = query.range(from, to)

        const { data, error, count } = await query

        if (error) {
            console.error("[评论审核] 查询失败:", error)
            return { ok: false as const, error: `查询评论失败: ${error.message}` }
        }

        const reviews = (data || []) as any[]

        if (reviews.length === 0) {
            return {
                ok: true as const,
                data: {
                    reviews: [],
                    total: 0,
                    page,
                    limit,
                    totalPages: 0,
                } satisfies ReviewListResult,
            }
        }

        // ✅ 优化：视图已包含所有关联数据，直接格式化即可
        const resultReviews: ReviewListItem[] = reviews.map((r: any) => ({
            id: r.id,
            order_id: r.order_id,
            user_id: r.user_id,
            girl_id: r.girl_id,
            service_id: r.service_id,
            rating_service: r.rating_service,
            rating_attitude: r.rating_attitude,
            rating_emotion: r.rating_emotion,
            rating_similarity: r.rating_similarity,
            rating_overall: r.rating_overall,
            comment_text: r.comment_text,
            min_user_level: r.min_user_level,
            status: r.status,
            reviewed_by: r.reviewed_by,
            reviewed_at: r.reviewed_at,
            reject_reason: r.reject_reason,
            created_at: r.created_at,
            updated_at: r.updated_at,
            order: r.order_info,
            user_profile: r.user_profile,
            girl: r.girl_info
        }))

        const total = count || resultReviews.length
        const totalPages = Math.ceil(total / limit)

        return {
            ok: true as const,
            data: {
                reviews: resultReviews,
                total,
                page,
                limit,
                totalPages,
            } satisfies ReviewListResult,
        }
    } catch (error) {
        console.error("[评论审核] 查询异常:", error)
        return {
            ok: false as const,
            error: error instanceof Error ? error.message : "查询评论异常",
        }
    }
}

export async function approveReview(id: string) {
    try {
        const admin = await requireAdmin(["superadmin", "admin", "support"])
        const supabase = getSupabaseAdminClient() as any

        // 1. 检查当前状态（防止重复审核）
        const { data: review, error: fetchError } = await supabase
            .from("order_reviews")
            .select("status")
            .eq("id", id)
            .single()

        if (fetchError) {
            console.error("[评论审核] 查询失败:", fetchError)
            return { ok: false as const, error: "评论不存在或已删除" }
        }

        // 2. 状态锁定检查
        if (review.status === "approved") {
            return { ok: false as const, error: "该评论已通过审核，无需重复操作" }
        }
        if (review.status === "rejected") {
            return { ok: false as const, error: "已驳回的评论不可再通过审核" }
        }

        // 3. 执行审核（触发器会自动更新技师评分）
        const { error } = await (supabase as any)
            .from("order_reviews")
            .update({
                status: "approved",
                reviewed_by: admin.id,
                reviewed_at: new Date().toISOString(),
                reject_reason: null,
            })
            .eq("id", id)

        if (error) {
            console.error("[评论审核] 通过失败:", error)
            return { ok: false as const, error: `审核通过失败: ${error.message}` }
        }

        return { ok: true as const }
    } catch (error) {
        console.error("[评论审核] 通过异常:", error)
        return {
            ok: false as const,
            error: error instanceof Error ? error.message : "审核通过异常",
        }
    }
}

export async function rejectReview(id: string, rejectReason: string) {
    try {
        const admin = await requireAdmin(["superadmin", "admin", "support"])
        const supabase = getSupabaseAdminClient() as any

        if (!rejectReason.trim()) {
            return { ok: false as const, error: "请填写驳回原因" }
        }

        // 1. 检查当前状态（防止重复审核）
        const { data: review, error: fetchError } = await supabase
            .from("order_reviews")
            .select("status")
            .eq("id", id)
            .single()

        if (fetchError) {
            console.error("[评论审核] 查询失败:", fetchError)
            return { ok: false as const, error: "评论不存在或已删除" }
        }

        // 2. 状态锁定检查
        if (review.status === "rejected") {
            return { ok: false as const, error: "该评论已驳回，无需重复操作" }
        }
        if (review.status === "approved") {
            return { ok: false as const, error: "已通过的评论不可驳回" }
        }

        // 3. 执行驳回
        const { error } = await (supabase as any)
            .from("order_reviews")
            .update({
                status: "rejected",
                reviewed_by: admin.id,
                reviewed_at: new Date().toISOString(),
                reject_reason: rejectReason.trim(),
            })
            .eq("id", id)

        if (error) {
            console.error("[评论审核] 驳回失败:", error)
            return { ok: false as const, error: `审核驳回失败: ${error.message}` }
        }

        return { ok: true as const }
    } catch (error) {
        console.error("[评论审核] 驳回异常:", error)
        return {
            ok: false as const,
            error: error instanceof Error ? error.message : "审核驳回异常",
        }
    }
}

export async function updateReviewLevel(id: string, minUserLevel: number) {
    try {
        await requireAdmin(["superadmin", "admin", "support"])
        const supabase = getSupabaseAdminClient() as any

        // 验证等级范围
        if (minUserLevel < 0 || minUserLevel > 9) {
            return { ok: false as const, error: "用户等级必须在 0-9 之间" }
        }

        const { error } = await (supabase as any)
            .from("order_reviews")
            .update({
                min_user_level: minUserLevel,
            })
            .eq("id", id)

        if (error) {
            console.error("[评论管理] 更新可见等级失败:", error)
            return { ok: false as const, error: `更新可见等级失败: ${error.message}` }
        }

        return { ok: true as const }
    } catch (error) {
        console.error("[评论管理] 更新可见等级异常:", error)
        return {
            ok: false as const,
            error: error instanceof Error ? error.message : "更新可见等级异常",
        }
    }
}
