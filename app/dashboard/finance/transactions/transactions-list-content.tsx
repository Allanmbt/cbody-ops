"use client"

/**
 * 交易记录列表页面
 * 展示待审核和已处理的交易申请
 */

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Search, Filter, ArrowUpDown, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react"
import { getGirlTransactions, approveTransaction, rejectTransaction } from "@/lib/features/finance/actions"
import type { SettlementTransactionWithDetails } from "@/lib/features/finance"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"

export function TransactionsListContent() {
    const [transactions, setTransactions] = useState<SettlementTransactionWithDetails[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [typeFilter, setTypeFilter] = useState<"all" | "deposit" | "payment" | "withdrawal" | "adjustment">("all")
    const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all")
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const pageSize = 20

    // 审核对话框状态
    const [reviewDialogOpen, setReviewDialogOpen] = useState(false)
    const [selectedTransaction, setSelectedTransaction] = useState<SettlementTransactionWithDetails | null>(null)
    const [reviewAction, setReviewAction] = useState<"approve" | "reject">("approve")
    const [rejectReason, setRejectReason] = useState("")
    const [reviewing, setReviewing] = useState(false)

    useEffect(() => {
        loadTransactions()
    }, [page, typeFilter, statusFilter])

    async function loadTransactions() {
        try {
            setLoading(true)
            const result = await getGirlTransactions(
                "", // 不限定技师
                {
                    transaction_type: typeFilter === "all" ? undefined : typeFilter,
                    approval_status: statusFilter === "all" ? undefined : statusFilter,
                },
                { page, pageSize }
            )

            if (!result.ok) {
                toast.error(result.error || "获取交易记录失败")
                return
            }

            setTransactions(result.data!.data)
            setTotalPages(result.data!.totalPages)
        } catch (error) {
            console.error('[TransactionsList] 加载失败:', error)
            toast.error("加载交易记录失败")
        } finally {
            setLoading(false)
        }
    }

    function handleSearch() {
        setPage(1)
        loadTransactions()
    }

    function openReviewDialog(transaction: SettlementTransactionWithDetails, action: "approve" | "reject") {
        setSelectedTransaction(transaction)
        setReviewAction(action)
        setRejectReason("")
        setReviewDialogOpen(true)
    }

    async function handleReview() {
        if (!selectedTransaction) return

        if (reviewAction === "reject" && !rejectReason.trim()) {
            toast.error("请输入拒绝原因")
            return
        }

        try {
            setReviewing(true)

            let result
            if (reviewAction === "approve") {
                result = await approveTransaction({ transaction_id: selectedTransaction.id })
            } else {
                result = await rejectTransaction({
                    transaction_id: selectedTransaction.id,
                    reject_reason: rejectReason
                })
            }

            if (!result.ok) {
                toast.error(result.error || "审核操作失败")
                return
            }

            toast.success(reviewAction === "approve" ? "申请已批准" : "申请已拒绝")
            setReviewDialogOpen(false)
            await loadTransactions()
        } catch (error) {
            console.error('[TransactionsList] 审核失败:', error)
            toast.error("审核操作失败")
        } finally {
            setReviewing(false)
        }
    }

    const filteredTransactions = transactions.filter(tx => {
        if (!searchTerm) return true
        const girlName = tx.girls?.name?.toLowerCase() || ""
        const girlNumber = tx.girls?.girl_number?.toString() || ""
        const search = searchTerm.toLowerCase()
        return girlName.includes(search) || girlNumber.includes(search)
    })

    return (
        <div className="flex flex-col gap-6">
            {/* 标题 */}
            <div>
                <h1 className="text-3xl font-bold">交易记录</h1>
                <p className="text-muted-foreground mt-1">
                    管理技师提现和结账申请
                </p>
            </div>

            {/* 筛选区域 */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                                <Input
                                    placeholder="搜索技师名称或工号..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    className="pl-9"
                                />
                            </div>
                            <Button onClick={handleSearch}>
                                搜索
                            </Button>
                        </div>
                        <Select
                            value={typeFilter}
                            onValueChange={(value: any) => {
                                setTypeFilter(value)
                                setPage(1)
                            }}
                        >
                            <SelectTrigger className="w-full md:w-[180px]">
                                <Filter className="mr-2 size-4" />
                                <SelectValue placeholder="交易类型" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">全部类型</SelectItem>
                                <SelectItem value="deposit">付定金</SelectItem>
                                <SelectItem value="payment">申请结账</SelectItem>
                                <SelectItem value="withdrawal">申请提现</SelectItem>
                                <SelectItem value="adjustment">人工调整</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select
                            value={statusFilter}
                            onValueChange={(value: any) => {
                                setStatusFilter(value)
                                setPage(1)
                            }}
                        >
                            <SelectTrigger className="w-full md:w-[180px]">
                                <Filter className="mr-2 size-4" />
                                <SelectValue placeholder="审核状态" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">全部状态</SelectItem>
                                <SelectItem value="pending">待审核</SelectItem>
                                <SelectItem value="approved">已批准</SelectItem>
                                <SelectItem value="rejected">已拒绝</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* 列表 */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ArrowUpDown className="size-5" />
                        交易记录列表
                        {!loading && (
                            <Badge variant="secondary">
                                共 {filteredTransactions.length} 条
                            </Badge>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <TransactionsTableSkeleton />
                    ) : filteredTransactions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <ArrowUpDown className="size-12 text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">暂无交易记录</p>
                        </div>
                    ) : (
                        <>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>技师</TableHead>
                                            <TableHead>交易类型</TableHead>
                                            <TableHead className="text-right">金额</TableHead>
                                            <TableHead>资金流向</TableHead>
                                            <TableHead>支付方式</TableHead>
                                            <TableHead>审核状态</TableHead>
                                            <TableHead>创建时间</TableHead>
                                            <TableHead className="text-right">操作</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredTransactions.map((tx) => (
                                            <TableRow key={tx.id}>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{tx.girls?.name}</span>
                                                        <span className="text-xs text-muted-foreground">
                                                            #{tx.girls?.girl_number}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">
                                                        {tx.transaction_type === 'deposit' && '付定金'}
                                                        {tx.transaction_type === 'payment' && '申请结账'}
                                                        {tx.transaction_type === 'withdrawal' && '申请提现'}
                                                        {tx.transaction_type === 'adjustment' && '人工调整'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right font-semibold">
                                                    {formatCurrency(tx.amount)}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={tx.direction === 'to_platform' ? 'destructive' : 'default'}>
                                                        {tx.direction === 'to_platform' ? '→ 平台' : '→ 技师'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {tx.payment_method || '-'}
                                                </TableCell>
                                                <TableCell>
                                                    {tx.approval_status === 'pending' && (
                                                        <Badge variant="outline" className="gap-1">
                                                            <Clock className="size-3" />
                                                            待审核
                                                        </Badge>
                                                    )}
                                                    {tx.approval_status === 'approved' && (
                                                        <Badge variant="default" className="gap-1">
                                                            <CheckCircle className="size-3" />
                                                            已批准
                                                        </Badge>
                                                    )}
                                                    {tx.approval_status === 'rejected' && (
                                                        <Badge variant="destructive" className="gap-1">
                                                            <XCircle className="size-3" />
                                                            已拒绝
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {format(new Date(tx.created_at), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {tx.approval_status === 'pending' && (
                                                        <div className="flex gap-2 justify-end">
                                                            <Button
                                                                variant="default"
                                                                size="sm"
                                                                onClick={() => openReviewDialog(tx, 'approve')}
                                                            >
                                                                <CheckCircle className="mr-1 size-4" />
                                                                批准
                                                            </Button>
                                                            <Button
                                                                variant="destructive"
                                                                size="sm"
                                                                onClick={() => openReviewDialog(tx, 'reject')}
                                                            >
                                                                <XCircle className="mr-1 size-4" />
                                                                拒绝
                                                            </Button>
                                                        </div>
                                                    )}
                                                    {tx.approval_status === 'rejected' && tx.reject_reason && (
                                                        <p className="text-xs text-muted-foreground">
                                                            拒绝原因：{tx.reject_reason}
                                                        </p>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* 分页 */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between mt-4">
                                    <p className="text-sm text-muted-foreground">
                                        第 {page} 页，共 {totalPages} 页
                                    </p>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPage(p => Math.max(1, p - 1))}
                                            disabled={page === 1}
                                        >
                                            上一页
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                            disabled={page === totalPages}
                                        >
                                            下一页
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* 审核对话框 */}
            <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {reviewAction === 'approve' ? '批准申请' : '拒绝申请'}
                        </DialogTitle>
                        <DialogDescription>
                            {selectedTransaction && (
                                <>
                                    技师：{selectedTransaction.girls?.name} (#{selectedTransaction.girls?.girl_number})<br />
                                    金额：{formatCurrency(selectedTransaction.amount)}
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    {reviewAction === 'reject' && (
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="reject-reason">拒绝原因</Label>
                                <Textarea
                                    id="reject-reason"
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    placeholder="请输入拒绝原因..."
                                    rows={4}
                                />
                            </div>
                        </div>
                    )}
                    {reviewAction === 'approve' && (
                        <div className="py-4">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <AlertCircle className="size-4" />
                                <span>确认批准此申请？批准后将更新技师账户余额。</span>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setReviewDialogOpen(false)}
                            disabled={reviewing}
                        >
                            取消
                        </Button>
                        <Button
                            variant={reviewAction === 'approve' ? 'default' : 'destructive'}
                            onClick={handleReview}
                            disabled={reviewing}
                        >
                            {reviewing ? '处理中...' : reviewAction === 'approve' ? '确认批准' : '确认拒绝'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function TransactionsTableSkeleton() {
    return (
        <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
            ))}
        </div>
    )
}
