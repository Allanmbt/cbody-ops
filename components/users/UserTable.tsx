'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Search, ChevronLeft, ChevronRight, Eye, Ban, CheckCircle, Shield, MoreVertical, Copy, Edit2, X, Send, History } from 'lucide-react'
import type { UserListItem, UserListParams } from '@/lib/features/users'
import { useCurrentAdmin } from '@/hooks/use-current-admin'
import { UserDetailDrawer } from './UserDetailDrawer'
import { SendNotificationDialog } from './SendNotificationDialog'
import { UserBookingHistoryDialog } from './UserBookingHistoryDialog'
import { toggleUserBan, toggleUserWhitelist, updateUserCreditScore } from '@/app/dashboard/users/actions'
import { toast } from 'sonner'

interface UserTableProps {
    users: UserListItem[]
    total: number
    currentPage: number
    limit: number
    hasNext: boolean
    hasPrev: boolean
    loading?: boolean
    onSearch?: (search: string) => void
    onFilter?: (key: keyof UserListParams, value: string | boolean | number | undefined) => void
    onPageChange?: (page: number) => void
    onRefresh?: () => void
}

// 国家代码映射
const COUNTRY_NAMES: Record<string, string> = {
    'TH': '泰国',
    'CN': '中国',
    'US': '美国',
    'JP': '日本',
    'KR': '韩国',
    'SG': '新加坡',
    'MY': '马来西亚',
    'VN': '越南',
    'ID': '印尼',
    'PH': '菲律宾',
    'HK': '香港',
    'NO': '挪威',
}

// 语言代码映射
const LANGUAGE_NAMES: Record<string, string> = {
    'en': 'English',
    'zh': '中文',
    'th': 'ไทย',
}

export function UserTable({
    users,
    total,
    currentPage,
    limit,
    hasNext,
    hasPrev,
    loading = false,
    onSearch,
    onFilter,
    onPageChange,
    onRefresh,
}: UserTableProps) {
    const { admin } = useCurrentAdmin()
    const [searchInput, setSearchInput] = useState('')
    const [filters, setFilters] = useState({
        country_code: 'all',
        language_code: 'all',
        level: 'all',
        is_banned: 'all',
    })

    // 详情抽屉
    const [detailUserId, setDetailUserId] = useState<string | null>(null)
    const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)

    // 系统通知对话框
    const [notificationDialogOpen, setNotificationDialogOpen] = useState(false)
    const [notificationUserId, setNotificationUserId] = useState<string>('')
    const [notificationUserName, setNotificationUserName] = useState<string>('')

    // 预订历史对话框
    const [bookingHistoryOpen, setBookingHistoryOpen] = useState(false)
    const [bookingHistoryUserId, setBookingHistoryUserId] = useState<string | null>(null)
    const [bookingHistoryUserName, setBookingHistoryUserName] = useState<string>('')

    // 操作加载状态
    const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})

    // 编辑诚信分状态
    const [editingCreditScore, setEditingCreditScore] = useState<Record<string, boolean>>({})
    const [creditScoreInputs, setCreditScoreInputs] = useState<Record<string, string>>({})

    const canEdit = admin?.role === 'superadmin' || admin?.role === 'admin'

    // 复制到剪贴板
    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text).then(() => {
            toast.success(`${label}已复制`)
        }).catch(() => {
            toast.error('复制失败')
        })
    }

    // 截取 ID 显示部分（前8位）
    const getShortId = (id: string) => {
        return id.substring(0, 8)
    }

    // 执行搜索
    const handleSearch = () => {
        if (onSearch) {
            onSearch(searchInput.trim())
        }
    }

    // 处理搜索输入框回车键
    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSearch()
        }
    }

    // 处理过滤器变化
    const handleFilterChange = (key: keyof UserListParams, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }))
        if (onFilter) {
            if (value === 'all') {
                onFilter(key, undefined)
            } else if (key === 'level') {
                onFilter(key, parseInt(value))
            } else if (key === 'is_banned') {
                onFilter(key, value === 'true')
            } else {
                onFilter(key, value)
            }
        }
    }

    // 打开详情
    const handleViewDetail = (userId: string) => {
        setDetailUserId(userId)
        setDetailDrawerOpen(true)
    }

    // 打开发送通知对话框
    const handleSendNotification = (userId: string, userName?: string) => {
        setNotificationUserId(userId)
        setNotificationUserName(userName || userId)
        setNotificationDialogOpen(true)
    }

    // 打开预订历史对话框
    const handleViewBookingHistory = (userId: string, userName?: string) => {
        setBookingHistoryUserId(userId)
        setBookingHistoryUserName(userName || '')
        setBookingHistoryOpen(true)
    }

    // 切换封禁状态
    const handleToggleBan = async (userId: string, currentBanned: boolean) => {
        const actionKey = `ban-${userId}`
        setActionLoading(prev => ({ ...prev, [actionKey]: true }))

        try {
            const result = await toggleUserBan({
                user_id: userId,
                is_banned: !currentBanned
            })

            if (result.success) {
                toast.success(currentBanned ? '已解除封禁' : '已封禁用户')
                onRefresh?.()
            } else {
                toast.error(result.error || '操作失败')
            }
        } catch (error) {
            toast.error('操作失败')
        } finally {
            setActionLoading(prev => ({ ...prev, [actionKey]: false }))
        }
    }

    // 切换白名单状态
    const handleToggleWhitelist = async (userId: string, currentWhitelisted: boolean) => {
        const actionKey = `whitelist-${userId}`
        setActionLoading(prev => ({ ...prev, [actionKey]: true }))

        try {
            const result = await toggleUserWhitelist({
                user_id: userId,
                is_whitelisted: !currentWhitelisted
            })

            if (result.success) {
                toast.success(currentWhitelisted ? '已移出白名单' : '已加入白名单')
                onRefresh?.()
            } else {
                toast.error(result.error || '操作失败')
            }
        } catch (error) {
            toast.error('操作失败')
        } finally {
            setActionLoading(prev => ({ ...prev, [actionKey]: false }))
        }
    }

    // 开始编辑诚信分
    const handleStartEditCreditScore = (userId: string, currentScore: number) => {
        setEditingCreditScore(prev => ({ ...prev, [userId]: true }))
        setCreditScoreInputs(prev => ({ ...prev, [userId]: currentScore.toString() }))
    }

    // 保存诚信分
    const handleSaveCreditScore = async (userId: string) => {
        const inputValue = creditScoreInputs[userId]
        const newScore = parseInt(inputValue)

        if (isNaN(newScore) || newScore < 0 || newScore > 100) {
            toast.error('诚信分必须在 0-100 之间')
            return
        }

        const actionKey = `credit-${userId}`
        setActionLoading(prev => ({ ...prev, [actionKey]: true }))

        try {
            const result = await updateUserCreditScore(userId, newScore)

            if (result.success) {
                toast.success('诚信分已更新')
                setEditingCreditScore(prev => ({ ...prev, [userId]: false }))
                onRefresh?.()
            } else {
                toast.error(result.error || '更新失败')
            }
        } catch (error) {
            toast.error('更新失败')
        } finally {
            setActionLoading(prev => ({ ...prev, [actionKey]: false }))
        }
    }

    // 取消编辑诚信分
    const handleCancelEditCreditScore = (userId: string) => {
        setEditingCreditScore(prev => ({ ...prev, [userId]: false }))
        setCreditScoreInputs(prev => ({ ...prev, [userId]: '' }))
    }

    return (
        <>
            <div className="space-y-4">
                {/* 搜索和过滤器 */}
                <div className="flex flex-col gap-4">
                    {/* 第一行：搜索 */}
                    <div className="flex gap-2">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                            <Input
                                placeholder="搜索 ID/邮箱/昵称/用户名/手机号..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                onKeyDown={handleSearchKeyDown}
                                className="pl-9"
                            />
                        </div>
                        <Button onClick={handleSearch}>
                            <Search className="mr-2 h-4 w-4" />
                            搜索
                        </Button>
                    </div>

                    {/* 第二行：筛选器 */}
                    <div className="flex flex-wrap gap-2">
                        {/* 国家过滤 */}
                        <Select
                            value={filters.country_code}
                            onValueChange={(value) => handleFilterChange('country_code', value)}
                        >
                            <SelectTrigger className="w-32">
                                <SelectValue placeholder="国家" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">全部国家</SelectItem>
                                {Object.entries(COUNTRY_NAMES).map(([code, name]) => (
                                    <SelectItem key={code} value={code}>
                                        {name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* 语言过滤 */}
                        <Select
                            value={filters.language_code}
                            onValueChange={(value) => handleFilterChange('language_code', value)}
                        >
                            <SelectTrigger className="w-32">
                                <SelectValue placeholder="语言" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">全部语言</SelectItem>
                                {Object.entries(LANGUAGE_NAMES).map(([code, name]) => (
                                    <SelectItem key={code} value={code}>
                                        {name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* 等级过滤 */}
                        <Select
                            value={filters.level}
                            onValueChange={(value) => handleFilterChange('level', value)}
                        >
                            <SelectTrigger className="w-32">
                                <SelectValue placeholder="等级" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">全部等级</SelectItem>
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => (
                                    <SelectItem key={level} value={level.toString()}>
                                        Lv.{level}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* 封禁状态过滤 */}
                        <Select
                            value={filters.is_banned}
                            onValueChange={(value) => handleFilterChange('is_banned', value)}
                        >
                            <SelectTrigger className="w-32">
                                <SelectValue placeholder="状态" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">全部状态</SelectItem>
                                <SelectItem value="false">正常</SelectItem>
                                <SelectItem value="true">已封禁</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* 用户表格 */}
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>用户</TableHead>
                                    <TableHead>邮箱</TableHead>
                                    <TableHead>等级</TableHead>
                                    <TableHead>国家/语言</TableHead>
                                    <TableHead>信用分</TableHead>
                                    <TableHead>状态</TableHead>
                                    <TableHead>最后登录</TableHead>
                                    <TableHead>注册时间</TableHead>
                                    <TableHead>操作</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center py-8">
                                            <div className="flex items-center justify-center">
                                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                                                <span className="ml-2">加载中...</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : users.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                                            没有找到用户
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    users.map((user) => (
                                        <TableRow key={user.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarImage src={user.avatar_url || undefined} />
                                                        <AvatarFallback>
                                                            {user.display_name?.charAt(0) || user.username?.charAt(0) || '?'}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="min-w-0">
                                                        <div className="font-medium">
                                                            {user.display_name || user.username || '未设置'}
                                                        </div>
                                                        {user.username && user.display_name && (
                                                            <div className="text-sm text-muted-foreground">
                                                                @{user.username}
                                                            </div>
                                                        )}
                                                        {/* ID 显示和复制 */}
                                                        <div className="flex items-center gap-1 mt-1">
                                                            <code className="text-xs text-muted-foreground">
                                                                {getShortId(user.id)}...
                                                            </code>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    copyToClipboard(user.id, 'ID')
                                                                }}
                                                                className="text-muted-foreground hover:text-foreground transition-colors"
                                                            >
                                                                <Copy className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm text-muted-foreground">
                                                    {user.email || '-'}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary">
                                                    Lv.{user.level}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm">
                                                    <div>{COUNTRY_NAMES[user.country_code || ''] || user.country_code || '-'}</div>
                                                    <div className="text-muted-foreground">
                                                        {LANGUAGE_NAMES[user.language_code] || user.language_code}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {editingCreditScore[user.id] ? (
                                                    <div className="flex items-center gap-2">
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            max="100"
                                                            value={creditScoreInputs[user.id] || ''}
                                                            onChange={(e) => setCreditScoreInputs(prev => ({
                                                                ...prev,
                                                                [user.id]: e.target.value
                                                            }))}
                                                            className="w-20 h-8"
                                                            disabled={actionLoading[`credit-${user.id}`]}
                                                        />
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => handleSaveCreditScore(user.id)}
                                                            disabled={actionLoading[`credit-${user.id}`]}
                                                        >
                                                            <CheckCircle className="h-4 w-4 text-green-600" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => handleCancelEditCreditScore(user.id)}
                                                            disabled={actionLoading[`credit-${user.id}`]}
                                                        >
                                                            <X className="h-4 w-4 text-red-600" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant={user.credit_score >= 80 ? 'default' : user.credit_score >= 60 ? 'secondary' : 'destructive'}>
                                                            {user.credit_score}
                                                        </Badge>
                                                        {canEdit && (
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => handleStartEditCreditScore(user.id, user.credit_score)}
                                                                className="h-6 w-6 p-0"
                                                            >
                                                                <Edit2 className="h-3 w-3" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    {user.is_banned ? (
                                                        <Badge variant="destructive">
                                                            <Ban className="h-3 w-3 mr-1" />
                                                            已封禁
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="default">
                                                            <CheckCircle className="h-3 w-3 mr-1" />
                                                            正常
                                                        </Badge>
                                                    )}
                                                    {user.is_whitelisted && (
                                                        <Badge variant="outline" className="border-blue-500 text-blue-600">
                                                            <Shield className="h-3 w-3 mr-1" />
                                                            白名单
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {user.last_login_at ? (
                                                    <div className="text-sm">
                                                        {format(new Date(user.last_login_at), 'MM-dd HH:mm', { locale: zhCN })}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground text-sm">从未登录</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm">
                                                    {format(new Date(user.created_at), 'yyyy-MM-dd', { locale: zhCN })}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleViewDetail(user.id)}
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    {canEdit && (
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="sm">
                                                                    <MoreVertical className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem
                                                                    onClick={() => handleViewBookingHistory(user.id, user.display_name || user.username || user.email || undefined)}
                                                                >
                                                                    <History className="mr-2 h-4 w-4 text-purple-600" />
                                                                    查看预订记录
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    onClick={() => handleSendNotification(user.id, user.display_name || user.username || user.email || undefined)}
                                                                >
                                                                    <Send className="mr-2 h-4 w-4 text-blue-600" />
                                                                    发送通知
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    onClick={() => handleToggleBan(user.id, user.is_banned)}
                                                                    disabled={actionLoading[`ban-${user.id}`]}
                                                                >
                                                                    {user.is_banned ? (
                                                                        <>
                                                                            <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                                                                            解除封禁
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Ban className="mr-2 h-4 w-4 text-red-600" />
                                                                            封禁用户
                                                                        </>
                                                                    )}
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    onClick={() => handleToggleWhitelist(user.id, user.is_whitelisted)}
                                                                    disabled={actionLoading[`whitelist-${user.id}`]}
                                                                >
                                                                    {user.is_whitelisted ? (
                                                                        <>
                                                                            <Shield className="mr-2 h-4 w-4 text-gray-600" />
                                                                            移出白名单
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Shield className="mr-2 h-4 w-4 text-blue-600" />
                                                                            加入白名单
                                                                        </>
                                                                    )}
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* 分页 */}
                <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                        显示 {((currentPage - 1) * limit) + 1} - {Math.min(currentPage * limit, total)} 条，共 {total} 条
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPageChange?.(currentPage - 1)}
                            disabled={!hasPrev || loading}
                        >
                            <ChevronLeft className="h-4 w-4" />
                            上一页
                        </Button>
                        <div className="text-sm">第 {currentPage} 页</div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPageChange?.(currentPage + 1)}
                            disabled={!hasNext || loading}
                        >
                            下一页
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* 用户详情抽屉 */}
            <UserDetailDrawer
                open={detailDrawerOpen}
                onOpenChange={setDetailDrawerOpen}
                userId={detailUserId}
            />

            {/* 发送系统通知对话框 */}
            <SendNotificationDialog
                open={notificationDialogOpen}
                onOpenChange={setNotificationDialogOpen}
                userId={notificationUserId}
                userName={notificationUserName}
            />

            {/* 预订历史对话框 */}
            <UserBookingHistoryDialog
                open={bookingHistoryOpen}
                onOpenChange={setBookingHistoryOpen}
                userId={bookingHistoryUserId}
                userName={bookingHistoryUserName}
            />
        </>
    )
}
