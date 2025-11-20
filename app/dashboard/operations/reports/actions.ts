"use server"

import { getSupabaseAdminClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/auth"

export type ReportStatus = "pending" | "resolved"

export interface ReportListFilters {
    status?: ReportStatus | "all"
    reporter_role?: "girl" | "customer" | "all"
    page?: number
    limit?: number
}

export interface ReportListItem {
    id: string
    reporter_id: string
    reporter_role: string
    target_user_id: string
    report_type: string
    description: string | null
    screenshot_urls: string[] | null
    status: ReportStatus
    thread_id: string | null
    order_id: string | null
    reviewed_by: string | null
    reviewed_at: string | null
    admin_notes: string | null
    created_at: string
    updated_at: string
    reporter_profile?: {
        user_id: string
        display_name: string | null
        avatar_url: string | null
        girl_number?: number | null  // 技师工号
        girl_name?: string | null    // 技师姓名
    } | null
    target_profile?: {
        user_id: string
        display_name: string | null
        avatar_url: string | null
        girl_number?: number | null  // 技师工号
        girl_name?: string | null    // 技师姓名
    } | null
    order?: {
        id: string
        order_number: string
    } | null
}

export interface ReportListResult {
    reports: ReportListItem[]
    total: number
    page: number
    limit: number
    totalPages: number
}

export async function getReports(filters: ReportListFilters = {}) {
    try {
        await requireAdmin(["superadmin", "admin", "support"]) // 管理员、超管、客服均可访问
        const supabase = getSupabaseAdminClient()

        const {
            status = "pending",
            reporter_role = "all",
            page = 1,
            limit = 50,
        } = filters

        let query = supabase
            .from("reports")
            .select("*", { count: "exact" })

        // 状态筛选
        if (status && status !== "all") {
            query = query.eq("status", status)
        }

        // 举报人角色筛选
        if (reporter_role && reporter_role !== "all") {
            query = query.eq("reporter_role", reporter_role)
        }

        // 排序：按创建时间倒序
        query = query.order("created_at", { ascending: false })

        // 分页
        const from = (page - 1) * limit
        const to = from + limit - 1
        query = query.range(from, to)

        const { data, error, count } = await query

        if (error) {
            console.error("[举报处理] 查询失败:", error)
            return { ok: false as const, error: `查询举报失败: ${error.message}` }
        }

        const reports = (data || []) as any[]

        if (reports.length === 0) {
            return {
                ok: true as const,
                data: {
                    reports: [],
                    total: 0,
                    page,
                    limit,
                    totalPages: 0,
                } satisfies ReportListResult,
            }
        }

        // 收集用户ID
        const userIds = Array.from(
            new Set(
                reports
                    .flatMap((r) => [r.reporter_id, r.target_user_id])
                    .filter(Boolean),
            ),
        ) as string[]

        let profilesMap = new Map<string, {
            user_id: string
            display_name: string | null
            avatar_url: string | null
            girl_number?: number | null
            girl_name?: string | null
        }>()

        if (userIds.length > 0) {
            const { data: profilesData, error: profilesError } = await supabase
                .from("user_profiles")
                .select("id, display_name, avatar_url")
                .in("id", userIds)

            if (!profilesError && profilesData) {
                profilesMap = new Map(
                    profilesData.map((p: any) => [p.id, {
                        user_id: p.id,
                        display_name: p.display_name ?? null,
                        avatar_url: p.avatar_url ?? null,
                    }]),
                )
            }

            // 查询技师信息（工号和姓名）
            const { data: girlsData } = await supabase
                .from("girls")
                .select("user_id, girl_number, name, avatar_url")
                .in("user_id", userIds)

            if (girlsData && girlsData.length > 0) {
                girlsData.forEach((girl: any) => {
                    const existing = profilesMap.get(girl.user_id)
                    if (existing) {
                        profilesMap.set(girl.user_id, {
                            ...existing,
                            girl_number: girl.girl_number,
                            girl_name: girl.name,
                            avatar_url: girl.avatar_url || existing.avatar_url, // 优先使用技师头像
                        })
                    }
                })
            }
        }

        // 收集订单ID
        const orderIds = Array.from(new Set(reports.map((r) => r.order_id).filter(Boolean))) as string[]
        let ordersMap = new Map<string, { id: string; order_number: string }>()

        if (orderIds.length > 0) {
            const { data: ordersData, error: ordersError } = await supabase
                .from("orders")
                .select("id, order_number")
                .in("id", orderIds)

            if (!ordersError && ordersData) {
                ordersMap = new Map(
                    ordersData.map((o: any) => [o.id, { id: o.id, order_number: o.order_number }]),
                )
            }
        }

        const resultReports: ReportListItem[] = reports.map((r: any) => ({
            ...r,
            screenshot_urls: r.screenshot_urls || [],
            reporter_profile: profilesMap.get(r.reporter_id) || null,
            target_profile: profilesMap.get(r.target_user_id) || null,
            order: r.order_id ? (ordersMap.get(r.order_id) || null) : null,
        }))

        const total = count || resultReports.length
        const totalPages = Math.ceil(total / limit)

        return {
            ok: true as const,
            data: {
                reports: resultReports,
                total,
                page,
                limit,
                totalPages,
            } satisfies ReportListResult,
        }
    } catch (error) {
        console.error("[举报处理] 查询异常:", error)
        return {
            ok: false as const,
            error: error instanceof Error ? error.message : "查询举报异常",
        }
    }
}

export async function getReportDetail(id: string) {
    try {
        await requireAdmin(["superadmin", "admin", "support"])
        const supabase = getSupabaseAdminClient()

        const { data, error } = await supabase
            .from("reports")
            .select("*")
            .eq("id", id)
            .single()

        if (error || !data) {
            console.error("[举报详情] 查询失败:", error)
            return { ok: false as const, error: "举报不存在或已删除" }
        }

        const report = data as any

        // 加载用户信息
        const userIds = [report.reporter_id, report.target_user_id].filter(Boolean) as string[]
        let profilesMap = new Map<string, {
            user_id: string
            display_name: string | null
            avatar_url: string | null
            girl_number?: number | null
            girl_name?: string | null
        }>()

        if (userIds.length > 0) {
            const { data: profilesData } = await supabase
                .from("user_profiles")
                .select("id, display_name, avatar_url")
                .in("id", userIds)

            profilesMap = new Map(
                (profilesData || []).map((p: any) => [p.id, {
                    user_id: p.id,
                    display_name: p.display_name ?? null,
                    avatar_url: p.avatar_url ?? null,
                }]),
            )

            // 查询技师信息（工号和姓名）
            const { data: girlsData } = await supabase
                .from("girls")
                .select("user_id, girl_number, name, avatar_url")
                .in("user_id", userIds)

            if (girlsData && girlsData.length > 0) {
                girlsData.forEach((girl: any) => {
                    const existing = profilesMap.get(girl.user_id)
                    if (existing) {
                        profilesMap.set(girl.user_id, {
                            ...existing,
                            girl_number: girl.girl_number,
                            girl_name: girl.name,
                            avatar_url: girl.avatar_url || existing.avatar_url,
                        })
                    }
                })
            }
        }

        // 订单信息
        let order: { id: string; order_number: string } | null = null
        if (report.order_id) {
            const { data: orderData } = await supabase
                .from("orders")
                .select("id, order_number")
                .eq("id", report.order_id)
                .maybeSingle()

            if (orderData) {
                order = { id: (orderData as any).id, order_number: (orderData as any).order_number }
            }
        }

        const result: ReportListItem = {
            ...report,
            screenshot_urls: report.screenshot_urls || [],
            reporter_profile: profilesMap.get(report.reporter_id) || null,
            target_profile: profilesMap.get(report.target_user_id) || null,
            order,
        }

        return { ok: true as const, data: result }
    } catch (error) {
        console.error("[举报详情] 查询异常:", error)
        return {
            ok: false as const,
            error: error instanceof Error ? error.message : "查询举报详情异常",
        }
    }
}

export async function resolveReport(id: string, adminNotes?: string) {
    try {
        const admin = await requireAdmin(["superadmin", "admin", "support"])
        const supabase = getSupabaseAdminClient() as any

        const { error } = await (supabase as any)
            .from("reports")
            .update({
                status: "resolved",
                reviewed_by: admin.id,
                reviewed_at: new Date().toISOString(),
                admin_notes: adminNotes ?? null,
            })
            .eq("id", id)

        if (error) {
            console.error("[举报处理] 标记已处理失败:", error)
            return { ok: false as const, error: error instanceof Error ? error.message : "标记已处理失败" }
        }

        return { ok: true as const }
    } catch (error) {
        console.error("[举报处理] 标记已处理异常:", error)
        return {
            ok: false as const,
            error: error instanceof Error ? error.message : "标记已处理异常",
        }
    }
}
