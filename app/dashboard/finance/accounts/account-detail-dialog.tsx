"use client"

/**
 * 技师交易流水弹窗
 * 轻量级：只显示订单核验记录和结账/提现记录
 */

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Receipt,
    ArrowUpDown,
    ChevronLeft,
    ChevronRight,
} from "lucide-react"
import {
    getSettlementAccountDetail,
    getGirlOrderSettlements,
    getGirlTransactions,
} from "@/lib/features/finance/actions"
import type {
    GirlSettlementAccountWithGirl,
    OrderSettlementWithDetails,
    SettlementTransactionWithDetails,
} from "@/lib/features/finance"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"

interface AccountDetailDialogProps {
    girlId: string | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function AccountDetailDialog({ girlId, open, onOpenChange }: AccountDetailDialogProps) {
    const [account, setAccount] = useState<GirlSettlementAccountWithGirl | null>(null)
    const [orderSettlements, setOrderSettlements] = useState<OrderSettlementWithDetails[]>([])
    const [transactions, setTransactions] = useState<SettlementTransactionWithDetails[]>([])
    const [loadingOrders, setLoadingOrders] = useState(false)
    const [loadingTxs, setLoadingTxs] = useState(false)
    const [transactionsLoaded, setTransactionsLoaded] = useState(false) // 标记是否已加载过交易记录

    // 分页状态
    const [ordersPage, setOrdersPage] = useState(1)
    const [ordersTotalPages, setOrdersTotalPages] = useState(1)
    const [txsPage, setTxsPage] = useState(1)
    const [txsTotalPages, setTxsTotalPages] = useState(1)
    const pageSize = 20

    useEffect(() => {
        if (open && girlId) {
            setOrdersPage(1)
            setTxsPage(1)
            setTransactionsLoaded(false) // 重置加载标记
            loadData()
        } else {
            setAccount(null)
            setOrderSettlements([])
            setTransactions([])
            setOrdersPage(1)
            setOrdersTotalPages(1)
            setTxsPage(1)
            setTxsTotalPages(1)
            setTransactionsLoaded(false)
        }
    }, [open, girlId])

    useEffect(() => {
        if (open && girlId) {
            loadOrdersData()
        }
    }, [ordersPage])

    // 仅在交易记录已被加载过时，才监听 txsPage 变化进行翻页
    useEffect(() => {
        if (open && girlId && transactionsLoaded) {
            loadTransactionsData()
        }
    }, [txsPage])

    async function loadData() {
        if (!girlId) return

        try {
            const accountResult = await getSettlementAccountDetail(girlId)
            if (accountResult.ok) {
                setAccount(accountResult.data!)
            }
            await loadOrdersData()
        } catch (error) {
            console.error('[AccountDialog] 加载失败:', error)
            toast.error("加载数据失败")
        }
    }

    async function loadOrdersData() {
        if (!girlId) return

        try {
            setLoadingOrders(true)
            const result = await getGirlOrderSettlements(girlId, {}, { page: ordersPage, pageSize })

            if (result.ok && result.data) {
                setOrderSettlements(result.data.data)
                setOrdersTotalPages(result.data.totalPages)
            }
        } catch (error) {
            console.error('[AccountDialog] 加载订单失败:', error)
            toast.error("加载订单记录失败")
        } finally {
            setLoadingOrders(false)
        }
    }

    async function loadTransactions() {
        if (!girlId || loadingTxs) return
        // 标记已加载，触发数据加载
        setTransactionsLoaded(true)
        setTxsPage(1) // 重置到第一页
        await loadTransactionsData()
    }

    async function loadTransactionsData() {
        if (!girlId) return

        try {
            setLoadingTxs(true)
            const result = await getGirlTransactions(girlId, {}, { page: txsPage, pageSize })

            if (!result.ok) {
                toast.error(result.error || "获取交易记录失败")
                return
            }

            if (result.data) {
                setTransactions(result.data.data)
                setTxsTotalPages(result.data.totalPages)
            }
        } catch (error) {
            console.error('[AccountDialog] 加载交易失败:', error)
            toast.error("加载交易记录失败")
        } finally {
            setLoadingTxs(false)
        }
    }

    if (!girlId) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>技师交易流水</DialogTitle>
                    <DialogDescription>
                        {account ? `${account.girls?.name || '未知'} (#${account.girls?.girl_number || '-'})` : '加载中...'}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto">
                    <Tabs defaultValue="orders" className="w-full" onValueChange={(value) => {
                        if (value === 'transactions') {
                            loadTransactions()
                        }
                    }}>
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="orders">
                                订单核验记录
                            </TabsTrigger>
                            <TabsTrigger value="transactions">
                                结账/提现记录
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="orders" className="mt-4">
                            {!account ? (
                                <TableSkeleton />
                            ) : orderSettlements.length === 0 ? (
                                <EmptyState icon={Receipt} text="暂无订单记录" />
                            ) : (
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>订单号</TableHead>
                                                <TableHead className="text-right">应得 (THB)</TableHead>
                                                <TableHead className="text-right">代收 (RMB)</TableHead>
                                                <TableHead>状态</TableHead>
                                                <TableHead>时间</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {orderSettlements.map((item) => (
                                                <TableRow key={item.id}>
                                                    <TableCell className="font-mono text-sm">
                                                        {item.orders?.order_number || '-'}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {formatCurrency(item.platform_should_get)}
                                                    </TableCell>
                                                    <TableCell className="text-right text-green-600">
                                                        {item.actual_paid_amount ? `¥${Number(item.actual_paid_amount).toFixed(2)}` : '-'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={item.settlement_status === 'settled' ? 'default' : 'secondary'}>
                                                            {item.settlement_status === 'settled' ? '已核验' : '待核验'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        {format(new Date(item.created_at), 'MM-dd HH:mm', { locale: zhCN })}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    {ordersTotalPages > 1 && (
                                        <div className="flex items-center justify-between px-4 py-3 border-t">
                                            <p className="text-sm text-muted-foreground">
                                                第 {ordersPage} 页，共 {ordersTotalPages} 页
                                            </p>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setOrdersPage(p => Math.max(1, p - 1))}
                                                    disabled={ordersPage === 1 || loadingOrders}
                                                >
                                                    <ChevronLeft className="h-4 w-4 mr-1" />
                                                    上一页
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setOrdersPage(p => Math.min(ordersTotalPages, p + 1))}
                                                    disabled={ordersPage === ordersTotalPages || loadingOrders}
                                                >
                                                    下一页
                                                    <ChevronRight className="h-4 w-4 ml-1" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="transactions" className="mt-4">
                            {loadingTxs ? (
                                <TableSkeleton />
                            ) : transactions.length === 0 ? (
                                <EmptyState icon={ArrowUpDown} text="暂无交易记录" />
                            ) : (
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>类型</TableHead>
                                                <TableHead className="text-right">金额</TableHead>
                                                <TableHead>状态</TableHead>
                                                <TableHead>时间</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {transactions.map((item) => {
                                                const typeLabels: Record<string, string> = {
                                                    settlement: '结账',
                                                    withdrawal: '提现',
                                                    adjustment: '调整',
                                                }
                                                const statusLabels: Record<string, string> = {
                                                    pending: '待审核',
                                                    confirmed: '已确认',
                                                    cancelled: '已取消',
                                                }

                                                // 根据类型显示不同的金额和币种
                                                const displayAmount = item.transaction_type === 'withdrawal'
                                                    ? `¥${Number(item.amount).toFixed(2)}`  // 提现显示RMB
                                                    : `฿${Number(item.amount).toFixed(2)}`  // 结账显示THB

                                                const amountColor = item.transaction_type === 'withdrawal'
                                                    ? 'text-orange-600'  // 提现（平台付出）橙色
                                                    : 'text-green-600'   // 结账（平台收入）绿色

                                                return (
                                                    <TableRow key={item.id}>
                                                        <TableCell>
                                                            <Badge
                                                                variant={item.transaction_type === 'withdrawal' ? 'secondary' : 'outline'}
                                                            >
                                                                {typeLabels[item.transaction_type] || item.transaction_type}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className={`text-right font-medium ${amountColor}`}>
                                                            {displayAmount}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge
                                                                variant={
                                                                    item.status === 'confirmed' ? 'default' :
                                                                        item.status === 'cancelled' ? 'destructive' :
                                                                            'secondary'
                                                                }
                                                            >
                                                                {statusLabels[item.status] || item.status}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-sm text-muted-foreground">
                                                            {format(new Date(item.created_at), 'MM-dd HH:mm', { locale: zhCN })}
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                    {txsTotalPages > 1 && (
                                        <div className="flex items-center justify-between px-4 py-3 border-t">
                                            <p className="text-sm text-muted-foreground">
                                                第 {txsPage} 页，共 {txsTotalPages} 页
                                            </p>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setTxsPage(p => Math.max(1, p - 1))}
                                                    disabled={txsPage === 1 || loadingTxs}
                                                >
                                                    <ChevronLeft className="h-4 w-4 mr-1" />
                                                    上一页
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setTxsPage(p => Math.min(txsTotalPages, p + 1))}
                                                    disabled={txsPage === txsTotalPages || loadingTxs}
                                                >
                                                    下一页
                                                    <ChevronRight className="h-4 w-4 ml-1" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function TableSkeleton() {
    return (
        <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
            ))}
        </div>
    )
}

function EmptyState({ icon: Icon, text }: { icon: any, text: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Icon className="size-12 mb-3 opacity-50" />
            <p className="text-sm">{text}</p>
        </div>
    )
}
