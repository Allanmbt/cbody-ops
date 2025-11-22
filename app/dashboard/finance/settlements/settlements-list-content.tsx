"use client"

/**
 * 订单核验列表页面 - 轻量实用版
 * 使用弹窗展示详情，标签页切换状态，支持批量操作和排序
 */

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Receipt, Calendar, CheckCircle, Clock, ListChecks, Edit } from "lucide-react"
import { getGirlOrderSettlements, getFinanceStats, getOrderSettlementDetail, updateOrderSettlementPayment, markSettlementAsSettled } from "@/lib/features/finance/actions"
import type { OrderSettlementWithDetails, FinanceStats } from "@/lib/features/finance"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"

type SortField = 'girl_name' | 'created_at'
type SortOrder = 'asc' | 'desc'

export function SettlementsListContent() {
    const [settlements, setSettlements] = useState<OrderSettlementWithDetails[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [statusFilter, setStatusFilter] = useState<"pending" | "settled">("pending") // 默认待结算
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const pageSize = 20

    // 统计数据
    const [stats, setStats] = useState<FinanceStats | null>(null)
    const [statsLoading, setStatsLoading] = useState(true)

    // 排序
    const [sortField, setSortField] = useState<SortField>('created_at')
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

    // 批量选择
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [batchSettling, setBatchSettling] = useState(false)

    // 详情弹窗
    const [detailOpen, setDetailOpen] = useState(false)
    const [selectedSettlement, setSelectedSettlement] = useState<OrderSettlementWithDetails | null>(null)
    const [detailLoading, setDetailLoading] = useState(false)

    // 编辑支付信息
    const [editPaymentOpen, setEditPaymentOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const [customerPaidToPlatform, setCustomerPaidToPlatform] = useState('')
    const [actualPaidAmount, setActualPaidAmount] = useState('')
    const [paymentContentType, setPaymentContentType] = useState<string>('')
    const [paymentMethod, setPaymentMethod] = useState<string>('')
    const [paymentNotes, setPaymentNotes] = useState('')

    // 单独结算状态切换
    const [toggleStatusOpen, setToggleStatusOpen] = useState(false)
    const [toggling, setToggling] = useState(false)

    // 批量核验确认
    const [batchConfirmOpen, setBatchConfirmOpen] = useState(false)

    useEffect(() => {
        loadStats()
        loadSettlements()
    }, [page, statusFilter])

    async function loadStats() {
        try {
            setStatsLoading(true)
            const result = await getFinanceStats()
            if (result.ok) {
                setStats(result.data!)
            }
        } catch (error) {
            console.error('[Stats] 加载统计数据失败:', error)
        } finally {
            setStatsLoading(false)
        }
    }

    async function loadSettlements() {
        try {
            setLoading(true)
            setSelectedIds(new Set()) // 重置选择
            const result = await getGirlOrderSettlements(
                undefined, // undefined 表示不限定技师
                {
                    status: statusFilter,
                    order_number: searchTerm || undefined,
                },
                { page, pageSize }
            )

            if (!result.ok) {
                toast.error(result.error || "获取订单结算列表失败")
                return
            }

            setSettlements(result.data!.data)
            setTotalPages(result.data!.totalPages)
        } catch (error) {
            console.error('[SettlementsList] 加载失败:', error)
            toast.error("加载订单结算列表失败")
        } finally {
            setLoading(false)
        }
    }

    function handleRefresh() {
        loadStats()
        loadSettlements()
    }

    async function loadSettlementDetail(settlementId: string) {
        try {
            setDetailLoading(true)
            const result = await getOrderSettlementDetail(settlementId)
            if (result.ok) {
                setSelectedSettlement(result.data!)
                // 初始化编辑表单
                setCustomerPaidToPlatform(String(result.data!.customer_paid_to_platform || 0))
                setActualPaidAmount(String((result.data! as any).actual_paid_amount || ''))
                setPaymentContentType(result.data!.payment_content_type || 'null')
                setPaymentMethod(result.data!.payment_method || 'null')
                setPaymentNotes(result.data!.payment_notes || '')
            } else {
                toast.error(result.error || '加载详情失败')
            }
        } catch (error) {
            console.error('[LoadDetail] 失败:', error)
            toast.error('加载详情失败')
        } finally {
            setDetailLoading(false)
        }
    }

    // 计算今日和昨日的时间范围（与后端逻辑一致）
    const getTimeRanges = () => {
        const now = new Date()

        // 获取泰国当前时间（UTC+7）
        const bangkokTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))

        // 计算今日6点（泰国时间）
        const todayStart = new Date(bangkokTime)
        todayStart.setHours(6, 0, 0, 0)

        // 如果当前时间还没到今天6点，今日6点应该是昨天的6点
        if (bangkokTime.getHours() < 6) {
            todayStart.setDate(todayStart.getDate() - 1)
        }

        // 昨日6点
        const yesterdayStart = new Date(todayStart)
        yesterdayStart.setDate(yesterdayStart.getDate() - 1)

        return { todayStart, yesterdayStart }
    }

    // 判断订单是今日还是昨日创建
    const getOrderTimeLabel = (createdAt: string) => {
        const { todayStart, yesterdayStart } = getTimeRanges()
        const orderTime = new Date(createdAt)

        if (orderTime >= todayStart) {
            return 'today'
        } else if (orderTime >= yesterdayStart && orderTime < todayStart) {
            return 'yesterday'
        }
        return 'older'
    }

    // 排序和筛选
    const filteredAndSortedSettlements = settlements
        .filter(settlement => {
            if (!searchTerm) return true
            const orderNumber = settlement.orders?.order_number?.toLowerCase() || ""
            const girlName = settlement.girls?.name?.toLowerCase() || ""
            const girlNumber = String(settlement.girls?.girl_number || "").toLowerCase()
            const search = searchTerm.toLowerCase()
            return orderNumber.includes(search) || girlName.includes(search) || girlNumber.includes(search)
        })
        .sort((a, b) => {
            let compareValue = 0

            if (sortField === 'girl_name') {
                const nameA = a.girls?.name || ''
                const nameB = b.girls?.name || ''
                compareValue = nameA.localeCompare(nameB, 'zh-CN')
            } else if (sortField === 'created_at') {
                const dateA = new Date(a.created_at).getTime()
                const dateB = new Date(b.created_at).getTime()
                compareValue = dateA - dateB
            }

            return sortOrder === 'asc' ? compareValue : -compareValue
        })

    // 切换排序
    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortOrder('desc')
        }
    }

    // 批量选择
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const allIds = new Set(filteredAndSortedSettlements.map(s => s.id))
            setSelectedIds(allIds)
        } else {
            setSelectedIds(new Set())
        }
    }

    const handleSelectOne = (id: string, checked: boolean) => {
        const newSelected = new Set(selectedIds)
        if (checked) {
            newSelected.add(id)
        } else {
            newSelected.delete(id)
        }
        setSelectedIds(newSelected)
    }

    // 批量标记已核验
    const handleBatchSettle = async () => {
        if (selectedIds.size === 0) {
            toast.error('请先选择要核验的订单')
            return
        }

        setBatchSettling(true)
        let successCount = 0
        let failCount = 0

        for (const id of Array.from(selectedIds)) {
            const result = await markSettlementAsSettled({ settlement_id: id })
            if (result.ok) {
                successCount++
            } else {
                failCount++
            }
        }

        setBatchSettling(false)

        if (failCount === 0) {
            toast.success(`成功标记 ${successCount} 条订单为已核验`)
        } else {
            toast.warning(`成功 ${successCount} 条，失败 ${failCount} 条`)
        }

        setSelectedIds(new Set())
        loadStats()
        loadSettlements()
    }

    return (
        <div className="flex flex-col gap-6">
            {/* 标题 */}
            <div>
                <h1 className="text-3xl font-bold">订单核验</h1>
                <p className="text-muted-foreground mt-1">
                    管理订单核验明细
                </p>
            </div>

            {/* 统计卡片 */}
            <div className="grid gap-4 md:grid-cols-4">
                {/* 待核验订单 */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">待核验订单</CardTitle>
                        <ListChecks className="size-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {statsLoading ? (
                            <Skeleton className="h-9 w-20" />
                        ) : (
                            <>
                                <div className="text-2xl font-bold">{stats?.pending_settlements_count || 0}</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    待核验订单数
                                </p>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* 今日未核验 */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">今日未核验</CardTitle>
                        <Calendar className="size-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {statsLoading ? (
                            <Skeleton className="h-9 w-20" />
                        ) : (
                            <>
                                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                                    {stats?.today_pending_count || 0}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    今日6:00-明日6:00
                                </p>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* 昨日未核验 */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">昨日未核验</CardTitle>
                        <Calendar className="size-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {statsLoading ? (
                            <Skeleton className="h-9 w-20" />
                        ) : (
                            <>
                                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                    {stats?.yesterday_pending_count || 0}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    昨日6:00-今日6:00
                                </p>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* 更早未核验 */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">更早未核验</CardTitle>
                        <Calendar className="size-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {statsLoading ? (
                            <Skeleton className="h-9 w-20" />
                        ) : (
                            <>
                                <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                                    {stats?.older_pending_count || 0}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    昨日6:00之前
                                </p>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* 标签页切换 + 搜索 */}
            <Tabs value={statusFilter} onValueChange={(value: any) => {
                setStatusFilter(value)
                setPage(1)
            }}>
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
                    <TabsList>
                        <TabsTrigger value="pending" className="gap-2">
                            <Clock className="size-4" />
                            待核验
                        </TabsTrigger>
                        <TabsTrigger value="settled" className="gap-2">
                            <CheckCircle className="size-4" />
                            已核验
                        </TabsTrigger>
                    </TabsList>

                    <div className="flex gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-[300px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                            <Input
                                placeholder="搜索订单号/技师名称/工号..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Button
                            variant="outline"
                            onClick={handleRefresh}
                        >
                            刷新
                        </Button>
                    </div>
                </div>

                {/* 列表内容 */}
                <TabsContent value={statusFilter} className="mt-0">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Receipt className="size-5" />
                                订单核验列表
                                {!loading && (
                                    <Badge variant="secondary">
                                        共 {filteredAndSortedSettlements.length} 条
                                    </Badge>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {/* 批量操作栏 */}
                            {statusFilter === 'pending' && filteredAndSortedSettlements.length > 0 && (
                                <div className="flex items-center gap-2 mb-4 p-3 bg-muted/50 rounded-lg">
                                    <Checkbox
                                        checked={selectedIds.size === filteredAndSortedSettlements.length && filteredAndSortedSettlements.length > 0}
                                        onCheckedChange={handleSelectAll}
                                    />
                                    <span className="text-sm text-muted-foreground">
                                        已选择 {selectedIds.size} 条
                                    </span>
                                    {selectedIds.size > 0 && (
                                        <Button
                                            size="sm"
                                            onClick={() => setBatchConfirmOpen(true)}
                                            disabled={batchSettling}
                                            className="ml-auto"
                                        >
                                            {batchSettling ? '处理中...' : `批量标记已核验 (${selectedIds.size})`}
                                        </Button>
                                    )}
                                </div>
                            )}

                            {loading ? (
                                <SettlementsTableSkeleton />
                            ) : filteredAndSortedSettlements.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <Receipt className="size-12 text-muted-foreground mb-4" />
                                    <p className="text-muted-foreground">暂无订单核验记录</p>
                                </div>
                            ) : (
                                <>
                                    <div className="rounded-md border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    {statusFilter === 'pending' && (
                                                        <TableHead className="w-12">
                                                            <Checkbox
                                                                checked={selectedIds.size === filteredAndSortedSettlements.length && filteredAndSortedSettlements.length > 0}
                                                                onCheckedChange={handleSelectAll}
                                                            />
                                                        </TableHead>
                                                    )}
                                                    <TableHead>订单号</TableHead>
                                                    <TableHead>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 px-2 hover:bg-transparent"
                                                            onClick={() => handleSort('girl_name')}
                                                        >
                                                            技师
                                                            {sortField === 'girl_name' && (
                                                                sortOrder === 'asc' ?
                                                                    <ArrowUp className="ml-1 size-3" /> :
                                                                    <ArrowDown className="ml-1 size-3" />
                                                            )}
                                                            {sortField !== 'girl_name' && <ArrowUpDown className="ml-1 size-3 opacity-50" />}
                                                        </Button>
                                                    </TableHead>
                                                    <TableHead className="text-right">服务费</TableHead>
                                                    <TableHead className="text-right">平台应得</TableHead>
                                                    <TableHead className="text-right">顾客已付</TableHead>
                                                    <TableHead className="text-right">结算金额</TableHead>
                                                    <TableHead>支付方式</TableHead>
                                                    <TableHead>状态</TableHead>
                                                    <TableHead>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 px-2 hover:bg-transparent"
                                                            onClick={() => handleSort('created_at')}
                                                        >
                                                            创建时间
                                                            {sortField === 'created_at' && (
                                                                sortOrder === 'asc' ?
                                                                    <ArrowUp className="ml-1 size-3" /> :
                                                                    <ArrowDown className="ml-1 size-3" />
                                                            )}
                                                            {sortField !== 'created_at' && <ArrowUpDown className="ml-1 size-3 opacity-50" />}
                                                        </Button>
                                                    </TableHead>
                                                    <TableHead className="text-right">操作</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredAndSortedSettlements.map((settlement) => {
                                                    const settlementAmount = Number(settlement.settlement_amount)
                                                    const amountColor = settlementAmount > 0
                                                        ? 'text-red-600 dark:text-red-400'
                                                        : settlementAmount < 0
                                                            ? 'text-green-600 dark:text-green-400'
                                                            : 'text-muted-foreground'

                                                    const timeLabel = getOrderTimeLabel(settlement.created_at)

                                                    return (
                                                        <TableRow key={settlement.id}>
                                                            {statusFilter === 'pending' && (
                                                                <TableCell>
                                                                    <Checkbox
                                                                        checked={selectedIds.has(settlement.id)}
                                                                        onCheckedChange={(checked) => handleSelectOne(settlement.id, checked as boolean)}
                                                                    />
                                                                </TableCell>
                                                            )}
                                                            <TableCell className="font-medium">
                                                                {settlement.orders?.order_number || '-'}
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex items-center gap-3">
                                                                    <Avatar className="size-8">
                                                                        <AvatarImage src={(settlement.girls as any)?.avatar_url} />
                                                                        <AvatarFallback>{settlement.girls?.name?.charAt(0)}</AvatarFallback>
                                                                    </Avatar>
                                                                    <div className="flex flex-col">
                                                                        <span className="font-medium">{settlement.girls?.name}</span>
                                                                        <span className="text-xs text-muted-foreground">
                                                                            #{settlement.girls?.girl_number}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <div className="flex flex-col items-end">
                                                                    <span>{formatCurrency(settlement.service_fee)}</span>
                                                                    <span className="text-xs text-muted-foreground">
                                                                        平台提成 {(Number(settlement.service_commission_rate) * 100).toFixed(0)}%
                                                                    </span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                {formatCurrency(settlement.platform_should_get)}
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                {formatCurrency(settlement.customer_paid_to_platform)}
                                                            </TableCell>
                                                            <TableCell className={`text-right font-semibold ${amountColor}`}>
                                                                {formatCurrency(settlement.settlement_amount)}
                                                            </TableCell>
                                                            <TableCell>
                                                                {settlement.payment_content_type ? (
                                                                    <div className="flex flex-col gap-1">
                                                                        <Badge variant="outline" className="w-fit">
                                                                            {settlement.payment_content_type === 'deposit' && '定金'}
                                                                            {settlement.payment_content_type === 'full_amount' && '全款'}
                                                                            {settlement.payment_content_type === 'tip' && '小费'}
                                                                            {settlement.payment_content_type === 'other' && '其他'}
                                                                        </Badge>
                                                                        {settlement.payment_method && (
                                                                            <span className="text-xs text-muted-foreground">
                                                                                {settlement.payment_method === 'wechat' && '微信'}
                                                                                {settlement.payment_method === 'alipay' && '支付宝'}
                                                                                {settlement.payment_method === 'thb_bank_transfer' && '泰铢转账'}
                                                                                {settlement.payment_method === 'credit_card' && '信用卡'}
                                                                                {settlement.payment_method === 'cash' && '现金'}
                                                                                {settlement.payment_method === 'other' && '其他'}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <Badge variant="secondary">技师收款</Badge>
                                                                )}
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex flex-col gap-1">
                                                                    {settlement.settlement_status === 'pending' ? (
                                                                        <Badge variant="outline" className="gap-1">
                                                                            <Clock className="size-3" />
                                                                            待核验
                                                                        </Badge>
                                                                    ) : (
                                                                        <Badge variant="default" className="gap-1">
                                                                            <CheckCircle className="size-3" />
                                                                            已核验
                                                                        </Badge>
                                                                    )}
                                                                    {settlement.settlement_status === 'pending' && timeLabel === 'today' && (
                                                                        <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                                                                            今日
                                                                        </Badge>
                                                                    )}
                                                                    {settlement.settlement_status === 'pending' && timeLabel === 'yesterday' && (
                                                                        <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                                                            昨日
                                                                        </Badge>
                                                                    )}
                                                                    {settlement.settlement_status === 'pending' && timeLabel === 'older' && (
                                                                        <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
                                                                            更早
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-sm text-muted-foreground">
                                                                {format(new Date(settlement.created_at), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={async () => {
                                                                        setSelectedSettlement(settlement)
                                                                        setDetailOpen(true)
                                                                        await loadSettlementDetail(settlement.id)
                                                                    }}
                                                                >
                                                                    <Receipt className="mr-1 size-4" />
                                                                    查看
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    )
                                                })}
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
                </TabsContent>
            </Tabs>

            {/* 详情弹窗 */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>订单核验详情</DialogTitle>
                        <DialogDescription>
                            查看和编辑核验信息
                        </DialogDescription>
                    </DialogHeader>

                    {detailLoading ? (
                        <div className="py-12 text-center text-muted-foreground">加载中...</div>
                    ) : selectedSettlement ? (
                        <div className="space-y-4">
                            {/* 基本信息 */}
                            <div className="grid gap-4 md:grid-cols-2">
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm">订单信息</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">订单号</span>
                                            <span className="font-medium">{selectedSettlement.orders?.order_number}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">完成时间</span>
                                            <span>{selectedSettlement.orders?.completed_at ? format(new Date(selectedSettlement.orders.completed_at), 'yyyy-MM-dd HH:mm', { locale: zhCN }) : '-'}</span>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm">技师信息</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2 text-sm">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="size-10">
                                                <AvatarImage src={(selectedSettlement.girls as any)?.avatar_url} />
                                                <AvatarFallback>{selectedSettlement.girls?.name?.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="font-medium">{selectedSettlement.girls?.name}</p>
                                                <p className="text-xs text-muted-foreground">#{selectedSettlement.girls?.girl_number}</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* 核验明细 */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm">核验明细</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">服务费</span>
                                        <span>{formatCurrency(selectedSettlement.service_fee)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">额外费用</span>
                                        <span>{formatCurrency(selectedSettlement.extra_fee)}</span>
                                    </div>
                                    <Separator />
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">平台应得</span>
                                        <span className="font-medium">{formatCurrency(selectedSettlement.platform_should_get)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">顾客已付平台</span>
                                        <span>{formatCurrency(selectedSettlement.customer_paid_to_platform)}</span>
                                    </div>
                                    <Separator />
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">最终核验金额</span>
                                        <span className={`font-bold text-lg ${Number(selectedSettlement.settlement_amount) < 0 ? 'text-red-600' :
                                            Number(selectedSettlement.settlement_amount) > 0 ? 'text-green-600' : ''
                                            }`}>
                                            {formatCurrency(selectedSettlement.settlement_amount)}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* 操作按钮 */}
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setEditPaymentOpen(true)} className="gap-2">
                                    <Edit className="size-4" />
                                    编辑支付信息
                                </Button>
                                {selectedSettlement.settlement_status === 'pending' && (
                                    <Button variant="outline" onClick={() => setToggleStatusOpen(true)} className="gap-2">
                                        <CheckCircle className="size-4" />
                                        标记已核验
                                    </Button>
                                )}
                            </div>
                        </div>
                    ) : null}
                </DialogContent>
            </Dialog>

            {/* 编辑支付信息弹窗 */}
            <Dialog open={editPaymentOpen} onOpenChange={setEditPaymentOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>编辑支付信息</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>顾客已付平台（泰铢）</Label>
                            <Input
                                type="number"
                                value={customerPaidToPlatform}
                                onChange={(e) => setCustomerPaidToPlatform(e.target.value)}
                                placeholder="500"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>实付金额（如人民币）</Label>
                            <Input
                                type="number"
                                value={actualPaidAmount}
                                onChange={(e) => setActualPaidAmount(e.target.value)}
                                placeholder="100"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>支付内容类型</Label>
                            <Select value={paymentContentType} onValueChange={setPaymentContentType}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="null">技师自己收款</SelectItem>
                                    <SelectItem value="deposit">定金</SelectItem>
                                    <SelectItem value="full_amount">全款</SelectItem>
                                    <SelectItem value="tip">小费</SelectItem>
                                    <SelectItem value="other">其他</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>支付方式</Label>
                            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="null">未指定</SelectItem>
                                    <SelectItem value="wechat">微信</SelectItem>
                                    <SelectItem value="alipay">支付宝</SelectItem>
                                    <SelectItem value="thb_bank_transfer">泰铢转账</SelectItem>
                                    <SelectItem value="credit_card">信用卡</SelectItem>
                                    <SelectItem value="cash">现金</SelectItem>
                                    <SelectItem value="other">其他</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>备注</Label>
                            <Textarea
                                value={paymentNotes}
                                onChange={(e) => setPaymentNotes(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditPaymentOpen(false)}>取消</Button>
                        <Button onClick={async () => {
                            if (!selectedSettlement) return
                            setSaving(true)
                            const result = await updateOrderSettlementPayment({
                                settlement_id: selectedSettlement.id,
                                customer_paid_to_platform: customerPaidToPlatform ? Number(customerPaidToPlatform) : undefined,
                                actual_paid_amount: actualPaidAmount ? Number(actualPaidAmount) : null,
                                payment_content_type: paymentContentType === 'null' ? null : paymentContentType as any,
                                payment_method: paymentMethod === 'null' ? null : paymentMethod as any,
                                payment_notes: paymentNotes || null,
                            })
                            setSaving(false)
                            if (result.ok) {
                                toast.success('保存成功')
                                setEditPaymentOpen(false)
                                await loadSettlementDetail(selectedSettlement.id)
                                loadSettlements()
                            } else {
                                toast.error(result.error || '保存失败')
                            }
                        }} disabled={saving}>
                            {saving ? '保存中...' : '保存'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 单个标记已核验确认 */}
            <AlertDialog open={toggleStatusOpen} onOpenChange={setToggleStatusOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>确认标记为已核验？</AlertDialogTitle>
                        <AlertDialogDescription>
                            此操作仅确认订单信息已核验，不会影响技师账户余额。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={async () => {
                            if (!selectedSettlement) return
                            setToggling(true)
                            const result = await markSettlementAsSettled({ settlement_id: selectedSettlement.id })
                            setToggling(false)
                            if (result.ok) {
                                toast.success('已标记为已核验')
                                setToggleStatusOpen(false)
                                setDetailOpen(false)
                                loadStats()
                                loadSettlements()
                            } else {
                                toast.error(result.error || '操作失败')
                            }
                        }} disabled={toggling}>
                            {toggling ? '处理中...' : '确认'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* 批量标记已核验确认 */}
            <AlertDialog open={batchConfirmOpen} onOpenChange={setBatchConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>确认批量标记为已核验？</AlertDialogTitle>
                        <AlertDialogDescription>
                            即将标记 <span className="font-bold text-foreground">{selectedIds.size}</span> 条订单为已核验。
                            <br />
                            此操作仅确认订单信息，不会影响技师账户余额。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={async () => {
                                setBatchConfirmOpen(false)
                                await handleBatchSettle()
                            }}
                            disabled={batchSettling}
                        >
                            确认批量核验
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

function SettlementsTableSkeleton() {
    return (
        <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
            ))}
        </div>
    )
}
