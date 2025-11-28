"use client"

/**
 * 财务日订单核验页面
 * 严格按照 SETTLEMENT_ACCOUNT_DESIGN.md 模块3设计实现
 */

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { Calendar, CheckCircle, Clock, FileText, RefreshCw, Download, Edit, Search, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Loader2, X, AlertTriangle, ImageIcon, Copy } from "lucide-react"
import { getGirlOrderSettlements, getFinanceDayStats, getOrderSettlementDetail, updateOrderSettlementPayment, markSettlementAsSettled, getOrderPaymentData, rejectOrderSettlement } from "@/lib/features/finance/actions"
import type { OrderSettlementWithDetails, OrderPaymentPageData, OrderPlatformPayment } from "@/lib/features/finance"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import { format, subDays } from "date-fns"
import { zhCN } from "date-fns/locale"
import Image from "next/image"

type FiscalDateOption = 'today' | 'yesterday' | 'day_before_yesterday'
type SortField = 'girl_name' | 'created_at' | 'service_fee' | 'platform_should_get' | null
type SortOrder = 'asc' | 'desc'

/**
 * 计算泰国时区财务日时间范围
 * 财务日：泰国时间 06:00 - 次日 06:00
 * 返回 UTC 时间的 ISO 字符串用于数据库查询
 */
function getFiscalDateRange(option: FiscalDateOption) {
    // 泰国时区 UTC+7，6点对应 UTC 的前一天 23:00
    // 例如：泰国时间 2024-01-15 06:00 = UTC 2024-01-14 23:00

    const now = new Date()

    // 获取当前 UTC 时间
    const utcYear = now.getUTCFullYear()
    const utcMonth = now.getUTCMonth()
    const utcDate = now.getUTCDate()
    const utcHours = now.getUTCHours()

    // 计算泰国当前时间（UTC+7）
    const bangkokHours = utcHours + 7
    let bangkokDate = utcDate
    let bangkokMonth = utcMonth
    let bangkokYear = utcYear

    // 处理跨日
    if (bangkokHours >= 24) {
        bangkokDate += 1
        // 简化处理，使用 Date 对象来处理月份溢出
        const tempDate = new Date(Date.UTC(bangkokYear, bangkokMonth, bangkokDate))
        bangkokYear = tempDate.getUTCFullYear()
        bangkokMonth = tempDate.getUTCMonth()
        bangkokDate = tempDate.getUTCDate()
    }

    // 确定今日财务日的开始日期（泰国日期）
    // 如果泰国时间还没到6点，今日财务日从昨天开始
    let fiscalDateBangkok = bangkokDate
    if ((bangkokHours % 24) < 6) {
        fiscalDateBangkok -= 1
    }

    // 根据选项调整
    switch (option) {
        case 'today':
            // 今日财务日
            break
        case 'yesterday':
            // 昨日财务日
            fiscalDateBangkok -= 1
            break
        case 'day_before_yesterday':
            // 前日财务日
            fiscalDateBangkok -= 2
            break
    }

    // 使用 Date 对象处理日期溢出
    const fiscalStartBangkok = new Date(Date.UTC(bangkokYear, bangkokMonth, fiscalDateBangkok, 6, 0, 0, 0))
    const fiscalEndBangkok = new Date(Date.UTC(bangkokYear, bangkokMonth, fiscalDateBangkok + 1, 6, 0, 0, 0))

    // 泰国时间转 UTC：减去7小时
    const startUTC = new Date(fiscalStartBangkok.getTime() - 7 * 60 * 60 * 1000)
    const endUTC = new Date(fiscalEndBangkok.getTime() - 7 * 60 * 60 * 1000)

    return {
        startISO: startUTC.toISOString(),
        endISO: endUTC.toISOString(),
    }
}

function SettlementsTableSkeleton() {
    return (
        <div className="rounded-md border overflow-hidden">
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12">
                                <Skeleton className="h-4 w-4" />
                            </TableHead>
                            <TableHead>订单号</TableHead>
                            <TableHead>技师</TableHead>
                            <TableHead className="text-right">服务费/提成</TableHead>
                            <TableHead className="text-right">平台应得</TableHead>
                            <TableHead className="text-right">代收(RMB)</TableHead>
                            <TableHead>状态</TableHead>
                            <TableHead>创建时间</TableHead>
                            <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {[...Array(5)].map((_, i) => (
                            <TableRow key={i}>
                                <TableCell>
                                    <Skeleton className="h-4 w-4" />
                                </TableCell>
                                <TableCell>
                                    <Skeleton className="h-4 w-32" />
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Skeleton className="h-8 w-8 rounded-full" />
                                        <div className="flex flex-col gap-1">
                                            <Skeleton className="h-4 w-16" />
                                            <Skeleton className="h-3 w-12" />
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex flex-col gap-1 items-end">
                                        <Skeleton className="h-4 w-20" />
                                        <Skeleton className="h-3 w-10" />
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Skeleton className="h-4 w-20" />
                                </TableCell>
                                <TableCell className="text-right">
                                    <Skeleton className="h-4 w-16" />
                                </TableCell>
                                <TableCell>
                                    <Skeleton className="h-6 w-16" />
                                </TableCell>
                                <TableCell>
                                    <Skeleton className="h-4 w-24" />
                                </TableCell>
                                <TableCell className="text-right">
                                    <Skeleton className="h-8 w-12" />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}

export function SettlementsListContent() {
    const [allSettlements, setAllSettlements] = useState<OrderSettlementWithDetails[]>([])
    const [loading, setLoading] = useState(true)

    // 财务日选择
    const [fiscalDate, setFiscalDate] = useState<FiscalDateOption>('yesterday')

    // 搜索
    const [searchInput, setSearchInput] = useState('') // 输入框的值（实时更新）

    // 筛选
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [platformCollectedFilter, setPlatformCollectedFilter] = useState<string>('all')

    // 排序
    const [sortField, setSortField] = useState<SortField>(null)
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

    // 分页状态
    const [page, setPage] = useState(1)
    const pageSize = 20

    // 统计数据
    const [dayStats, setDayStats] = useState<{
        settlement_total_count: number
        pending_count: number
        settled_count: number
        platform_should_get_total: number
        actual_paid_total: number
    } | null>(null)
    const [statsLoading, setStatsLoading] = useState(true)

    // 批量选择
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [batchSettling, setBatchSettling] = useState(false)

    // 编辑弹窗
    const [editPaymentOpen, setEditPaymentOpen] = useState(false)
    const [selectedSettlement, setSelectedSettlement] = useState<OrderSettlementWithDetails | null>(null)
    const [detailLoading, setDetailLoading] = useState(false)

    // 编辑表单
    const [saving, setSaving] = useState(false)
    const [actualPaidAmount, setActualPaidAmount] = useState('')
    const [paymentNotes, setPaymentNotes] = useState('')
    const [platformShouldGet, setPlatformShouldGet] = useState('')
    const [notes, setNotes] = useState('')

    // 批量核验确认
    const [batchConfirmOpen, setBatchConfirmOpen] = useState(false)

    // 收款记录数据
    const [paymentData, setPaymentData] = useState<OrderPaymentPageData | null>(null)
    const [paymentDataLoading, setPaymentDataLoading] = useState(false)

    // 拒绝弹窗
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
    const [rejectReason, setRejectReason] = useState('')
    const [rejecting, setRejecting] = useState(false)

    // 图片预览
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)

    // 获取当前财务日时间范围
    const { startISO, endISO } = getFiscalDateRange(fiscalDate)

    // 加载统计数据
    const loadStats = useCallback(async () => {
        try {
            setStatsLoading(true)
            const result = await getFinanceDayStats(startISO, endISO)
            if (result.ok) {
                setDayStats(result.data!)
            }
        } catch (error) {
            console.error('加载统计数据失败', error)
        } finally {
            setStatsLoading(false)
        }
    }, [startISO, endISO])

    // 加载订单列表（只在财务日变化时加载全部数据）
    const loadSettlements = useCallback(async () => {
        try {
            setLoading(true)
            setSelectedIds(new Set())

            // 一次性加载当前财务日的所有数据（不分页）
            const result = await getGirlOrderSettlements(
                undefined,
                {
                    completed_at_from: startISO,
                    completed_at_to: endISO,
                },
                { page: 1, pageSize: 9999 }
            )

            if (!result.ok) {
                toast.error(result.error || "获取订单结算列表失败")
                return
            }

            setAllSettlements(result.data!.data)
        } catch (error) {
            console.error('加载失败', error)
            toast.error("加载订单结算列表失败")
        } finally {
            setLoading(false)
        }
    }, [startISO, endISO])

    // 财务日变化时加载数据
    useEffect(() => {
        loadStats()
        loadSettlements()
    }, [loadStats, loadSettlements])

    // 筛选条件变化时重置到第一页
    useEffect(() => {
        setPage(1)
    }, [searchInput, statusFilter, platformCollectedFilter])

    // 刷新按钮：同时刷新统计和列表
    function handleRefresh() {
        loadStats()
        loadSettlements()
    }

    // 搜索（实时响应）
    const handleSearch = (value: string) => {
        setSearchInput(value)
    }

    // 状态筛选
    const handleStatusFilter = (value: string) => {
        setStatusFilter(value)
    }

    // 平台代收筛选
    const handlePlatformCollectedFilter = (value: string) => {
        setPlatformCollectedFilter(value)
    }

    // 排序切换
    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortOrder('asc')
        }
        setPage(1)
    }

    const getSortIcon = (field: SortField) => {
        if (sortField !== field) {
            return <ArrowUpDown className="size-3 ml-1 opacity-50" />
        }
        return sortOrder === 'asc'
            ? <ArrowUp className="size-3 ml-1" />
            : <ArrowDown className="size-3 ml-1" />
    }

    async function loadSettlementDetail(settlementId: string) {
        try {
            setDetailLoading(true)
            const result = await getOrderSettlementDetail(settlementId)
            if (result.ok) {
                const settlement = result.data!
                setSelectedSettlement(settlement)
                setActualPaidAmount(String((settlement as any).actual_paid_amount || ''))
                setPaymentNotes(settlement.payment_notes || '')
                setPlatformShouldGet(String(settlement.platform_should_get || ''))
                setNotes(settlement.notes || '')

                // 同时加载收款记录数据
                if (settlement.orders?.id) {
                    setPaymentDataLoading(true)
                    const paymentResult = await getOrderPaymentData(settlement.orders.id)
                    if (paymentResult.ok) {
                        setPaymentData(paymentResult.data!)

                        // 自动填充代收金额（如果当前为空且有收款记录）
                        if (!actualPaidAmount && paymentResult.data!.summary.total_amount > 0) {
                            setActualPaidAmount(String(paymentResult.data!.summary.total_amount))
                        }
                    }
                    setPaymentDataLoading(false)
                }
            } else {
                toast.error(result.error || '加载详情失败')
            }
        } catch (error) {
            console.error('加载详情失败', error)
            toast.error('加载详情失败')
        } finally {
            setDetailLoading(false)
        }
    }

    // 前端筛选和排序
    const filteredAndSortedSettlements = allSettlements
        .filter(settlement => {
            // 搜索筛选
            if (searchInput) {
                const searchLower = searchInput.toLowerCase()
                const orderNumber = settlement.orders?.order_number?.toLowerCase() || ''
                const girlName = settlement.girls?.name?.toLowerCase() || ''
                const girlNumber = settlement.girls?.girl_number?.toString() || ''

                if (!orderNumber.includes(searchLower) &&
                    !girlName.includes(searchLower) &&
                    !girlNumber.includes(searchInput)) {
                    return false
                }
            }

            // 状态筛选
            if (statusFilter !== 'all' && settlement.settlement_status !== statusFilter) {
                return false
            }

            // 平台代收筛选（是否有代收）
            if (platformCollectedFilter !== 'all') {
                const actualPaid = Number((settlement as any).actual_paid_amount || 0)
                const hasCollection = actualPaid > 0
                if (platformCollectedFilter === 'yes' && !hasCollection) {
                    return false
                }
                if (platformCollectedFilter === 'no' && hasCollection) {
                    return false
                }
            }

            return true
        })
        .sort((a, b) => {
            if (!sortField) return 0

            let aValue: any
            let bValue: any

            switch (sortField) {
                case 'girl_name':
                    aValue = a.girls?.name || ''
                    bValue = b.girls?.name || ''
                    break
                case 'created_at':
                    aValue = new Date(a.created_at).getTime()
                    bValue = new Date(b.created_at).getTime()
                    break
                case 'service_fee':
                    aValue = Number(a.service_fee)
                    bValue = Number(b.service_fee)
                    break
                case 'platform_should_get':
                    aValue = Number(a.platform_should_get)
                    bValue = Number(b.platform_should_get)
                    break
                default:
                    return 0
            }

            if (typeof aValue === 'string') {
                return sortOrder === 'asc'
                    ? aValue.localeCompare(bValue, 'zh-CN')
                    : bValue.localeCompare(aValue, 'zh-CN')
            } else {
                return sortOrder === 'asc' ? aValue - bValue : bValue - aValue
            }
        })

    // 分页处理
    const totalFiltered = filteredAndSortedSettlements.length
    const totalPages = Math.ceil(totalFiltered / pageSize)
    const paginatedSettlements = filteredAndSortedSettlements.slice(
        (page - 1) * pageSize,
        page * pageSize
    )

    // 批量选择
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const allIds = new Set(paginatedSettlements.filter(s => s.settlement_status === 'pending').map(s => s.id))
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
        const ids = Array.from(selectedIds)
        let successCount = 0
        let failCount = 0

        // 显示进度 toast
        const toastId = toast.loading(`正在核验 0/${ids.length}...`)

        try {
            // 并发执行，每次最多 10 个
            const batchSize = 10
            for (let i = 0; i < ids.length; i += batchSize) {
                const batch = ids.slice(i, i + batchSize)
                const results = await Promise.all(
                    batch.map(id => markSettlementAsSettled({ settlement_id: id }))
                )

                results.forEach(result => {
                    if (result.ok) {
                        successCount++
                    } else {
                        failCount++
                    }
                })

                // 更新进度
                toast.loading(`正在核验 ${successCount + failCount}/${ids.length}...`, { id: toastId })
            }
        } catch (error) {
            console.error('批量核验失败', error)
        }

        setBatchSettling(false)
        toast.dismiss(toastId)

        if (failCount === 0) {
            toast.success(`成功标记 ${successCount} 条订单为已核验`)
        } else {
            toast.warning(`成功 ${successCount} 条，失败 ${failCount} 条`)
        }

        setSelectedIds(new Set())
        loadStats()
        loadSettlements()
    }

    // 保存
    const handleSave = async () => {
        if (!selectedSettlement) return

        setSaving(true)
        const result = await updateOrderSettlementPayment({
            settlement_id: selectedSettlement.id,
            actual_paid_amount: actualPaidAmount ? Number(actualPaidAmount) : null,
            payment_notes: paymentNotes || null,
            platform_should_get: platformShouldGet ? Number(platformShouldGet) : undefined,
            notes: notes || null,
        })
        setSaving(false)

        if (result.ok) {
            toast.success('保存成功')
            setEditPaymentOpen(false)
            loadSettlements()
        } else {
            toast.error(result.error || '保存失败')
        }
    }

    // 保存并核验
    const handleSaveAndSettle = async () => {
        if (!selectedSettlement) return

        setSaving(true)

        const saveResult = await updateOrderSettlementPayment({
            settlement_id: selectedSettlement.id,
            actual_paid_amount: actualPaidAmount ? Number(actualPaidAmount) : null,
            payment_notes: paymentNotes || null,
            platform_should_get: platformShouldGet ? Number(platformShouldGet) : undefined,
            notes: notes || null,
        })

        if (!saveResult.ok) {
            setSaving(false)
            toast.error(saveResult.error || '保存失败')
            return
        }

        const settleResult = await markSettlementAsSettled({ settlement_id: selectedSettlement.id })
        setSaving(false)

        if (settleResult.ok) {
            toast.success('保存并核验成功')
            setEditPaymentOpen(false)
            loadStats()
            loadSettlements()
        } else {
            toast.error(settleResult.error || '核验失败')
        }
    }

    // 拒绝订单
    const handleReject = async () => {
        if (!selectedSettlement) return
        if (!rejectReason.trim()) {
            toast.error('请输入拒绝原因')
            return
        }

        setRejecting(true)
        const result = await rejectOrderSettlement({
            settlement_id: selectedSettlement.id,
            reject_reason: rejectReason.trim()
        })
        setRejecting(false)

        if (result.ok) {
            toast.success('已拒绝订单')
            setRejectDialogOpen(false)
            setEditPaymentOpen(false)
            setRejectReason('')
            loadStats()
            loadSettlements()
        } else {
            toast.error(result.error || '拒绝失败')
        }
    }

    // 导出Excel（当前财务日所有数据）
    const handleExport = async () => {
        try {
            toast.loading('正在导出数据...')

            // 获取当前财务日的所有数据（不分页）
            const result = await getGirlOrderSettlements(
                undefined,
                {
                    completed_at_from: startISO,
                    completed_at_to: endISO,
                },
                { page: 1, pageSize: 10000 } // 设置足够大的 pageSize 获取所有数据
            )

            if (!result.ok || !result.data) {
                toast.dismiss()
                toast.error('导出失败：' + (result.error || '未知错误'))
                return
            }

            const allData = result.data.data

            const headers = [
                '订单号', '技师工号', '技师姓名', '服务费', '额外费用',
                '服务提成比例', '额外提成比例', '平台应得', '顾客已付平台',
                '结算金额', '代收金额(RMB)', '支付内容类型', '支付方式',
                '备注', '核验状态', '创建时间', '核验时间', '订单完成时间'
            ]

            const rows = allData.map(s => [
                s.orders?.order_number || '',
                s.girls?.girl_number || '',
                s.girls?.name || '',
                s.service_fee,
                s.extra_fee,
                s.service_commission_rate,
                s.extra_commission_rate,
                s.platform_should_get,
                s.customer_paid_to_platform,
                s.settlement_amount,
                (s as any).actual_paid_amount || '',
                s.payment_content_type || '',
                s.payment_method || '',
                s.payment_notes || '',
                s.settlement_status === 'pending' ? '待核验' : '已核验',
                s.created_at,
                s.settled_at || '',
                s.orders?.completed_at || ''
            ])

            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
            ].join('\n')

            const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url

            // 文件名包含财务日期
            const fiscalDateLabel = fiscalDate === 'today' ? '今日' : fiscalDate === 'yesterday' ? '昨日' : '前日'
            a.download = `订单核验_${fiscalDateLabel}_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`
            a.click()
            URL.revokeObjectURL(url)

            toast.dismiss()
            toast.success(`成功导出 ${allData.length} 条记录`)
        } catch (error) {
            toast.dismiss()
            console.error('导出失败', error)
            toast.error('导出失败')
        }
    }

    return (
        <div className="flex flex-col gap-6 p-4 md:px-8 md:py-6">
            {/* 页面标题 */}
            <div>
                <h1 className="text-2xl font-bold">财务日订单核验</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    按财务日（06:00-06:00 泰国时间）核验订单，支持批量操作
                </p>
            </div>

            {/* 财务日选择 */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                        <Calendar className="size-5 text-muted-foreground" />
                        <Label className="text-sm font-medium">财务日选择</Label>
                        <Select value={fiscalDate} onValueChange={(value: FiscalDateOption) => {
                            setFiscalDate(value)
                            setPage(1)
                        }}>
                            <SelectTrigger className="w-[300px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="yesterday">
                                    昨天 {format(subDays(new Date(), 1), 'MM-dd', { locale: zhCN })} 06:00 - 今天 06:00
                                </SelectItem>
                                <SelectItem value="today">
                                    今天 {format(new Date(), 'MM-dd', { locale: zhCN })} 06:00 - 明天 06:00
                                </SelectItem>
                                <SelectItem value="day_before_yesterday">
                                    前天 {format(subDays(new Date(), 2), 'MM-dd', { locale: zhCN })} 06:00 - 昨天 06:00
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <Button variant="outline" size="default" onClick={handleRefresh} className="ml-auto">
                            <RefreshCw className="size-4 mr-2" />
                            刷新
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* 统计卡片 */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">平台应得总额</CardTitle>
                        <FileText className="size-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {statsLoading ? (
                            <div className="flex justify-center py-2">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <>
                                <div className="text-2xl font-bold">{formatCurrency(dayStats?.platform_should_get_total || 0)}</div>
                                <p className="text-xs text-muted-foreground mt-1">当日应得</p>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">代收总额</CardTitle>
                        <FileText className="size-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {statsLoading ? (
                            <div className="flex justify-center py-2">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <>
                                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                    ¥{(dayStats?.actual_paid_total || 0).toFixed(2)}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">当日代收(RMB)</p>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">待核验</CardTitle>
                        <Clock className="size-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {statsLoading ? (
                            <div className="flex justify-center py-2">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <>
                                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                                    {dayStats?.pending_count || 0}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">等待核验</p>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">已核验</CardTitle>
                        <CheckCircle className="size-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {statsLoading ? (
                            <div className="flex justify-center py-2">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <>
                                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                    {dayStats?.settled_count || 0}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">已完成核验</p>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* 筛选区域 */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-wrap items-center gap-3">
                        {/* 搜索框 */}
                        <div className="relative flex-1 min-w-[220px] max-w-md">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground" />
                            <Input
                                placeholder="搜索工号、技师姓名、订单号..."
                                value={searchInput}
                                onChange={(e) => handleSearch(e.target.value)}
                                className="pl-10"
                            />
                        </div>

                        <Select value={statusFilter} onValueChange={handleStatusFilter}>
                            <SelectTrigger className="w-[130px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">全部状态</SelectItem>
                                <SelectItem value="pending">待核验</SelectItem>
                                <SelectItem value="settled">已核验</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={platformCollectedFilter} onValueChange={handlePlatformCollectedFilter}>
                            <SelectTrigger className="w-[140px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">全部订单</SelectItem>
                                <SelectItem value="yes">有代收</SelectItem>
                                <SelectItem value="no">无代收</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* 订单列表 */}
            <Card>
                <CardHeader>
                    <CardTitle>订单列表</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <SettlementsTableSkeleton />
                    ) : paginatedSettlements.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <FileText className="size-12 text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">暂无订单核验记录</p>
                        </div>
                    ) : (
                        <>
                            <div className="rounded-md border overflow-hidden">
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-12">
                                                    <Checkbox
                                                        checked={selectedIds.size > 0 && selectedIds.size === paginatedSettlements.filter(s => s.settlement_status === 'pending').length}
                                                        onCheckedChange={handleSelectAll}
                                                    />
                                                </TableHead>
                                                <TableHead>订单号</TableHead>
                                                <TableHead>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-auto p-0 font-medium hover:bg-transparent"
                                                        onClick={() => handleSort('girl_name')}
                                                    >
                                                        技师
                                                        {getSortIcon('girl_name')}
                                                    </Button>
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-auto p-0 font-medium hover:bg-transparent"
                                                        onClick={() => handleSort('service_fee')}
                                                    >
                                                        服务费/提成
                                                        {getSortIcon('service_fee')}
                                                    </Button>
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-auto p-0 font-medium hover:bg-transparent"
                                                        onClick={() => handleSort('platform_should_get')}
                                                    >
                                                        平台应得
                                                        {getSortIcon('platform_should_get')}
                                                    </Button>
                                                </TableHead>
                                                <TableHead className="text-right">代收(RMB)</TableHead>
                                                <TableHead>状态</TableHead>
                                                <TableHead>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-auto p-0 font-medium hover:bg-transparent"
                                                        onClick={() => handleSort('created_at')}
                                                    >
                                                        创建时间
                                                        {getSortIcon('created_at')}
                                                    </Button>
                                                </TableHead>
                                                <TableHead className="text-right">操作</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {paginatedSettlements.map((settlement) => {
                                                const isPending = settlement.settlement_status === 'pending'
                                                const hasActualPaid = (settlement as any).actual_paid_amount

                                                return (
                                                    <TableRow key={settlement.id}>
                                                        <TableCell>
                                                            <Checkbox
                                                                checked={selectedIds.has(settlement.id)}
                                                                onCheckedChange={(checked) => handleSelectOne(settlement.id, checked as boolean)}
                                                                disabled={!isPending}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="font-medium">
                                                            <div className="flex items-center gap-2">
                                                                <span>{settlement.orders?.order_number || '-'}</span>
                                                                {settlement.orders?.order_number && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-6 w-6"
                                                                        onClick={() => {
                                                                            navigator.clipboard.writeText(settlement.orders.order_number)
                                                                            toast.success('订单号已复制')
                                                                        }}
                                                                    >
                                                                        <Copy className="h-3 w-3" />
                                                                    </Button>
                                                                )}
                                                            </div>
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
                                                            <div className="flex flex-col">
                                                                <span>{formatCurrency(settlement.service_fee)}</span>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {(Number(settlement.service_commission_rate) * 100).toFixed(0)}%
                                                                </span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right font-medium">
                                                            {formatCurrency(settlement.platform_should_get)}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {hasActualPaid ? (
                                                                <span className="text-green-600 dark:text-green-400 font-medium">
                                                                    ¥{Number((settlement as any).actual_paid_amount).toFixed(2)}
                                                                </span>
                                                            ) : (
                                                                <span className="text-muted-foreground">-</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {isPending ? (
                                                                <Badge variant="outline" className="gap-1">
                                                                    <Clock className="size-3" />
                                                                    待核验
                                                                </Badge>
                                                            ) : settlement.settlement_status === 'rejected' ? (
                                                                <Badge variant="destructive" className="gap-1">
                                                                    <X className="size-3" />
                                                                    已拒绝
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="default" className="gap-1">
                                                                    <CheckCircle className="size-3" />
                                                                    已核验
                                                                </Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-sm text-muted-foreground">
                                                            {format(new Date(settlement.created_at), 'MM-dd HH:mm', { locale: zhCN })}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={async () => {
                                                                    setSelectedSettlement(settlement)
                                                                    setEditPaymentOpen(true)
                                                                    await loadSettlementDetail(settlement.id)
                                                                }}
                                                            >
                                                                <Edit className="size-4 mr-1" />
                                                                {isPending ? '编辑' : '查看'}
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>

                            {/* 批量操作和导出 */}
                            <div className="flex flex-wrap items-center gap-2 mt-4">
                                {selectedIds.size > 0 && (
                                    <Button
                                        onClick={() => setBatchConfirmOpen(true)}
                                        disabled={batchSettling}
                                    >
                                        {batchSettling ? '处理中...' : `批量核验选中 (${selectedIds.size})`}
                                    </Button>
                                )}
                                <Button variant="outline" onClick={handleExport}>
                                    <Download className="size-4 mr-2" />
                                    导出全部数据
                                </Button>
                            </div>

                            {/* 分页 */}
                            {totalFiltered > 0 && (
                                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                                    <div className="text-sm text-muted-foreground">
                                        显示 {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, totalFiltered)} 条，共 {totalFiltered} 条
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPage(p => Math.max(1, p - 1))}
                                            disabled={page === 1 || loading}
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                            上一页
                                        </Button>
                                        <span className="text-sm text-muted-foreground px-2">
                                            第 {page} / {totalPages} 页
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                            disabled={page === totalPages || loading}
                                        >
                                            下一页
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* 编辑订单核验信息弹窗 */}
            <Dialog open={editPaymentOpen} onOpenChange={setEditPaymentOpen}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            编辑订单核验信息 - {selectedSettlement?.orders?.order_number}
                        </DialogTitle>
                    </DialogHeader>

                    {detailLoading ? (
                        <div className="py-12 text-center text-muted-foreground">加载中...</div>
                    ) : selectedSettlement ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">订单号</Label>
                                    <p className="font-medium">{selectedSettlement.orders?.order_number}</p>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">技师</Label>
                                    <p className="font-medium">{selectedSettlement.girls?.name} (#{selectedSettlement.girls?.girl_number})</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">服务费</Label>
                                    <p>{formatCurrency(selectedSettlement.service_fee)}</p>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">平台应得</Label>
                                    <Input
                                        type="number"
                                        value={platformShouldGet}
                                        onChange={(e) => setPlatformShouldGet(e.target.value)}
                                        disabled={selectedSettlement?.settlement_status === 'settled'}
                                        className="h-8"
                                    />
                                </div>
                            </div>

                            <Separator />

                            {/* 平台代收款记录 */}
                            {paymentDataLoading ? (
                                <div className="py-4 text-center text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                                    加载收款记录...
                                </div>
                            ) : paymentData && paymentData.payments.length > 0 ? (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-sm font-medium">平台代收款记录</Label>
                                        <Badge variant="secondary">
                                            {paymentData.summary.payment_count} 笔 / ¥{paymentData.summary.total_amount.toFixed(2)}
                                        </Badge>
                                    </div>
                                    <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-3">
                                        {paymentData.payments.map((payment, index) => (
                                            <div key={payment.id} className="flex items-start gap-3 pb-2 border-b last:border-0 last:pb-0">
                                                <div className="flex-1 space-y-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        {/* 金额 - 根据支付方式显示不同颜色 */}
                                                        <span className={`text-sm font-semibold ${payment.payment_method === 'wechat'
                                                            ? 'text-green-600 dark:text-green-400'
                                                            : payment.payment_method === 'alipay'
                                                                ? 'text-blue-600 dark:text-blue-400'
                                                                : 'text-yellow-600 dark:text-yellow-400'
                                                            }`}>
                                                            ¥{payment.amount_rmb.toFixed(2)}
                                                        </span>
                                                        {/* 支付类型 */}
                                                        <Badge variant="outline" className="text-xs">
                                                            {payment.payment_content_type === 'deposit' ? '定金' :
                                                                payment.payment_content_type === 'full_amount' ? '全款' :
                                                                    payment.payment_content_type === 'tip' ? '小费' : '其他'}
                                                        </Badge>
                                                        {/* 支付方式 - 带颜色 */}
                                                        <Badge
                                                            variant="outline"
                                                            className={`text-xs ${payment.payment_method === 'wechat'
                                                                ? 'border-green-500 text-green-700 dark:text-green-400'
                                                                : payment.payment_method === 'alipay'
                                                                    ? 'border-blue-500 text-blue-700 dark:text-blue-400'
                                                                    : 'border-yellow-500 text-yellow-700 dark:text-yellow-400'
                                                                }`}
                                                        >
                                                            {payment.payment_method === 'wechat' ? '微信' : '支付宝'}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">
                                                        {format(new Date(payment.created_at), 'MM-dd HH:mm', { locale: zhCN })}
                                                    </p>
                                                    {payment.notes && (
                                                        <p className="text-xs text-muted-foreground">备注：{payment.notes}</p>
                                                    )}
                                                </div>
                                                {payment.proof_url && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8"
                                                        onClick={() => setPreviewImageUrl(payment.proof_url)}
                                                    >
                                                        <ImageIcon className="h-3 w-3 mr-1" />
                                                        查看截图
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    {paymentData.exchange_rate && (
                                        <p className="text-xs text-muted-foreground">
                                            💱 当前汇率：{paymentData.exchange_rate.display} ({paymentData.exchange_rate.example_rmb_to_thb})
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div className="py-3 text-center text-sm text-muted-foreground border rounded-md">
                                    暂无平台代收款记录
                                </div>
                            )}

                            <Separator />

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>平台代收金额 (RMB)</Label>
                                    {paymentData && paymentData.summary.total_amount > 0 && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 text-xs"
                                            onClick={() => setActualPaidAmount(String(paymentData.summary.total_amount))}
                                        >
                                            自动填充
                                        </Button>
                                    )}
                                </div>
                                <Input
                                    type="number"
                                    value={actualPaidAmount}
                                    onChange={(e) => setActualPaidAmount(e.target.value)}
                                    placeholder="0"
                                    disabled={selectedSettlement?.settlement_status === 'settled'}
                                />
                                {/* 数据一致性检查 */}
                                {paymentData && actualPaidAmount && Number(actualPaidAmount) !== paymentData.summary.total_amount && (
                                    <div className="flex items-start gap-2 p-2 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs">
                                        <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="font-medium text-yellow-800 dark:text-yellow-400">金额不一致</p>
                                            <p className="text-yellow-700 dark:text-yellow-500">
                                                填写金额 ¥{Number(actualPaidAmount).toFixed(2)}，收款记录总和 ¥{paymentData.summary.total_amount.toFixed(2)}
                                            </p>
                                        </div>
                                    </div>
                                )}
                                {selectedSettlement?.settlement_status === 'settled' && (
                                    <p className="text-xs text-muted-foreground">已核验订单不可修改代收金额</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label>备注</Label>
                                <Textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={3}
                                    placeholder="输入备注信息"
                                />
                            </div>
                        </div>
                    ) : null}

                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setEditPaymentOpen(false)}>取消</Button>
                        {selectedSettlement?.settlement_status === 'pending' && (
                            <Button
                                variant="destructive"
                                onClick={() => setRejectDialogOpen(true)}
                                disabled={saving}
                            >
                                拒绝
                            </Button>
                        )}
                        <Button variant="outline" onClick={handleSave} disabled={saving}>
                            {saving ? '保存中...' : '保存'}
                        </Button>
                        {selectedSettlement?.settlement_status === 'pending' && (
                            <Button onClick={handleSaveAndSettle} disabled={saving}>
                                {saving ? '处理中...' : '保存并核验'}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 拒绝原因弹窗 */}
            <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>拒绝订单核验</AlertDialogTitle>
                        <AlertDialogDescription>
                            请输入拒绝原因，技师将收到通知
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4">
                        <Textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="例如：收款截图不清晰、金额不符、缺少必要信息等"
                            rows={4}
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setRejectReason('')}>取消</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleReject}
                            disabled={rejecting || !rejectReason.trim()}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {rejecting ? '处理中...' : '确认拒绝'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* 图片预览弹窗 */}
            <Dialog open={!!previewImageUrl} onOpenChange={() => setPreviewImageUrl(null)}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>收款截图</DialogTitle>
                    </DialogHeader>
                    {previewImageUrl && (
                        <div className="relative w-full h-[600px]">
                            <Image
                                src={previewImageUrl}
                                alt="收款截图"
                                fill
                                className="object-contain"
                            />
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPreviewImageUrl(null)}>关闭</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 批量标记已核验确认 */}
            <AlertDialog open={batchConfirmOpen} onOpenChange={setBatchConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>确认批量标记为已核验？</AlertDialogTitle>
                        <AlertDialogDescription>
                            即将标记 <span className="font-bold text-foreground">{selectedIds.size}</span> 条订单为已核验
                            <br />
                            触发器会自动更新技师账户余额
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
