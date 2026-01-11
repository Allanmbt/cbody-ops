"use client"

import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LoadingSpinner } from "@/components/ui/loading"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { getUserBookingHistory } from "@/app/dashboard/users/actions"
import { formatRelativeTime } from "@/lib/features/orders"

interface UserBookingHistoryDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    userId: string | null
    userName?: string
}

/**
 * 从多语言对象或字符串中提取文本
 */
function getDisplayText(value: any): string {
    if (!value) return ''
    if (typeof value === 'string') return value
    if (typeof value === 'object') {
        return value.zh || value.en || value.th || Object.values(value)[0] || ''
    }
    return String(value)
}

/**
 * 订单状态显示
 */
function getOrderStatusBadge(status: string) {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
        pending: { label: '待确认', variant: 'outline' },
        confirmed: { label: '已确认', variant: 'default' },
        en_route: { label: '路上', variant: 'default' },
        arrived: { label: '已到达', variant: 'default' },
        in_service: { label: '服务中', variant: 'default' },
        completed: { label: '已完成', variant: 'secondary' },
        cancelled: { label: '已取消', variant: 'destructive' },
    }

    const config = statusMap[status] || { label: status, variant: 'outline' as const }
    return <Badge variant={config.variant}>{config.label}</Badge>
}

export function UserBookingHistoryDialog({
    open,
    onOpenChange,
    userId,
    userName
}: UserBookingHistoryDialogProps) {
    const [loading, setLoading] = useState(false)
    const [orders, setOrders] = useState<any[]>([])
    const [page, setPage] = useState(1)
    const [limit, setLimit] = useState(20)
    const [total, setTotal] = useState(0)
    const [totalPages, setTotalPages] = useState(0)

    useEffect(() => {
        if (open && userId) {
            loadOrders()
        } else {
            // 关闭时重置状态
            setOrders([])
            setPage(1)
            setTotal(0)
            setTotalPages(0)
        }
    }, [open, userId, page, limit])

    const loadOrders = async () => {
        if (!userId) return

        setLoading(true)
        try {
            const result = await getUserBookingHistory(userId, page, limit)
            if (result.ok && result.data) {
                setOrders(result.data.orders)
                setTotal(result.data.total)
                setTotalPages(result.data.totalPages)
            } else {
                toast.error(result.error || "加载预订历史失败")
            }
        } catch (error) {
            toast.error("加载预订历史异常")
        } finally {
            setLoading(false)
        }
    }

    const handlePrevPage = () => {
        if (page > 1) {
            setPage(page - 1)
        }
    }

    const handleNextPage = () => {
        if (page < totalPages) {
            setPage(page + 1)
        }
    }

    const handleLimitChange = (value: string) => {
        setLimit(parseInt(value))
        setPage(1) // 重置到第一页
    }

    if (!userId) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>
                        {userName ? `${userName} - ` : ''}历史预订记录
                    </DialogTitle>
                </DialogHeader>

                {/* 工具栏 */}
                <div className="flex items-center justify-between border-b pb-3">
                    <div className="text-sm text-muted-foreground">
                        共 {total} 条记录
                    </div>
                    <Select value={limit.toString()} onValueChange={handleLimitChange}>
                        <SelectTrigger className="w-32">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="20">20条/页</SelectItem>
                            <SelectItem value="50">50条/页</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* 订单列表 - 可滚动 */}
                <div className="flex-1 min-h-0 overflow-y-auto border rounded-lg">
                    {loading ? (
                        <div className="flex items-center justify-center h-40">
                            <LoadingSpinner />
                        </div>
                    ) : orders.length === 0 ? (
                        <div className="flex items-center justify-center h-40">
                            <p className="text-sm text-muted-foreground">暂无预订记录</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {orders.map((order) => (
                                <div key={order.id} className="p-4 hover:bg-muted/50 transition-colors">
                                    <div className="flex flex-col gap-2">
                                        {/* 第一行：订单号 + 状态 */}
                                        <div className="flex items-center justify-between">
                                            <code className="text-xs bg-muted px-2 py-1 rounded">
                                                {order.order_number}
                                            </code>
                                            {getOrderStatusBadge(order.status)}
                                        </div>

                                        {/* 第二行：技师 + 服务 */}
                                        <div className="flex items-center gap-2 text-sm flex-wrap">
                                            {order.girl && (
                                                <span className="text-muted-foreground">
                                                    技师: <span className="text-foreground">{getDisplayText(order.girl.name) || `#${order.girl.girl_number}`}</span>
                                                </span>
                                            )}
                                            {order.service_name && (
                                                <span className="text-muted-foreground">
                                                    服务: <span className="text-foreground">{getDisplayText(order.service_name)}</span>
                                                </span>
                                            )}
                                        </div>

                                        {/* 第三行：金额 + 时间 */}
                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <span>¥{order.total_amount || 0}</span>
                                            <span>{formatRelativeTime(order.created_at)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 分页 */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-3 border-t">
                        <div className="text-sm text-muted-foreground">
                            第 {page} / {totalPages} 页
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handlePrevPage}
                                disabled={page === 1 || loading}
                            >
                                <ChevronLeft className="h-4 w-4 mr-1" />
                                上一页
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleNextPage}
                                disabled={page === totalPages || loading}
                            >
                                下一页
                                <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
