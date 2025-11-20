"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LoadingSpinner } from "@/components/ui/loading"
import { RefreshCw, Filter } from "lucide-react"
import { toast } from "sonner"
import { getReports, type ReportListFilters, type ReportListResult } from "@/app/dashboard/operations/reports/actions"
import { ReportsTable } from "./ReportsTable"

export function ReportsPage() {
    const [loading, setLoading] = useState(true)
    const [reports, setReports] = useState<ReportListResult | null>(null)

    const [filters, setFilters] = useState<ReportListFilters>({
        status: "pending",
        reporter_role: "all",
        page: 1,
        limit: 50,
    })

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

    useEffect(() => {
        loadReports()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.status, filters.reporter_role, filters.page])

    const handleRefresh = () => {
        loadReports()
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
