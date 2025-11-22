"use client"

/**
 * 技师交易流水弹窗
 * 轻量级：只显示订单核验记录和结账/提现记录
 */

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
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

    useEffect(() => {
        if (open && girlId) {
            loadData()
        } else {
            // 关闭时清空数据
            setAccount(null)
            setOrderSettlements([])
            setTransactions([])
        }
    }, [open, girlId])

    async function loadData() {
        if (!girlId) return

        try {
            // 并行加载账户信息和订单记录
            const [accountResult, ordersResult] = await Promise.all([
                getSettlementAccountDetail(girlId),
                getGirlOrderSettlements(girlId, {}, { page: 1, pageSize: 50 })
            ])

            if (accountResult.ok) {
                setAccount(accountResult.data!)
            }

            if (ordersResult.ok) {
                setOrderSettlements(ordersResult.data!.data)
            }
        } catch (error) {
            console.error('[AccountDialog] 加载失败:', error)
            toast.error("加载数据失败")
        }
    }

    async function loadTransactions() {
        if (!girlId || transactions.length > 0 || loadingTxs) return

        try {
            setLoadingTxs(true)
            const result = await getGirlTransactions(girlId, {}, { page: 1, pageSize: 50 })

            if (!result.ok) {
                toast.error(result.error || "获取交易记录失败")
                return
            }

            setTransactions(result.data!.data)
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
                    <Tabs defaultValue="orders" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="orders">
                                订单核验记录
                            </TabsTrigger>
                            <TabsTrigger value="transactions" onClick={loadTransactions}>
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
                                                    deposit: '定金',
                                                    settlement: '结账',
                                                    withdrawal: '提现',
                                                    adjustment: '调整',
                                                }
                                                const statusLabels: Record<string, string> = {
                                                    pending: '待审核',
                                                    confirmed: '已确认',
                                                    rejected: '已拒绝',
                                                }

                                                return (
                                                    <TableRow key={item.id}>
                                                        <TableCell>
                                                            <Badge variant="outline">
                                                                {typeLabels[item.transaction_type] || item.transaction_type}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right font-medium">
                                                            {formatCurrency(item.amount)}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge
                                                                variant={
                                                                    item.approval_status === 'approved' ? 'default' :
                                                                        item.approval_status === 'rejected' ? 'destructive' :
                                                                            'secondary'
                                                                }
                                                            >
                                                                {statusLabels[item.approval_status] || item.approval_status}
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
