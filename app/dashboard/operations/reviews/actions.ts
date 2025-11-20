"use server"

import { getSupabaseAdminClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/auth"

export type ReviewStatus = "pending" | "approved" | "rejected"

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

export async function getReviews(filters: ReviewListFilters = {}) {
    try {
        await requireAdmin(["superadmin", "admin", "support"])
        const supabase = getSupabaseAdminClient()

        const {
            status = "pending",
            page = 1,
            limit = 50,
        } = filters

        let query = supabase
            .from("order_reviews")
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

        // 收集关联 ID
        const orderIds = Array.from(new Set(reviews.map((r) => r.order_id).filter(Boolean))) as string[]
        const userIds = Array.from(new Set(reviews.map((r) => r.user_id).filter(Boolean))) as string[]
        const girlIds = Array.from(new Set(reviews.map((r) => r.girl_id).filter(Boolean))) as string[]

        // 查询订单信息
        let ordersMap = new Map<string, { id: string; order_number: string }>()
        if (orderIds.length > 0) {
            const { data: ordersData } = await supabase
                .from("orders")
                .select("id, order_number")
                .in("id", orderIds)

            if (ordersData) {
                ordersMap = new Map(
                    ordersData.map((o: any) => [o.id, { id: o.id, order_number: o.order_number }]),
                )
            }
        }

        // 查询用户信息
        let usersMap = new Map<string, {
            user_id: string
            display_name: string | null
            avatar_url: string | null
        }>()
        if (userIds.length > 0) {
            const { data: usersData } = await supabase
                .from("user_profiles")
                .select("id, display_name, avatar_url")
                .in("id", userIds)

            if (usersData) {
                usersMap = new Map(
                    usersData.map((u: any) => [u.id, {
                        user_id: u.id,
                        display_name: u.display_name ?? null,
                        avatar_url: u.avatar_url ?? null,
                    }]),
                )
            }
        }

        // 查询技师信息
        let girlsMap = new Map<string, {
            id: string
            girl_number: number
            name: string
            avatar_url: string | null
        }>()
        if (girlIds.length > 0) {
            const { data: girlsData } = await supabase
                .from("girls")
                .select("id, girl_number, name, avatar_url")
                .in("id", girlIds)

            if (girlsData) {
                girlsMap = new Map(
                    girlsData.map((g: any) => [g.id, {
                        id: g.id,
                        girl_number: g.girl_number,
                        name: g.name,
                        avatar_url: g.avatar_url ?? null,
                    }]),
                )
            }
        }

        const resultReviews: ReviewListItem[] = reviews.map((r: any) => ({
            ...r,
            order: r.order_id ? (ordersMap.get(r.order_id) || null) : null,
            user_profile: r.user_id ? (usersMap.get(r.user_id) || null) : null,
            girl: r.girl_id ? (girlsMap.get(r.girl_id) || null) : null,
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
