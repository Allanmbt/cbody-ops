"use server"

import { getSupabaseAdminClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/auth"

export type ReportStatus = "pending" | "resolved"

/**
 * 举报统计数据
 */
export interface ReportStats {
    pending: number          // 待处理
    today_new: number        // 今日新增
    girl_reports: number     // 技师举报
    customer_reports: number // 客户举报
}

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

/**
 * 获取举报统计
 */
export async function getReportStats() {
    try {
        await requireAdmin(["superadmin", "admin", "support"])
        const supabase = getSupabaseAdminClient()

        // ✅ 优化：使用 RPC 函数一次性获取所有统计（4次查询 → 1次）
        const { data: rpcData, error: rpcError } = await (supabase as any).rpc('get_report_stats')

        if (!rpcError && rpcData) {
            return {
                ok: true as const,
                data: rpcData as ReportStats
            }
        }

        // 回退方案：如果 RPC 不可用
        console.warn('[举报统计] RPC 不可用，使用回退方案')
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)

        const { count: pendingCount } = await supabase
            .from('reports')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending')

        const { count: todayNewCount } = await supabase
            .from('reports')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', todayStart.toISOString())

        const { count: girlReportsCount } = await supabase
            .from('reports')
            .select('*', { count: 'exact', head: true })
            .eq('reporter_role', 'girl')

        const { count: customerReportsCount } = await supabase
            .from('reports')
            .select('*', { count: 'exact', head: true })
            .eq('reporter_role', 'customer')

        return {
            ok: true as const,
            data: {
                pending: pendingCount || 0,
                today_new: todayNewCount || 0,
                girl_reports: girlReportsCount || 0,
                customer_reports: customerReportsCount || 0
            } as ReportStats
        }
    } catch (error) {
        console.error('[举报统计] 获取失败:', error)
        return { ok: false as const, error: "获取举报统计失败" }
    }
}

export async function getReports(filters: ReportListFilters = {}) {
    try {
        await requireAdmin(["superadmin", "admin", "support"])
        const supabase = getSupabaseAdminClient()

        const {
            status = "pending",
            reporter_role = "all",
            page = 1,
            limit = 50,
        } = filters

        // ✅ 优化：使用视图查询，预关联用户和技师信息（4次查询 → 1次）
        let query = supabase
            .from("v_report_monitoring")
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

        // ✅ 优化：视图已包含所有关联数据，直接格式化即可
        const resultReports: ReportListItem[] = reports.map((r: any) => ({
            id: r.id,
            reporter_id: r.reporter_id,
            reporter_role: r.reporter_role,
            target_user_id: r.target_user_id,
            report_type: r.report_type,
            description: r.description,
            screenshot_urls: r.screenshot_urls || [],
            status: r.status,
            thread_id: r.thread_id,
            order_id: r.order_id,
            reviewed_by: r.reviewed_by,
            reviewed_at: r.reviewed_at,
            admin_notes: r.admin_notes,
            created_at: r.created_at,
            updated_at: r.updated_at,
            reporter_profile: r.reporter_profile,
            target_profile: r.target_profile,
            order: r.order_info
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

/**
 * 获取举报详情
 * ✅ 优化：使用视图查询，移除重复查询
 */
export async function getReportDetail(id: string) {
    try {
        await requireAdmin(["superadmin", "admin", "support"])
        const supabase = getSupabaseAdminClient()

        const { data, error } = await supabase
            .from("v_report_monitoring")
            .select("*")
            .eq("id", id)
            .single()

        if (error || !data) {
            console.error("[举报详情] 查询失败:", error)
            return { ok: false as const, error: "举报不存在或已删除" }
        }

        const report = data as any

        const result: ReportListItem = {
            id: report.id,
            reporter_id: report.reporter_id,
            reporter_role: report.reporter_role,
            target_user_id: report.target_user_id,
            report_type: report.report_type,
            description: report.description,
            screenshot_urls: report.screenshot_urls || [],
            status: report.status,
            thread_id: report.thread_id,
            order_id: report.order_id,
            reviewed_by: report.reviewed_by,
            reviewed_at: report.reviewed_at,
            admin_notes: report.admin_notes,
            created_at: report.created_at,
            updated_at: report.updated_at,
            reporter_profile: report.reporter_profile,
            target_profile: report.target_profile,
            order: report.order_info
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

        // 1. 获取举报详情（用于推送通知）
        const { data: reportData, error: fetchError } = await supabase
            .from("reports")
            .select("reporter_id, reporter_role, target_user_id")
            .eq("id", id)
            .single()

        if (fetchError) {
            console.error("[举报处理] 查询举报详情失败:", fetchError)
            return { ok: false as const, error: "查询举报详情失败" }
        }

        // 2. 更新举报状态
        const { error } = await supabase
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

        // 3. 如果举报人是顾客且被举报人是技师，推送系统通知给顾客
        if (reportData.reporter_role === 'customer' && adminNotes) {
            try {
                console.log('[举报处理] 推送处理结果给顾客:', {
                    customer_id: reportData.reporter_id,
                    content: adminNotes
                })

                const { data: messageId, error: notifyError } = await supabase
                    .rpc('send_system_notification_to_customer', {
                        p_customer_id: reportData.reporter_id,
                        p_content: `${adminNotes}`
                    })

                if (notifyError) {
                    console.error('[举报处理] 推送通知失败:', notifyError)
                    // 不阻断主流程，只记录错误
                } else {
                    console.log('[举报处理] 通知推送成功，消息ID:', messageId)
                }
            } catch (notifyError) {
                console.error('[举报处理] 推送通知异常:', notifyError)
                // 不阻断主流程
            }
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
