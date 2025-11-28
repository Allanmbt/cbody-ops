"use client"

/**
 * 技师账户列表页面
 * 展示所有技师的结算账户信息
 * 
 * 业务逻辑：
 * - balance: 技师欠平台的金额（THB），正数表示欠款，0表示结清
 * - platform_collected_rmb_balance: 平台代收金额（RMB），正数表示平台欠技师
 * - 状态判断：
 *   - 正常: balance < deposit_amount * 0.8
 *   - 预警: balance >= deposit_amount * 0.8 && balance <= deposit_amount
 *   - 超限: balance > deposit_amount
 */

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Search,
    Eye,
    X,
    Users,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Download,
    RefreshCw,
    ArrowUpDown,
    ArrowUp,
    ArrowDown
} from "lucide-react"
import { getSettlementAccounts } from "@/lib/features/finance/actions"
import type { GirlSettlementAccountWithGirl, AccountListFilters } from "@/lib/features/finance"
import { toast } from "sonner"
import { formatCurrency, cn } from "@/lib/utils"
import { AccountDetailDialog } from "./account-detail-dialog"

export function AccountsListContent() {
    const searchParams = useSearchParams()

    const [allAccounts, setAllAccounts] = useState<GirlSettlementAccountWithGirl[]>([])
    const [loading, setLoading] = useState(true)
    
    // 分页状态
    const [page, setPage] = useState(1)
    const pageSize = 20

    // 筛选条件
    const [search, setSearch] = useState(searchParams.get('search') || '')
    const [debtStatus, setDebtStatus] = useState(searchParams.get('debt_status') || 'all')
    const [cityFilter, setCityFilter] = useState<string>('all')
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null)

    // 排序
    const [sortField, setSortField] = useState<'girl_number' | 'name' | 'city' | 'deposit_amount' | 'balance' | 'platform_collected_rmb_balance' | 'status'>('girl_number')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

    // 详情侧边栏
    const [detailGirlId, setDetailGirlId] = useState<string | null>(null)
    const [detailOpen, setDetailOpen] = useState(false)

    useEffect(() => {
        loadAccounts()
    }, [])

    // 筛选条件变化时重置到第一页
    useEffect(() => {
        setPage(1)
    }, [search, cityFilter, statusFilter])

    // 搜索防抖已移除，改为前端实时筛选

    async function loadAccounts() {
        try {
            setLoading(true)

            // 一次性加载所有数据（不分页）
            const result = await getSettlementAccounts({}, { page: 1, pageSize: 9999 })

            if (!result.ok) {
                toast.error(result.error || "获取账户列表失败")
                return
            }

            setAllAccounts(result.data!.data)
        } catch (error) {
            console.error('[AccountsList] 加载失败:', error)
            toast.error("加载账户列表失败")
        } finally {
            setLoading(false)
        }
    }



    // 获取欠款状态
    function getDebtStatus(balance: number, depositAmount: number) {
        const ratio = depositAmount > 0 ? balance / depositAmount : 0

        if (balance > depositAmount) {
            return {
                type: 'exceeded' as const,
                label: '超限',
                color: 'text-red-600 dark:text-red-400',
                bgColor: 'bg-red-50 dark:bg-red-950',
                icon: XCircle,
                ratio
            }
        } else if (balance >= depositAmount * 0.8) {
            return {
                type: 'warning' as const,
                label: '预警',
                color: 'text-yellow-600 dark:text-yellow-400',
                bgColor: 'bg-yellow-50 dark:bg-yellow-950',
                icon: AlertTriangle,
                ratio
            }
        } else {
            return {
                type: 'normal' as const,
                label: '正常',
                color: 'text-green-600 dark:text-green-400',
                bgColor: 'bg-green-50 dark:bg-green-950',
                icon: CheckCircle2,
                ratio
            }
        }
    }

    // 导出数据
    async function handleExport() {
        try {
            toast.info('正在导出数据...')

            // 构建 CSV 内容
            const headers = ['工号', '姓名', '城市', '押金(THB)', '欠款(THB)', '代收(RMB)', '状态']
            const rows = filteredAndSortedAccounts.map(account => {
                const status = getDebtStatus(Number(account.balance), Number(account.deposit_amount))
                return [
                    account.girls?.girl_number || '-',
                    account.girls?.name || '-',
                    account.girls?.cities?.name?.zh || '-',
                    account.deposit_amount,
                    account.balance,
                    account.platform_collected_rmb_balance || 0,
                    status.label
                ]
            })

            const csv = [headers, ...rows]
                .map(row => row.map(cell => `"${cell}"`).join(','))
                .join('\n')

            // 下载文件
            const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' })
            const link = document.createElement('a')
            link.href = URL.createObjectURL(blob)
            link.download = `技师账户_${new Date().toISOString().split('T')[0]}.csv`
            link.click()

            toast.success('导出成功')
        } catch (error) {
            console.error('[Export] 导出失败:', error)
            toast.error('导出失败')
        }
    }

    // 排序切换函数（前端排序，重置到第一页）
    function toggleSort(field: typeof sortField) {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortOrder('asc')
        }
        setPage(1) // 排序后重置到第一页
    }

    // 获取排序图标
    function getSortIcon(field: typeof sortField) {
        if (sortField !== field) {
            return <ArrowUpDown className="size-3 ml-1 text-muted-foreground" />
        }
        return sortOrder === 'asc' 
            ? <ArrowUp className="size-3 ml-1" />
            : <ArrowDown className="size-3 ml-1" />
    }

    // 应用筛选和排序
    const filteredAndSortedAccounts = allAccounts
        .filter(account => {
            // 搜索筛选
            if (search) {
                const searchLower = search.toLowerCase()
                const girlNumber = account.girls?.girl_number?.toString() || ''
                const girlName = account.girls?.name?.toLowerCase() || ''
                if (!girlNumber.includes(search) && !girlName.includes(searchLower)) {
                    return false
                }
            }

            // 城市筛选
            if (cityFilter !== 'all' && account.girls?.cities?.name?.zh !== cityFilter) {
                return false
            }

            // 状态筛选
            if (statusFilter !== 'all') {
                const status = getDebtStatus(Number(account.balance), Number(account.deposit_amount))
                if (status.type !== statusFilter) {
                    return false
                }
            }

            return true
        })
        .sort((a, b) => {
            let aValue: any
            let bValue: any

            switch (sortField) {
                case 'girl_number':
                    aValue = a.girls?.girl_number || 0
                    bValue = b.girls?.girl_number || 0
                    break
                case 'name':
                    aValue = a.girls?.name || ''
                    bValue = b.girls?.name || ''
                    break
                case 'city':
                    aValue = a.girls?.cities?.name?.zh || ''
                    bValue = b.girls?.cities?.name?.zh || ''
                    break
                case 'deposit_amount':
                    aValue = Number(a.deposit_amount)
                    bValue = Number(b.deposit_amount)
                    break
                case 'balance':
                    aValue = Number(a.balance)
                    bValue = Number(b.balance)
                    break
                case 'platform_collected_rmb_balance':
                    aValue = Number(a.platform_collected_rmb_balance || 0)
                    bValue = Number(b.platform_collected_rmb_balance || 0)
                    break
                case 'status':
                    const getStatusValue = (balance: number, deposit: number) => {
                        if (balance > deposit) return 3
                        if (balance >= deposit * 0.8) return 2
                        return 1
                    }
                    aValue = getStatusValue(Number(a.balance), Number(a.deposit_amount))
                    bValue = getStatusValue(Number(b.balance), Number(b.deposit_amount))
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

    // 分页处理（在筛选排序后）
    const totalFiltered = filteredAndSortedAccounts.length
    const totalPages = Math.ceil(totalFiltered / pageSize)
    const paginatedAccounts = filteredAndSortedAccounts.slice(
        (page - 1) * pageSize,
        page * pageSize
    )

    // 计算统计数据（基于筛选后的数据）
    const stats = {
        total: filteredAndSortedAccounts.length,
        normal: filteredAndSortedAccounts.filter(a => {
            const status = getDebtStatus(Number(a.balance), Number(a.deposit_amount))
            return status.type === 'normal'
        }).length,
        warning: filteredAndSortedAccounts.filter(a => {
            const status = getDebtStatus(Number(a.balance), Number(a.deposit_amount))
            return status.type === 'warning'
        }).length,
        exceeded: filteredAndSortedAccounts.filter(a => {
            const status = getDebtStatus(Number(a.balance), Number(a.deposit_amount))
            return status.type === 'exceeded'
        }).length
    }

    // 获取唯一城市列表
    const cities = Array.from(new Set(allAccounts.map(a => a.girls?.cities?.name?.zh).filter(Boolean))) as string[]

    return (
        <div className="flex flex-col gap-6">
            {/* 页面标题 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">技师结算账户</h1>
                    <p className="text-muted-foreground mt-1">
                        查看和管理所有技师的结算账户状态
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadAccounts()}
                        disabled={loading}
                    >
                        <RefreshCw className={cn("size-4 mr-2", loading && "animate-spin")} />
                        刷新
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExport}
                        disabled={filteredAndSortedAccounts.length === 0}
                    >
                        <Download className="size-4 mr-2" />
                        导出数据
                    </Button>
                </div>
            </div>

            {/* 统计卡片 */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">总技师数</CardTitle>
                        <Users className="size-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{allAccounts.length}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            筛选后 {totalFiltered} 个
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">正常</CardTitle>
                        <CheckCircle2 className="size-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{stats.normal}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            欠款 &lt; 80% 押金
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">预警</CardTitle>
                        <AlertTriangle className="size-4 text-yellow-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-600">{stats.warning}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            欠款 ≥ 80% 押金
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">超限</CardTitle>
                        <XCircle className="size-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{stats.exceeded}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            欠款 &gt; 押金
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* 筛选区域 */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-wrap items-center gap-3">
                        {/* 搜索框 */}
                        <div className="relative flex-1 min-w-[220px] max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                            <Input
                                placeholder="搜索技师名称或工号..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10"
                            />
                        </div>

                        <Select value={cityFilter} onValueChange={setCityFilter}>
                            <SelectTrigger className="w-[130px]">
                                <SelectValue placeholder="城市" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">全部城市</SelectItem>
                                {cities.map(city => (
                                    <SelectItem key={city} value={city}>{city}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[130px]">
                                <SelectValue placeholder="状态" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">全部状态</SelectItem>
                                <SelectItem value="normal">正常</SelectItem>
                                <SelectItem value="warning">预警</SelectItem>
                                <SelectItem value="exceeded">超限</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* 账户列表 */}
            <Card>
                <CardHeader>
                    <CardTitle>账户列表</CardTitle>
                    <CardDescription>共 {allAccounts.length} 个技师账户</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <AccountsTableSkeleton />
                    ) : paginatedAccounts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <p>暂无账户数据</p>
                        </div>
                    ) : (
                        <>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>头像</TableHead>
                                            <TableHead>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-auto p-0 font-medium hover:bg-transparent"
                                                    onClick={() => toggleSort('girl_number')}
                                                >
                                                    工号
                                                    {getSortIcon('girl_number')}
                                                </Button>
                                            </TableHead>
                                            <TableHead>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-auto p-0 font-medium hover:bg-transparent"
                                                    onClick={() => toggleSort('name')}
                                                >
                                                    技师名称
                                                    {getSortIcon('name')}
                                                </Button>
                                            </TableHead>
                                            <TableHead>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-auto p-0 font-medium hover:bg-transparent"
                                                    onClick={() => toggleSort('city')}
                                                >
                                                    城市
                                                    {getSortIcon('city')}
                                                </Button>
                                            </TableHead>
                                            <TableHead className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-auto p-0 font-medium hover:bg-transparent ml-auto"
                                                    onClick={() => toggleSort('deposit_amount')}
                                                >
                                                    押金 (THB)
                                                    {getSortIcon('deposit_amount')}
                                                </Button>
                                            </TableHead>
                                            <TableHead className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-auto p-0 font-medium hover:bg-transparent ml-auto"
                                                    onClick={() => toggleSort('balance')}
                                                >
                                                    欠款 (THB)
                                                    {getSortIcon('balance')}
                                                </Button>
                                            </TableHead>
                                            <TableHead className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-auto p-0 font-medium hover:bg-transparent ml-auto"
                                                    onClick={() => toggleSort('platform_collected_rmb_balance')}
                                                >
                                                    代收 (RMB)
                                                    {getSortIcon('platform_collected_rmb_balance')}
                                                </Button>
                                            </TableHead>
                                            <TableHead>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-auto p-0 font-medium hover:bg-transparent"
                                                    onClick={() => toggleSort('status')}
                                                >
                                                    状态
                                                    {getSortIcon('status')}
                                                </Button>
                                            </TableHead>
                                            <TableHead className="text-right">操作</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedAccounts.map((account) => {
                                            const status = getDebtStatus(
                                                Number(account.balance),
                                                Number(account.deposit_amount)
                                            )
                                            const StatusIcon = status.icon

                                            return (
                                                <TableRow
                                                    key={account.id}
                                                    className={cn(
                                                        status.type === 'exceeded' && "bg-red-50/30 dark:bg-red-950/10"
                                                    )}
                                                >
                                                    <TableCell>
                                                        <Avatar
                                                            className="size-10 cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                                                            onClick={() => account.girls?.avatar_url && setSelectedAvatar(account.girls.avatar_url)}
                                                        >
                                                            <AvatarImage
                                                                src={account.girls?.avatar_url || ''}
                                                                alt={account.girls?.name || '技师'}
                                                            />
                                                            <AvatarFallback>
                                                                {account.girls?.name?.charAt(0) || '?'}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                    </TableCell>
                                                    <TableCell className="font-medium">
                                                        #{account.girls?.girl_number || '-'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            {account.girls?.name || '未知技师'}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {account.girls?.cities?.name?.zh || '-'}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="font-mono">
                                                            {formatCurrency(account.deposit_amount)}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="space-y-1">
                                                            <div className={cn("font-mono font-medium", status.color)}>
                                                                {formatCurrency(account.balance)}
                                                            </div>
                                                            {Number(account.deposit_amount) > 0 && (
                                                                <Progress
                                                                    value={status.ratio * 100}
                                                                    className={cn(
                                                                        "h-1",
                                                                        status.type === 'exceeded' && "[&>div]:bg-red-500",
                                                                        status.type === 'warning' && "[&>div]:bg-yellow-500",
                                                                        status.type === 'normal' && "[&>div]:bg-green-500"
                                                                    )}
                                                                />
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="font-mono text-green-600 dark:text-green-400">
                                                            ¥{(account.platform_collected_rmb_balance || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant="outline"
                                                            className={cn("gap-1", status.bgColor)}
                                                        >
                                                            <StatusIcon className="size-3" />
                                                            {status.label}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => {
                                                                setDetailGirlId(account.girl_id)
                                                                setDetailOpen(true)
                                                            }}
                                                        >
                                                            <Eye className="size-4 mr-1" />
                                                            查看详情
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
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
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* 头像放大对话框 */}
            {selectedAvatar && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
                    onClick={() => setSelectedAvatar(null)}
                >
                    <div className="relative max-w-2xl max-h-[80vh] p-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute -top-2 -right-2 size-8 rounded-full bg-background hover:bg-background/80"
                            onClick={() => setSelectedAvatar(null)}
                        >
                            <X className="size-4" />
                        </Button>
                        <img
                            src={selectedAvatar}
                            alt="技师头像"
                            className="max-w-full max-h-[80vh] rounded-lg object-contain"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>
            )}

            {/* 账户详情弹窗 */}
            <AccountDetailDialog
                girlId={detailGirlId}
                open={detailOpen}
                onOpenChange={setDetailOpen}
            />
        </div>
    )
}

function AccountsTableSkeleton() {
    return (
        <div className="rounded-md border overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>头像</TableHead>
                        <TableHead>工号</TableHead>
                        <TableHead>技师名称</TableHead>
                        <TableHead>城市</TableHead>
                        <TableHead className="text-right">押金 (THB)</TableHead>
                        <TableHead className="text-right">欠款 (THB)</TableHead>
                        <TableHead className="text-right">代收 (RMB)</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {[...Array(5)].map((_, i) => (
                        <TableRow key={i}>
                            <TableCell>
                                <Skeleton className="h-10 w-10 rounded-full" />
                            </TableCell>
                            <TableCell>
                                <Skeleton className="h-4 w-12" />
                            </TableCell>
                            <TableCell>
                                <Skeleton className="h-4 w-20" />
                            </TableCell>
                            <TableCell>
                                <Skeleton className="h-4 w-16" />
                            </TableCell>
                            <TableCell className="text-right">
                                <Skeleton className="h-4 w-20 ml-auto" />
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="space-y-1">
                                    <Skeleton className="h-4 w-20 ml-auto" />
                                    <Skeleton className="h-1 w-full" />
                                </div>
                            </TableCell>
                            <TableCell className="text-right">
                                <Skeleton className="h-4 w-20 ml-auto" />
                            </TableCell>
                            <TableCell>
                                <Skeleton className="h-6 w-16" />
                            </TableCell>
                            <TableCell className="text-right">
                                <Skeleton className="h-8 w-20 ml-auto" />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
