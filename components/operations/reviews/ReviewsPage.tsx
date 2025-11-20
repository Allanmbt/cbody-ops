"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/ui/loading"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { getReviews, type ReviewListFilters, type ReviewListResult } from "@/app/dashboard/operations/reviews/actions"
import { ReviewsTable } from "./ReviewsTable"

export function ReviewsPage() {
    const [loading, setLoading] = useState(true)
    const [reviews, setReviews] = useState<ReviewListResult | null>(null)

    const [filters, setFilters] = useState<ReviewListFilters>({
        status: "pending",
        page: 1,
        limit: 50,
    })

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

    useEffect(() => {
        loadReviews()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.status, filters.page])

    const handleRefresh = () => {
        loadReviews()
        toast.success("已刷新数据")
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

            {/* 筛选区域 */}
            <Card>
                <CardContent className="p-4">
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
