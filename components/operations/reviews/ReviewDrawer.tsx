"use client"

import { useState, useEffect } from "react"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Star, Check, X, User, Award, Edit2, Save, Copy } from "lucide-react"
import { formatRelativeTime } from "@/lib/features/orders"
import { approveReview, rejectReview, updateReviewLevel, updateReviewAnonymous, updateReviewComment, type ReviewListItem } from "@/app/dashboard/operations/reviews/actions"
import { toast } from "sonner"

interface ReviewDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    review: ReviewListItem | null
    onReviewed: () => void
}

// 状态标签
function getStatusBadge(status: string) {
    const config = {
        pending: { variant: "default" as const, label: "待审核", className: "bg-yellow-500 hover:bg-yellow-600 text-white" },
        approved: { variant: "default" as const, label: "已通过", className: "bg-green-600 hover:bg-green-700 text-white" },
        rejected: { variant: "destructive" as const, label: "已驳回", className: "" },
    }
    const { variant, label, className } = config[status as keyof typeof config] || config.pending
    return <Badge variant={variant} className={className}>{label}</Badge>
}

// 星级评分组件
function RatingItem({ label, rating, icon: Icon }: { label: string; rating: number; icon?: any }) {
    return (
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
                {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                <span className="text-sm font-medium">{label}</span>
            </div>
            <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                        key={star}
                        className={`h-4 w-4 ${star <= rating
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-gray-300"
                            }`}
                    />
                ))}
                <span className="ml-2 text-sm font-semibold">{rating.toFixed(1)}</span>
            </div>
        </div>
    )
}

export function ReviewDrawer({ open, onOpenChange, review, onReviewed }: ReviewDrawerProps) {
    const [isApproving, setIsApproving] = useState(false)
    const [isRejecting, setIsRejecting] = useState(false)
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
    const [rejectReason, setRejectReason] = useState("")
    const [minUserLevel, setMinUserLevel] = useState(0)
    const [isUpdatingLevel, setIsUpdatingLevel] = useState(false)
    const [isAnonymous, setIsAnonymous] = useState(false)
    const [isUpdatingAnonymous, setIsUpdatingAnonymous] = useState(false)
    const [isEditingComment, setIsEditingComment] = useState(false)
    const [commentText, setCommentText] = useState("")
    const [isUpdatingComment, setIsUpdatingComment] = useState(false)

    // 同步评论的可见等级、匿名状态和评论内容
    useEffect(() => {
        if (review) {
            setMinUserLevel(review.min_user_level)
            setIsAnonymous(review.is_anonymous)
            setCommentText(review.comment_text || "")
            setIsEditingComment(false)
        }
    }, [review])

    if (!review) return null

    const handleApprove = async () => {
        setIsApproving(true)
        const result = await approveReview(review.id)
        setIsApproving(false)

        if (!result.ok) {
            toast.error(result.error || "审核通过失败")
            return
        }

        toast.success("评论已通过")
        onReviewed()
    }

    const handleRejectConfirm = async () => {
        if (!rejectReason.trim()) {
            toast.error("请填写驳回原因")
            return
        }

        setIsRejecting(true)
        const result = await rejectReview(review.id, rejectReason)
        setIsRejecting(false)

        if (!result.ok) {
            toast.error(result.error || "审核驳回失败")
            return
        }

        toast.success("评论已驳回")
        setRejectDialogOpen(false)
        setRejectReason("")
        onReviewed()
    }

    const handleLevelChange = async (value: string) => {
        const level = parseInt(value)

        setIsUpdatingLevel(true)
        const result = await updateReviewLevel(review.id, level)
        setIsUpdatingLevel(false)

        if (!result.ok) {
            toast.error(result.error || "更新可见等级失败")
            return
        }

        setMinUserLevel(level)
        toast.success("可见等级已更新")
        onReviewed()
    }

    const handleAnonymousChange = async (checked: boolean) => {
        setIsUpdatingAnonymous(true)
        const result = await updateReviewAnonymous(review.id, checked)
        setIsUpdatingAnonymous(false)

        if (!result.ok) {
            toast.error(result.error || "更新匿名状态失败")
            return
        }

        setIsAnonymous(checked)
        toast.success(checked ? "已设置为匿名显示" : "已取消匿名显示")
        onReviewed()
    }

    const handleSaveComment = async () => {
        setIsUpdatingComment(true)
        const result = await updateReviewComment(review.id, commentText)
        setIsUpdatingComment(false)

        if (!result.ok) {
            toast.error(result.error || "更新评论内容失败")
            return
        }

        setIsEditingComment(false)
        toast.success("评论内容已更新")
        onReviewed()
    }

    const handleCancelEditComment = () => {
        setCommentText(review.comment_text || "")
        setIsEditingComment(false)
    }

    // 复制客户ID到剪贴板
    const copyCustomerId = async () => {
        try {
            await navigator.clipboard.writeText(review.user_id)
            toast.success("客户ID已复制")
        } catch (error) {
            toast.error("复制失败")
        }
    }

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent className="w-full sm:w-[580px] sm:max-w-[580px] overflow-y-auto px-6">
                    <SheetHeader className="px-0">
                        <SheetTitle className="flex items-center justify-between gap-2">
                            <span>评论详情</span>
                            {getStatusBadge(review.status)}
                        </SheetTitle>
                        <SheetDescription>
                            {review.order ? `订单号：${review.order.order_number}` : "查看评论详细信息"}
                        </SheetDescription>
                    </SheetHeader>

                    <div className="mt-6 space-y-6 px-0">
                        {/* 评论人和技师信息 */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* 评论者 */}
                            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <User className="h-3 w-3" />
                                    <span>评论者</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10">
                                        <AvatarImage src={review.user_profile?.avatar_url || undefined} />
                                        <AvatarFallback className="text-xs">
                                            {review.user_profile?.display_name?.slice(0, 2) || "用"}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium truncate">
                                            {review.user_profile?.display_name || "未命名用户"}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <code className="text-xs text-muted-foreground font-mono">
                                                {review.user_id.slice(0, 8)}...
                                            </code>
                                            <button
                                                onClick={copyCustomerId}
                                                className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded hover:bg-muted"
                                                title="复制完整客户ID"
                                            >
                                                <Copy className="h-3 w-3" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 技师 */}
                            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Award className="h-3 w-3" />
                                    <span>被评价技师</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10">
                                        <AvatarImage src={review.girl?.avatar_url || undefined} />
                                        <AvatarFallback className="text-xs">
                                            {review.girl?.girl_number || "?"}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium">
                                            #{review.girl?.girl_number} {review.girl?.name || "未知"}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 评分详情 */}
                        <div className="space-y-3">
                            <div className="text-sm font-medium">评分详情</div>

                            {/* 总分（醒目显示） */}
                            <div className="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-950 dark:to-orange-950 rounded-lg border-2 border-yellow-200 dark:border-yellow-800">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-xs text-muted-foreground mb-1">综合评分</div>
                                        <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                                            {review.rating_overall.toFixed(2)}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            （服务、态度、情绪平均分）
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <Star
                                                key={star}
                                                className={`h-6 w-6 ${star <= Math.round(review.rating_overall)
                                                        ? "fill-yellow-400 text-yellow-400"
                                                        : "text-gray-300"
                                                    }`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* 三项具体评分 */}
                            <div className="space-y-2">
                                <RatingItem label="服务质量" rating={review.rating_service} />
                                <RatingItem label="服务态度" rating={review.rating_attitude} />
                                <RatingItem label="情绪价值" rating={review.rating_emotion} />
                            </div>

                            {/* 相似度评分（独立显示） */}
                            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                                <RatingItem label="本人相似度" rating={review.rating_similarity} />
                                <div className="text-xs text-muted-foreground mt-2 px-3">
                                    * 此项不计入综合评分
                                </div>
                            </div>
                        </div>

                        {/* 评论内容 */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="text-sm font-medium">评论内容</div>
                                {!isEditingComment && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setIsEditingComment(true)}
                                    >
                                        <Edit2 className="h-3 w-3 mr-1" />
                                        编辑
                                    </Button>
                                )}
                            </div>

                            {isEditingComment ? (
                                <div className="space-y-2">
                                    <Textarea
                                        value={commentText}
                                        onChange={(e) => setCommentText(e.target.value)}
                                        placeholder="请输入评论内容..."
                                        className="min-h-[120px] resize-none"
                                        disabled={isUpdatingComment}
                                    />
                                    <div className="flex items-center gap-2">
                                        <Button
                                            size="sm"
                                            onClick={handleSaveComment}
                                            disabled={isUpdatingComment}
                                        >
                                            <Save className="h-3 w-3 mr-1" />
                                            {isUpdatingComment ? "保存中..." : "保存"}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleCancelEditComment}
                                            disabled={isUpdatingComment}
                                        >
                                            取消
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-sm whitespace-pre-wrap break-words bg-muted/40 rounded-lg p-4 border">
                                    {review.comment_text || <span className="text-muted-foreground">暂无评论内容</span>}
                                </div>
                            )}
                        </div>

                        {/* 可见等级 */}
                        <div className="space-y-2">
                            <div className="text-sm font-medium">可见设置</div>
                            <div className="p-3 bg-muted/50 rounded-lg space-y-3">
                                {/* 最低可见等级 */}
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-sm text-muted-foreground">最低可见用户等级</span>
                                    <Select
                                        value={minUserLevel.toString()}
                                        onValueChange={handleLevelChange}
                                        disabled={isUpdatingLevel}
                                    >
                                        <SelectTrigger className="w-[200px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="0">0 - 公开</SelectItem>
                                            <SelectItem value="1">1 - 注册会员</SelectItem>
                                            <SelectItem value="2">2 - 已消费会员</SelectItem>
                                            <SelectItem value="3">3 - VIP3</SelectItem>
                                            <SelectItem value="4">4 - VIP4</SelectItem>
                                            <SelectItem value="5">5 - VIP5</SelectItem>
                                            <SelectItem value="6">6 - VIP6</SelectItem>
                                            <SelectItem value="7">7 - VIP7</SelectItem>
                                            <SelectItem value="8">8 - VIP8</SelectItem>
                                            <SelectItem value="9">9 - VIP9</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* 匿名显示 */}
                                <div className="flex items-center justify-between gap-3 pt-2 border-t">
                                    <div className="flex-1">
                                        <span className="text-sm text-muted-foreground">匿名显示</span>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            启用后评论者信息将显示为"匿名用户"
                                        </p>
                                    </div>
                                    <Switch
                                        checked={isAnonymous}
                                        onCheckedChange={handleAnonymousChange}
                                        disabled={isUpdatingAnonymous}
                                    />
                                </div>

                                {(isUpdatingLevel || isUpdatingAnonymous) && (
                                    <div className="text-xs text-muted-foreground">更新中...</div>
                                )}
                            </div>
                        </div>

                        {/* 审核信息 */}
                        {review.status !== "pending" && (
                            <div className="space-y-2">
                                <div className="text-sm font-medium">审核信息</div>
                                <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                                    {review.reviewed_at && (
                                        <div className="text-xs text-muted-foreground">
                                            审核时间：{formatRelativeTime(review.reviewed_at)}
                                        </div>
                                    )}
                                    {review.reject_reason && (
                                        <div className="space-y-1">
                                            <div className="text-xs text-muted-foreground">驳回原因：</div>
                                            <div className="text-sm text-destructive bg-destructive/10 rounded p-2">
                                                {review.reject_reason}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* 提交时间 */}
                        <div className="pt-2 border-t text-xs text-muted-foreground">
                            提交时间：{formatRelativeTime(review.created_at)}
                        </div>

                        {/* 操作按钮 */}
                        {review.status === "pending" && (
                            <div className="flex items-center gap-3 pt-4 border-t">
                                <Button
                                    className="flex-1 bg-green-600 hover:bg-green-700"
                                    onClick={handleApprove}
                                    disabled={isApproving}
                                >
                                    <Check className="h-4 w-4 mr-2" />
                                    {isApproving ? "处理中..." : "通过审核"}
                                </Button>
                                <Button
                                    variant="destructive"
                                    className="flex-1"
                                    onClick={() => setRejectDialogOpen(true)}
                                    disabled={isApproving}
                                >
                                    <X className="h-4 w-4 mr-2" />
                                    驳回评论
                                </Button>
                            </div>
                        )}

                        {/* 已审核状态提示 */}
                        {review.status !== "pending" && (
                            <div className="pt-4 border-t">
                                <div className="p-3 bg-muted/50 rounded-lg text-center">
                                    <div className="text-sm text-muted-foreground">
                                        {review.status === "approved" && "✓ 该评论已通过审核，状态已锁定"}
                                        {review.status === "rejected" && "✗ 该评论已驳回，状态已锁定"}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </SheetContent>
            </Sheet>

            {/* 驳回确认对话框 */}
            <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>驳回评论</AlertDialogTitle>
                        <AlertDialogDescription>
                            请填写驳回原因，此原因将反馈给用户。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4">
                        <Textarea
                            placeholder="请填写驳回原因（必填）&#10;&#10;例如：&#10;- 评论内容包含不当言论&#10;- 评论内容与服务无关&#10;- 评论涉嫌恶意攻击"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="min-h-[120px] resize-none"
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleRejectConfirm}
                            disabled={isRejecting || !rejectReason.trim()}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            {isRejecting ? "提交中..." : "确认驳回"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
