"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LoadingSpinner } from "@/components/ui/loading"
import { RefreshCw, AlertCircle, TrendingUp, CheckCircle2, XCircle, Search } from "lucide-react"
import { toast } from "sonner"
import { getReviews, getReviewStats, type ReviewListFilters, type ReviewListResult, type ReviewStats, type ReviewListItem } from "@/app/dashboard/operations/reviews/actions"
import { ReviewsTable } from "./ReviewsTable"

interface ReviewsPageProps {
    initialStats: ReviewStats | null
    initialReviews: ReviewListItem[]
    initialTotal: number
}

export function ReviewsPage({ initialStats, initialReviews, initialTotal }: ReviewsPageProps) {
    const [stats, setStats] = useState<ReviewStats | null>(initialStats)
    const [loadingStats, setLoadingStats] = useState(false)
    const [loading, setLoading] = useState(false)
    const [reviews, setReviews] = useState<ReviewListResult | null>({
        reviews: initialReviews,
        total: initialTotal,
        page: 1,
        limit: 50,
        totalPages: Math.ceil(initialTotal / 50)
    })

    const [searchInput, setSearchInput] = useState("")

    const [filters, setFilters] = useState<ReviewListFilters>({
        status: "pending",
        ratingRange: "all",
        page: 1,
        limit: 50,
    })

    const loadStats = async () => {
        setLoadingStats(true)
        const result = await getReviewStats()
        if (result.ok) {
            setStats(result.data)
        } else {
            toast.error(result.error || "加载统计数据失败")
        }
        setLoadingStats(false)
    }

    const loadReviews = async () => {
        setLoading(true)
        const result = await getReviews(filters)
        if (result.ok && result.data) {
            setReviews(result.data)
        } else {
            toast.error(result.error || "加载评论列表失败")
        }
        setLoading(false)
    }

    // ✅ 优化：移除初始化加载，数据已由服务端传入
    const isInitialMount = useRef(true)

    useEffect(() => {
        // 跳过首次渲染（已有初始数据）
        if (isInitialMount.current) {
            isInitialMount.current = false
            return
        }
        loadReviews()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.status, filters.page, filters.search, filters.ratingRange])

    const handleRefresh = async () => {
        await Promise.all([loadStats(), loadReviews()])
        toast.success("已刷新数据")
    }

    const handleSearch = () => {
        setFilters({ ...filters, search: searchInput.trim() || undefined, page: 1 })
    }

    const handleClearSearch = () => {
        setSearchInput("")
        setFilters({ ...filters, search: undefined, page: 1 })
    }

    const total = reviews?.total || 0
    const page = filters.page || 1
    const limit = filters.limit || 50

    return (
        <div className="flex flex-col gap-6 p-4 md:px-8 md:py-6">
            {/* 标题区域 */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold">评论审核</h1>
                    <p className="text-sm text-muted-foreground mt-1">审核用户提交的订单评价</p>
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
                        <CardTitle className="text-sm font-medium">待审核</CardTitle>
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {loadingStats ? "-" : stats?.pending || 0}
                            <span className="text-base font-normal text-muted-foreground ml-1">条</span>
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
                            <span className="text-base font-normal text-muted-foreground ml-1">条</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">已通过</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {loadingStats ? "-" : stats?.approved || 0}
                            <span className="text-base font-normal text-muted-foreground ml-1">条</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">已驳回</CardTitle>
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {loadingStats ? "-" : stats?.rejected || 0}
                            <span className="text-base font-normal text-muted-foreground ml-1">条</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* 筛选区域 */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col gap-4">
                        {/* 搜索框 */}
                        <div className="flex gap-2">
                            <Input
                                placeholder="输入技师工号或名称搜索..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        handleSearch()
                                    }
                                }}
                                className="max-w-xs"
                            />
                            <Button onClick={handleSearch} size="sm">
                                <Search className="mr-2 h-4 w-4" />
                                搜索
                            </Button>
                            {filters.search && (
                                <Button onClick={handleClearSearch} variant="outline" size="sm">
                                    清除
                                </Button>
                            )}
                        </div>

                        {/* 状态筛选 */}
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant={filters.status === "pending" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setFilters({ ...filters, status: "pending", page: 1 })}
                                className={filters.status === "pending" ? "bg-yellow-500 hover:bg-yellow-600" : ""}
                            >
                                待审核
                            </Button>
                            <Button
                                variant={filters.status === "approved" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setFilters({ ...filters, status: "approved", page: 1 })}
                                className={filters.status === "approved" ? "bg-green-600 hover:bg-green-700" : ""}
                            >
                                已通过
                            </Button>
                            <Button
                                variant={filters.status === "rejected" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setFilters({ ...filters, status: "rejected", page: 1 })}
                                className={filters.status === "rejected" ? "bg-red-600 hover:bg-red-700" : ""}
                            >
                                已驳回
                            </Button>
                            <Button
                                variant={filters.status === "all" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setFilters({ ...filters, status: "all", page: 1 })}
                            >
                                全部
                            </Button>
                        </div>

                        {/* 星级筛选 */}
                        <div className="flex flex-wrap gap-2 items-center">
                            <span className="text-sm text-muted-foreground">星级：</span>
                            <Button
                                variant={filters.ratingRange === "all" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setFilters({ ...filters, ratingRange: "all", page: 1 })}
                            >
                                全部
                            </Button>
                            <Button
                                variant={filters.ratingRange === "low" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setFilters({ ...filters, ratingRange: "low", page: 1 })}
                                className={filters.ratingRange === "low" ? "bg-red-600 hover:bg-red-700" : ""}
                            >
                                ≤2★ 差评
                            </Button>
                            <Button
                                variant={filters.ratingRange === "medium" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setFilters({ ...filters, ratingRange: "medium", page: 1 })}
                                className={filters.ratingRange === "medium" ? "bg-orange-500 hover:bg-orange-600" : ""}
                            >
                                3-4★ 中评
                            </Button>
                            <Button
                                variant={filters.ratingRange === "high" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setFilters({ ...filters, ratingRange: "high", page: 1 })}
                                className={filters.ratingRange === "high" ? "bg-green-600 hover:bg-green-700" : ""}
                            >
                                ≥4.5★ 好评
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 评论列表 */}
            <Card>
                <CardHeader>
                    <CardTitle>评论列表</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {loading && !reviews ? (
                        <div className="flex justify-center py-10">
                            <LoadingSpinner />
                        </div>
                    ) : (
                        <ReviewsTable
                            reviews={reviews?.reviews || []}
                            loading={loading}
                            onRefresh={loadReviews}
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
