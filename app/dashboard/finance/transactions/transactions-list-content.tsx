"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Search, CheckCircle, XCircle, Clock, AlertCircle, DollarSign, TrendingUp, TrendingDown, Image as ImageIcon, ExternalLink, Info, CreditCard } from "lucide-react"
import { getTransactionStats, getTransactions, approveTransaction, rejectTransaction, getGirlBankAccount } from "./actions"
import type { Transaction, TransactionStats, TransactionType } from "@/lib/features/transactions"
import { toast } from "sonner"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"

export function TransactionsListContent() {
    const [stats, setStats] = useState<TransactionStats | null>(null)
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [loading, setLoading] = useState(true)
    const [statsLoading, setStatsLoading] = useState(true)

    // 状态管理
    const [activeTab, setActiveTab] = useState<TransactionType>('settlement')
    const [statusFilter, setStatusFilter] = useState<'pending' | 'confirmed' | 'cancelled' | undefined>('pending')
    const [cityFilter, setCityFilter] = useState<string>('')
    const [searchTerm, setSearchTerm] = useState("")

    // 分页
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [total, setTotal] = useState(0)
    const pageSize = 20

    // 审核对话框状态
    const [reviewDialogOpen, setReviewDialogOpen] = useState(false)
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
    const [reviewAction, setReviewAction] = useState<"approve" | "reject">("approve")
    const [reviewNotes, setReviewNotes] = useState("")
    const [reviewing, setReviewing] = useState(false)

    // 图片预览状态
    const [previewImage, setPreviewImage] = useState<string | null>(null)

    // 备注查看对话框状态
    const [notesDialogOpen, setNotesDialogOpen] = useState(false)
    const [selectedNotes, setSelectedNotes] = useState<string | null>(null)

    // 收款账号查看对话框状态
    const [bankAccountDialogOpen, setBankAccountDialogOpen] = useState(false)
    const [selectedBankAccount, setSelectedBankAccount] = useState<any>(null)
    const [loadingBankAccount, setLoadingBankAccount] = useState(false)

    useEffect(() => {
        loadStats()
    }, [])

    useEffect(() => {
        loadTransactions()
    }, [page, activeTab, statusFilter, cityFilter])

    async function loadStats() {
        try {
            setStatsLoading(true)
            const result = await getTransactionStats()
            if (result.ok && result.data) {
                setStats(result.data)
            }
        } catch (error) {
            console.error('[TransactionsList] 加载统计失败:', error)
        } finally {
            setStatsLoading(false)
        }
    }

    async function loadTransactions() {
        try {
            setLoading(true)
            const result = await getTransactions({
                type: activeTab,
                status: statusFilter,
                city: cityFilter || undefined,
                search: searchTerm || undefined,
                page,
                limit: pageSize
            })

            if (!result.ok) {
                toast.error(result.error || "获取申请列表失败")
                return
            }

            if (result.data) {
                setTransactions(result.data.data)
                setTotalPages(result.data.totalPages)
                setTotal(result.data.total)
            }
        } catch (error) {
            console.error('[TransactionsList] 加载失败:', error)
            toast.error("加载申请列表失败")
        } finally {
            setLoading(false)
        }
    }

    function handleSearch() {
        setPage(1)
        loadTransactions()
    }

    function openReviewDialog(transaction: Transaction, action: "approve" | "reject") {
        setSelectedTransaction(transaction)
        setReviewAction(action)
        setReviewNotes("")
        setReviewDialogOpen(true)
    }

    async function handleReview() {
        if (!selectedTransaction) return

        if (reviewAction === "reject" && !reviewNotes.trim()) {
            toast.error("请输入拒绝原因")
            return
        }

        try {
            setReviewing(true)

            let result
            if (reviewAction === "approve") {
                result = await approveTransaction({
                    transaction_id: selectedTransaction.id,
                    notes: reviewNotes || undefined
                })
            } else {
                result = await rejectTransaction({
                    transaction_id: selectedTransaction.id,
                    reason: reviewNotes
                })
            }

            if (!result.ok) {
                toast.error(result.error || "审核操作失败")
                return
            }

            toast.success(reviewAction === "approve" ? "申请已批准" : "申请已拒绝")
            setReviewDialogOpen(false)
            await Promise.all([loadStats(), loadTransactions()])
        } catch (error) {
            console.error('[TransactionsList] 审核失败:', error)
            toast.error("审核操作失败")
        } finally {
            setReviewing(false)
        }
    }

    // 查看收款账号
    async function handleViewBankAccount(girlId: string) {
        setLoadingBankAccount(true)
        setBankAccountDialogOpen(true)
        setSelectedBankAccount(null)

        const result = await getGirlBankAccount(girlId)
        setLoadingBankAccount(false)

        if (!result.ok) {
            toast.error(result.error || "查询收款账号失败")
            return
        }

        setSelectedBankAccount(result.data)
    }

    function formatCurrency(amount: number, currency: 'THB' | 'RMB') {
        return new Intl.NumberFormat('zh-CN', {
            style: 'currency',
            currency: currency === 'THB' ? 'THB' : 'CNY',
            minimumFractionDigits: 2
        }).format(amount)
    }

    return (
        <div className="flex flex-col gap-6 p-4 md:px-8 md:py-6">
            {/* 标题 */}
            <div>
                <h1 className="text-2xl font-bold">结账/提现申请管理</h1>
                <p className="text-muted-foreground mt-1">
                    技师结账和提现申请审核管理
                </p>
            </div>

            {/* 统计卡片 */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">待审核</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {statsLoading ? "-" : stats?.pending_count || 0}
                            <span className="text-base font-normal text-muted-foreground ml-1">笔</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">等待处理</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">今日已审</CardTitle>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {statsLoading ? "-" : stats?.today_approved_count || 0}
                            <span className="text-base font-normal text-muted-foreground ml-1">笔</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">今日审核通过</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">今日结账</CardTitle>
                        <TrendingUp className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {statsLoading ? "-" : formatCurrency(stats?.today_settlement_amount || 0, 'THB')}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">技师结账给平台</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">今日提现</CardTitle>
                        <TrendingDown className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {statsLoading ? "-" : formatCurrency(stats?.today_withdrawal_amount || 0, 'RMB')}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">平台代收提现</p>
                    </CardContent>
                </Card>
            </div>

            {/* 主要内容区域 */}
            <Tabs value={activeTab} onValueChange={(v) => {
                setActiveTab(v as TransactionType)
                setPage(1)
            }} className="space-y-4">
                <div className="flex items-center justify-between">
                    <TabsList>
                        <TabsTrigger value="settlement" className="gap-2">
                            <TrendingUp className="size-4" />
                            结账申请 (THB)
                        </TabsTrigger>
                        <TabsTrigger value="withdrawal" className="gap-2">
                            <TrendingDown className="size-4" />
                            提现申请 (RMB)
                        </TabsTrigger>
                    </TabsList>

                    <div className="flex items-center gap-2">
                        {/* 搜索 */}
                        <div className="relative w-64">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                            <Input
                                placeholder="搜索技师姓名或工号..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                className="pl-8 h-9"
                            />
                        </div>

                        {/* 状态筛选 */}
                        <Select
                            value={statusFilter || 'all'}
                            onValueChange={(value) => {
                                setStatusFilter(value === 'all' ? undefined : value as 'pending' | 'confirmed' | 'cancelled')
                                setPage(1)
                            }}
                        >
                            <SelectTrigger className="w-[120px] h-9">
                                <SelectValue placeholder="状态" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">全部状态</SelectItem>
                                <SelectItem value="pending">待审核</SelectItem>
                                <SelectItem value="confirmed">已确认</SelectItem>
                                <SelectItem value="cancelled">已取消</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <Card>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="p-6">
                                <TransactionsTableSkeleton />
                            </div>
                        ) : transactions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <DollarSign className="size-12 text-muted-foreground mb-4" />
                                <p className="text-muted-foreground">暂无申请记录</p>
                            </div>
                        ) : (
                            <div className="rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>技师信息</TableHead>
                                            <TableHead className="text-right">金额</TableHead>
                                            {activeTab === 'settlement' ? (
                                                <>
                                                    <TableHead>支付方式</TableHead>
                                                    <TableHead>支付凭证</TableHead>
                                                </>
                                            ) : (
                                                <>
                                                    <TableHead className="text-right">汇率 & 手续费</TableHead>
                                                    <TableHead className="text-right">实际打款 (THB)</TableHead>
                                                    <TableHead>收款账号</TableHead>
                                                    <TableHead>备注</TableHead>
                                                </>
                                            )}
                                            <TableHead>申请时间</TableHead>
                                            <TableHead>状态</TableHead>
                                            <TableHead className="text-right">操作</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {transactions.map((tx) => (
                                            <TableRow key={tx.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarImage src={tx.girl?.avatar_url || undefined} />
                                                            <AvatarFallback>{tx.girl?.name?.[0] || '?'}</AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">{tx.girl?.name || '-'}</span>
                                                            <span className="text-xs text-muted-foreground">
                                                                #{tx.girl?.girl_number || '-'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="font-bold text-lg">
                                                        {activeTab === 'settlement'
                                                            ? formatCurrency(tx.amount, 'THB')
                                                            : formatCurrency(tx.amount, 'RMB')
                                                        }
                                                    </div>
                                                </TableCell>

                                                {activeTab === 'settlement' ? (
                                                    <>
                                                        <TableCell>
                                                            <Badge variant="outline">{tx.payment_method || '未知'}</Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            {tx.payment_proof_url ? (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 gap-1 text-blue-600"
                                                                    onClick={() => setPreviewImage(tx.payment_proof_url)}
                                                                >
                                                                    <ImageIcon className="size-4" />
                                                                    查看凭证
                                                                </Button>
                                                            ) : (
                                                                <span className="text-muted-foreground text-sm">-</span>
                                                            )}
                                                        </TableCell>
                                                    </>
                                                ) : (
                                                    <>
                                                        {/* 汇率 & 手续费 */}
                                                        <TableCell className="text-right">
                                                            <div className="flex flex-col text-sm">
                                                                <span className="text-muted-foreground text-xs">
                                                                    汇率: {tx.exchange_rate?.toFixed(4) || '-'}
                                                                </span>
                                                                <span className="text-muted-foreground text-xs">
                                                                    费率: {tx.service_fee_rate ? `${(tx.service_fee_rate * 100).toFixed(2)}%` : '-'}
                                                                </span>
                                                            </div>
                                                        </TableCell>
                                                        {/* 实际打款 (THB) */}
                                                        <TableCell className="text-right">
                                                            {tx.actual_amount_thb ? (
                                                                <div className="font-bold text-green-600">
                                                                    ฿{tx.actual_amount_thb.toFixed(2)}
                                                                </div>
                                                            ) : (
                                                                <span className="text-muted-foreground text-sm">-</span>
                                                            )}
                                                        </TableCell>
                                                        {/* 收款账号 */}
                                                        <TableCell>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 gap-1 text-blue-600"
                                                                onClick={() => handleViewBankAccount(tx.girl_id)}
                                                            >
                                                                <CreditCard className="size-4" />
                                                                查看
                                                            </Button>
                                                        </TableCell>
                                                        {/* 备注 */}
                                                        <TableCell>
                                                            {tx.notes ? (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 gap-1 text-blue-600"
                                                                    onClick={() => {
                                                                        setSelectedNotes(tx.notes)
                                                                        setNotesDialogOpen(true)
                                                                    }}
                                                                >
                                                                    <Info className="size-4" />
                                                                    查看
                                                                </Button>
                                                            ) : (
                                                                <span className="text-muted-foreground text-sm">-</span>
                                                            )}
                                                        </TableCell>
                                                    </>
                                                )}

                                                <TableCell className="text-sm text-muted-foreground">
                                                    {format(new Date(tx.created_at), 'MM-dd HH:mm', { locale: zhCN })}
                                                </TableCell>
                                                <TableCell>
                                                    {tx.status === 'pending' && (
                                                        <Badge variant="outline" className="gap-1 bg-yellow-50 text-yellow-700 border-yellow-200">
                                                            <Clock className="size-3" />
                                                            待审核
                                                        </Badge>
                                                    )}
                                                    {tx.status === 'confirmed' && (
                                                        <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-700">
                                                            <CheckCircle className="size-3" />
                                                            已确认
                                                        </Badge>
                                                    )}
                                                    {tx.status === 'cancelled' && (
                                                        <Badge variant="destructive" className="gap-1">
                                                            <XCircle className="size-3" />
                                                            已取消
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {tx.status === 'pending' && (
                                                        <div className="flex gap-2 justify-end">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                onClick={() => openReviewDialog(tx, 'reject')}
                                                            >
                                                                驳回
                                                            </Button>
                                                            <Button
                                                                variant="default"
                                                                size="sm"
                                                                className="bg-green-600 hover:bg-green-700"
                                                                onClick={() => openReviewDialog(tx, 'approve')}
                                                            >
                                                                {activeTab === 'settlement' ? '确认收款' : '确认打款'}
                                                            </Button>
                                                        </div>
                                                    )}
                                                    {tx.status === 'cancelled' && tx.notes && (
                                                        <div className="text-xs text-red-500 text-right max-w-[150px] ml-auto truncate" title={tx.notes}>
                                                            驳回: {tx.notes}
                                                        </div>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>

                    {/* 分页 */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between p-4 border-t">
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
                </Card>
            </Tabs>

            {/* 审核对话框 */}
            <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {reviewAction === 'approve'
                                ? (selectedTransaction?.transaction_type === 'settlement' ? '确认收款' : '确认打款')
                                : '驳回申请'
                            }
                        </DialogTitle>
                    </DialogHeader>

                    {selectedTransaction && (
                        <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">技师</span>
                                <span className="font-medium">{selectedTransaction.girl?.name} (#{selectedTransaction.girl?.girl_number})</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                    {selectedTransaction.transaction_type === 'withdrawal' ? '申请金额 (RMB)' : '金额 (THB)'}
                                </span>
                                <span className="font-bold text-lg">
                                    {selectedTransaction.transaction_type === 'withdrawal'
                                        ? formatCurrency(selectedTransaction.amount, 'RMB')
                                        : formatCurrency(selectedTransaction.amount, 'THB')
                                    }
                                </span>
                            </div>

                            {/* 提现申请的额外信息 */}
                            {selectedTransaction.transaction_type === 'withdrawal' && (
                                <>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">汇率 (CNY to THB)</span>
                                        <span className="font-medium">{selectedTransaction.exchange_rate?.toFixed(4) || '-'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">服务费率</span>
                                        <span className="font-medium">
                                            {selectedTransaction.service_fee_rate
                                                ? `${(selectedTransaction.service_fee_rate * 100).toFixed(2)}%`
                                                : '-'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center pt-2 border-t">
                                        <span className="text-muted-foreground font-semibold">实际打款 (THB)</span>
                                        <span className="font-bold text-xl text-green-600">
                                            {selectedTransaction.actual_amount_thb
                                                ? `฿${selectedTransaction.actual_amount_thb.toFixed(2)}`
                                                : '-'}
                                        </span>
                                    </div>
                                </>
                            )}

                            {selectedTransaction.transaction_type === 'settlement' && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">方式</span>
                                    <span>{selectedTransaction.payment_method || '-'}</span>
                                </div>
                            )}

                            {selectedTransaction.notes && (
                                <div className="flex flex-col gap-1 pt-2 border-t">
                                    <span className="text-muted-foreground text-sm">收款信息/备注</span>
                                    <span className="text-sm">{selectedTransaction.notes}</span>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="space-y-4 py-2">
                        {reviewAction === 'approve' && (
                            <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-md text-sm text-blue-900 dark:text-blue-100">
                                <AlertCircle className="size-4 mt-0.5 shrink-0" />
                                <div>
                                    {selectedTransaction?.transaction_type === 'settlement' ? (
                                        <p>请确认您已收到技师转账的款项。确认后将扣除技师的欠款余额。</p>
                                    ) : (
                                        <p>请确认您已向技师完成打款。确认后将扣除技师的代收余额。</p>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="review-notes">
                                {reviewAction === 'approve' ? '备注（可选）' : '驳回原因（必填）'}
                            </Label>
                            <Textarea
                                id="review-notes"
                                value={reviewNotes}
                                onChange={(e) => setReviewNotes(e.target.value)}
                                placeholder={reviewAction === 'approve' ? '输入备注信息...' : '请输入驳回原因...'}
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setReviewDialogOpen(false)}
                            disabled={reviewing}
                        >
                            取消
                        </Button>
                        {reviewAction === 'approve' ? (
                            <Button
                                onClick={handleReview}
                                disabled={reviewing}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                {reviewing ? '处理中...' : '确认通过'}
                            </Button>
                        ) : (
                            <Button
                                variant="destructive"
                                onClick={handleReview}
                                disabled={reviewing}
                            >
                                {reviewing ? '处理中...' : '确认驳回'}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 图片预览对话框 */}
            <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
                <DialogContent className="max-w-3xl p-0 overflow-hidden bg-black/90 border-none">
                    <DialogHeader className="sr-only">
                        <DialogTitle>支付凭证预览</DialogTitle>
                    </DialogHeader>
                    <div className="relative w-full h-[80vh] flex items-center justify-center">
                        {previewImage && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={previewImage}
                                alt="支付凭证"
                                className="max-w-full max-h-full object-contain"
                            />
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 text-white hover:bg-white/20"
                            onClick={() => setPreviewImage(null)}
                        >
                            <XCircle className="size-6" />
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* 备注查看对话框 */}
            <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>备注信息</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <p className="text-sm whitespace-pre-wrap">{selectedNotes}</p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setNotesDialogOpen(false)}>
                            关闭
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 收款账号查看对话框 */}
            <Dialog open={bankAccountDialogOpen} onOpenChange={setBankAccountDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
                    <DialogHeader className="flex-shrink-0">
                        <DialogTitle>技师收款账号</DialogTitle>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto min-h-0 px-1">
                        {loadingBankAccount ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="text-center space-y-2">
                                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
                                    <p className="text-sm text-muted-foreground">加载中...</p>
                                </div>
                            </div>
                        ) : !selectedBankAccount ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <AlertCircle className="size-12 text-muted-foreground mb-4" />
                                <p className="text-muted-foreground">未找到收款账号信息</p>
                            </div>
                        ) : (
                            <div className="space-y-6 py-4">
                                {/* 银行账号信息 */}
                                <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                                    <div className="flex justify-between items-center gap-4">
                                        <span className="text-sm text-muted-foreground flex-shrink-0">账户名</span>
                                        <span className="font-medium text-right break-all">{selectedBankAccount.bank_account_name || '-'}</span>
                                    </div>
                                    <div className="flex justify-between items-center gap-4">
                                        <span className="text-sm text-muted-foreground flex-shrink-0">账号</span>
                                        <span className="font-mono font-medium text-right break-all">{selectedBankAccount.bank_account_number || '-'}</span>
                                    </div>
                                    <div className="flex justify-between items-center gap-4">
                                        <span className="text-sm text-muted-foreground flex-shrink-0">银行</span>
                                        <span className="font-medium text-right break-all">{selectedBankAccount.bank_name || '-'}</span>
                                    </div>
                                    {selectedBankAccount.bank_branch && (
                                        <div className="flex justify-between items-center gap-4">
                                            <span className="text-sm text-muted-foreground flex-shrink-0">支行</span>
                                            <span className="font-medium text-right break-all">{selectedBankAccount.bank_branch}</span>
                                        </div>
                                    )}
                                </div>

                                {/* 二维码图片 */}
                                {selectedBankAccount.bank_meta?.qr_code_url && (
                                    <div className="space-y-2">
                                        <Label className="text-sm font-medium">收款二维码</Label>
                                        <div className="border rounded-lg p-4 bg-white flex items-center justify-center">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={selectedBankAccount.bank_meta.qr_code_url}
                                                alt="收款二维码"
                                                className="max-w-full h-auto object-contain"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="flex-shrink-0">
                        <Button variant="outline" onClick={() => setBankAccountDialogOpen(false)}>
                            关闭
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
