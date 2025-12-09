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
import { Copy, Check, ChevronLeft, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { getCustomerOrderHistory } from "@/app/dashboard/operations/chats/actions"
import { formatRelativeTime } from "@/lib/features/orders"

interface CustomerDetailDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    customer: {
        id: string
        username?: string
        display_name?: string
        avatar_url?: string
        level?: number
        phone_country_code?: string
        phone_number?: string
        country_code?: string
        language_code?: string
        credit_score?: number
    } | null
}

/**
 * 从多语言对象或字符串中提取文本
 */
function getDisplayText(value: any): string {
    if (!value) return ''
    if (typeof value === 'string') return value
    if (typeof value === 'object') {
        // 优先顺序：zh > en > th > 第一个可用的值
        return value.zh || value.en || value.th || Object.values(value)[0] || ''
    }
    return String(value)
}

/**
 * 一键复制客户ID
 */
function CopyCustomerIdButton({ customerId }: { customerId: string }) {
    const [copied, setCopied] = useState(false)

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(customerId)
            setCopied(true)
            toast.success("客户ID已复制")
            setTimeout(() => setCopied(false), 2000)
        } catch (error) {
            toast.error("复制失败")
        }
    }

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="h-8"
        >
            {copied ? (
                <>
                    <Check className="h-3 w-3 mr-1 text-green-600" />
                    已复制
                </>
            ) : (
                <>
                    <Copy className="h-3 w-3 mr-1" />
                    复制ID
                </>
            )}
        </Button>
    )
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

export function CustomerDetailDialog({
    open,
    onOpenChange,
    customer
}: CustomerDetailDialogProps) {
    const [loading, setLoading] = useState(false)
    const [orders, setOrders] = useState<any[]>([])
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)
    const [totalPages, setTotalPages] = useState(0)
    const limit = 20

    useEffect(() => {
        if (open && customer) {
            loadOrders()
        } else {
            // 关闭时重置状态
            setOrders([])
            setPage(1)
            setTotal(0)
            setTotalPages(0)
        }
    }, [open, customer, page])

    const loadOrders = async () => {
        if (!customer) return

        setLoading(true)
        try {
            const result = await getCustomerOrderHistory(customer.id, page, limit)
            if (result.ok && result.data) {
                setOrders(result.data.orders)
                setTotal(result.data.total)
                setTotalPages(result.data.totalPages)
            } else {
                toast.error(result.error || "加载订单历史失败")
            }
        } catch (error) {
            toast.error("加载订单历史异常")
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

    if (!customer) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>客户详情</DialogTitle>
                </DialogHeader>

                {/* 客户信息卡片 */}
                <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <span className="text-lg font-semibold">
                                    {getDisplayText(customer.display_name) || getDisplayText(customer.username) || '未知客户'}
                                </span>
                                {customer.level && (
                                    <Badge variant="secondary">Lv.{customer.level}</Badge>
                                )}
                            </div>
                            {customer.username && customer.display_name && (
                                <div className="text-sm text-muted-foreground">
                                    @{getDisplayText(customer.username)}
                                </div>
                            )}
                        </div>
                        <CopyCustomerIdButton customerId={customer.id} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t">
                        {customer.phone_number && (
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">电话:</span>
                                <span className="text-sm">
                                    {customer.phone_country_code} {customer.phone_number}
                                </span>
                            </div>
                        )}

                        {customer.credit_score !== undefined && (
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">信用分:</span>
                                <Badge variant={customer.credit_score >= 80 ? "default" : customer.credit_score >= 60 ? "secondary" : "destructive"}>
                                    {customer.credit_score}
                                </Badge>
                            </div>
                        )}

                        {customer.country_code && (
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">国家:</span>
                                <span className="text-sm">{customer.country_code.toUpperCase()}</span>
                            </div>
                        )}

                        {customer.language_code && (
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">语言:</span>
                                <span className="text-sm">{customer.language_code.toUpperCase()}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 订单历史 */}
                <div className="flex-1 min-h-0 flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold">预订历史（共 {total} 条）</h3>
                    </div>

                    {/* 订单列表 - 可滚动 */}
                    <div className="flex-1 overflow-y-auto border rounded-lg">
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
                                            <div className="flex items-center gap-2 text-sm">
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
                        <div className="flex items-center justify-between mt-3 pt-3 border-t">
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
                </div>
            </DialogContent>
        </Dialog>
    )
}
