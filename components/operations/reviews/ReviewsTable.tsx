"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LoadingSpinner } from "@/components/ui/loading"
import { Eye, Star, Copy, Check } from "lucide-react"
import { formatRelativeTime } from "@/lib/features/orders"
import type { ReviewListItem, ReviewStatus } from "@/app/dashboard/operations/reviews/actions"
import { ReviewDrawer } from "./ReviewDrawer"
import { toast } from "sonner"

interface ReviewsTableProps {
    reviews: ReviewListItem[]
    loading?: boolean
    onRefresh: () => void
}

// 状态颜色和标签
function getStatusBadge(status: ReviewStatus) {
    const config = {
        pending: { variant: "default" as const, label: "待审核", className: "bg-yellow-500 hover:bg-yellow-600 text-white" },
        approved: { variant: "default" as const, label: "已通过", className: "bg-green-600 hover:bg-green-700 text-white" },
        rejected: { variant: "destructive" as const, label: "已驳回", className: "" },
    }
    const { variant, label, className } = config[status]
    return <Badge variant={variant} className={className}>{label}</Badge>
}

// 等级标签
function getLevelBadge(level: number) {
    const levelLabels: Record<number, string> = {
        0: "公开",
        1: "注册会员",
        2: "已消费会员",
        3: "VIP3",
        4: "VIP4",
        5: "VIP5",
        6: "VIP6",
        7: "VIP7",
        8: "VIP8",
        9: "VIP9",
    }

    const label = levelLabels[level] || `等级 ${level}`
    const variant = level === 0 ? "outline" : "secondary"

    return <Badge variant={variant} className="text-xs">{label}</Badge>
}

// 星级评分显示
function StarRating({ rating }: { rating: number }) {
    return (
        <div className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-medium">{rating.toFixed(1)}</span>
        </div>
    )
}

export function ReviewsTable({ reviews, loading = false, onRefresh }: ReviewsTableProps) {
    const [selectedReview, setSelectedReview] = useState<ReviewListItem | null>(null)
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [copiedId, setCopiedId] = useState<string | null>(null)

    const handleCopyOrder = async (orderNumber: string | undefined) => {
        if (!orderNumber) return
        try {
            await navigator.clipboard.writeText(orderNumber)
            setCopiedId(orderNumber)
            setTimeout(() => setCopiedId(null), 1500)
            toast.success("已复制订单号")
        } catch (error) {
            toast.error("复制失败，请稍后重试")
        }
    }

    const handleView = (review: ReviewListItem) => {
        setSelectedReview(review)
        setDrawerOpen(true)
    }

    return (
        <>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[120px]">订单号</TableHead>
                            <TableHead className="w-[140px]">评论者</TableHead>
                            <TableHead className="w-[140px]">技师</TableHead>
                            <TableHead className="w-[80px] text-center">总分</TableHead>
                            <TableHead className="w-[80px] text-center">相似度</TableHead>
                            <TableHead className="w-[80px] text-center">可见等级</TableHead>
                            <TableHead className="w-[250px]">评论内容</TableHead>
                            <TableHead className="w-[100px]">提交时间</TableHead>
                            <TableHead className="w-[100px] text-center">状态</TableHead>
                            <TableHead className="w-[100px] text-center">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={10} className="h-24 text-center">
                                    <LoadingSpinner />
                                </TableCell>
                            </TableRow>
                        ) : reviews.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={10} className="h-24 text-center">
                                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                        <div className="text-sm">暂无评论记录</div>
                                        <div className="text-xs">当前没有需要审核的评论</div>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            reviews.map((review) => (
                                <TableRow key={review.id}>
                                    {/* 订单号 */}
                                    <TableCell>
                                        {review.order ? (
                                            <div className="flex items-center gap-1">
                                                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                                    {review.order.order_number.slice(-6)}
                                                </code>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-5 w-5"
                                                    onClick={() => handleCopyOrder(review.order?.order_number)}
                                                >
                                                    {copiedId === review.order.order_number ? (
                                                        <Check className="h-3 w-3 text-emerald-500" />
                                                    ) : (
                                                        <Copy className="h-3 w-3 text-muted-foreground" />
                                                    )}
                                                </Button>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">无</span>
                                        )}
                                    </TableCell>

                                    {/* 评论者 */}
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-7 w-7">
                                                <AvatarImage src={review.user_profile?.avatar_url || undefined} />
                                                <AvatarFallback className="text-xs">
                                                    {review.user_profile?.display_name?.slice(0, 2) || "用"}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="text-sm truncate max-w-[100px]">
                                                {review.user_profile?.display_name || "未命名用户"}
                                            </span>
                                        </div>
                                    </TableCell>

                                    {/* 技师 */}
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-7 w-7">
                                                <AvatarImage src={review.girl?.avatar_url || undefined} />
                                                <AvatarFallback className="text-xs">
                                                    {review.girl?.girl_number || "?"}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="text-sm">
                                                #{review.girl?.girl_number} {review.girl?.name || "未知"}
                                            </span>
                                        </div>
                                    </TableCell>

                                    {/* 总分 */}
                                    <TableCell className="text-center">
                                        <StarRating rating={review.rating_overall} />
                                    </TableCell>

                                    {/* 相似度 */}
                                    <TableCell className="text-center">
                                        <StarRating rating={review.rating_similarity} />
                                    </TableCell>

                                    {/* 可见等级 */}
                                    <TableCell className="text-center">
                                        {getLevelBadge(review.min_user_level)}
                                    </TableCell>

                                    {/* 评论内容 */}
                                    <TableCell>
                                        {review.comment_text ? (
                                            <span className="text-sm text-muted-foreground line-clamp-2">
                                                {review.comment_text}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">无文字评论</span>
                                        )}
                                    </TableCell>

                                    {/* 提交时间 */}
                                    <TableCell>
                                        <span className="text-sm text-muted-foreground">
                                            {formatRelativeTime(review.created_at)}
                                        </span>
                                    </TableCell>

                                    {/* 状态 */}
                                    <TableCell className="text-center">
                                        {getStatusBadge(review.status)}
                                    </TableCell>

                                    {/* 操作 */}
                                    <TableCell className="text-center">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleView(review)}
                                        >
                                            <Eye className="h-4 w-4 mr-1" />
                                            详情
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <ReviewDrawer
                open={drawerOpen}
                onOpenChange={setDrawerOpen}
                review={selectedReview}
                onReviewed={() => {
                    setDrawerOpen(false)
                    onRefresh()
                }}
            />
        </>
    )
}
