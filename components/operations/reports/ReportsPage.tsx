"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LoadingSpinner } from "@/components/ui/loading"
import { RefreshCw, Filter, AlertCircle, TrendingUp, Users, UserCheck } from "lucide-react"
import { toast } from "sonner"
import { getReports, getReportStats, type ReportListFilters, type ReportListResult, type ReportStats, type ReportListItem } from "@/app/dashboard/operations/reports/actions"
import { ReportsTable } from "./ReportsTable"

interface ReportsPageProps {
    initialStats: ReportStats | null
    initialReports: ReportListItem[]
    initialTotal: number
}

export function ReportsPage({ initialStats, initialReports, initialTotal }: ReportsPageProps) {
    const [stats, setStats] = useState<ReportStats | null>(initialStats)
    const [loadingStats, setLoadingStats] = useState(false)
    const [loading, setLoading] = useState(false)
    const [reports, setReports] = useState<ReportListResult | null>({
        reports: initialReports,
        total: initialTotal,
        page: 1,
        limit: 50,
        totalPages: Math.ceil(initialTotal / 50)
    })

    const [filters, setFilters] = useState<ReportListFilters>({
        status: "pending",
        reporter_role: "all",
        page: 1,
        limit: 50,
    })

    const loadStats = async () => {
        setLoadingStats(true)
        const result = await getReportStats()
        if (result.ok) {
            setStats(result.data)
        } else {
            toast.error(result.error || "加载统计数据失败")
        }
        setLoadingStats(false)
    }

    const loadReports = async () => {
        setLoading(true)
        const result = await getReports(filters)
        if (result.ok && result.data) {
            setReports(result.data)
        } else {
            toast.error(result.error || "加载举报列表失败")
        }
        setLoading(false)
    }

    // ✅ 优化：移除初始化加载，数据已由服务端传入
    // 使用 ref 跟踪是否是首次渲染
    const isInitialMount = useRef(true)

    useEffect(() => {
        // 跳过首次渲染（已有初始数据）
        if (isInitialMount.current) {
            isInitialMount.current = false
            return
        }
        loadReports()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.status, filters.reporter_role, filters.page])

    const handleRefresh = async () => {
        await Promise.all([loadStats(), loadReports()])
        toast.success("已刷新数据")
    }

    const handleReset = () => {
        setFilters({
            status: "pending",
            reporter_role: "all",
            page: 1,
            limit: 50,
        })
    }

    const total = reports?.total || 0
    const page = filters.page || 1
    const limit = filters.limit || 50

    return (
        <div className="flex flex-col gap-6 p-4 md:px-8 md:py-6">
            {/* 标题区域 */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold">举报处理</h1>
                    <p className="text-sm text-muted-foreground mt-1">查看并处理来自技师和客户的举报记录</p>
                </div>
                <Button onClick={handleRefresh} variant="outline" size="sm" className="w-fit">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    刷新
                </Button>
            </div>

            {/* 统计卡片 */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">待处理</CardTitle>
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {loadingStats ? "-" : stats?.pending || 0}
                            <span className="text-base font-normal text-muted-foreground ml-1">个</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">今日新增</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {loadingStats ? "-" : stats?.today_new || 0}
                            <span className="text-base font-normal text-muted-foreground ml-1">个</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">技师举报</CardTitle>
                        <UserCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {loadingStats ? "-" : stats?.girl_reports || 0}
                            <span className="text-base font-normal text-muted-foreground ml-1">个</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">客户举报</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {loadingStats ? "-" : stats?.customer_reports || 0}
                            <span className="text-base font-normal text-muted-foreground ml-1">个</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* 筛选区域 */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Filter className="h-4 w-4" />
                            <span>筛选条件</span>
                        </div>

                        {/* 状态导航 + 举报人角色，同一行，整体左对齐 */}
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
                            {/* 状态切换按钮组 */}
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant={filters.status === "pending" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setFilters({ ...filters, status: "pending", page: 1 })}
                                >
                                    待处理
                                </Button>
                                <Button
                                    variant={filters.status === "resolved" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setFilters({ ...filters, status: "resolved", page: 1 })}
                                >
                                    已处理
                                </Button>
                            </div>

                            {/* 举报人角色，下拉 */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium">举报人角色</span>
                                <Select
                                    value={filters.reporter_role || "all"}
                                    onValueChange={(value: any) => setFilters({ ...filters, reporter_role: value, page: 1 })}
                                >
                                    <SelectTrigger className="w-[140px]">
                                        <SelectValue placeholder="全部角色" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">全部</SelectItem>
                                        <SelectItem value="girl">技师</SelectItem>
                                        <SelectItem value="customer">客户</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 举报列表 */}
            <Card>
                <CardHeader>
                    <CardTitle>举报列表</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {loading && !reports ? (
                        <div className="flex justify-center py-10">
                            <LoadingSpinner />
                        </div>
                    ) : (
                        <ReportsTable
                            reports={reports?.reports || []}
                            loading={loading}
                            onRefresh={loadReports}
                        />
                    )}
                </CardContent>
            </Card>

            {/* 分页 */}
            {total > 0 && (
                <div className="flex items-center justify-between px-2">
                    <div className="text-sm text-muted-foreground">
                        显示 {(page - 1) * limit + 1} - {Math.min(page * limit, total)} 条，共 {total} 条
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setFilters({ ...filters, page: Math.max(1, page - 1) })}
                            disabled={page === 1}
                        >
                            上一页
                        </Button>
                        <div className="text-sm">第 {page} 页</div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setFilters({ ...filters, page: page + 1 })}
                            disabled={page * limit >= total}
                        >
                            下一页
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
