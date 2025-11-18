'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { Search, ChevronLeft, ChevronRight, Eye, Ban, CheckCircle } from 'lucide-react'
import type { UserListItem, UserListParams } from '@/lib/features/users'
import { useCurrentAdmin } from '@/hooks/use-current-admin'
import { UserBanToggle } from './UserBanToggle'

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
    searchParams?: UserListParams
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
    searchParams,
}: UserTableProps) {
    const { admin } = useCurrentAdmin()
    const [localSearch, setLocalSearch] = useState(searchParams?.search || '')
    const [filters, setFilters] = useState({
        country_code: searchParams?.country_code || 'all',
        language_code: searchParams?.language_code || 'all',
        is_banned: searchParams?.is_banned,
    })

    const canEdit = admin?.role === 'superadmin'

    // 处理搜索
    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        if (onSearch) {
            onSearch(localSearch)
        }
    }

    // 处理过滤器变化
    const handleFilterChange = (key: keyof UserListParams, value: string | boolean | number | undefined) => {
        setFilters(prev => ({ ...prev, [key]: value }))
        if (onFilter) {
            onFilter(key, value)
        }
    }

    // 处理分页
    const handlePageChange = (page: number) => {
        if (onPageChange) {
            onPageChange(page)
        }
    }

    // 处理排序
    const handleSort = (sortBy: string) => {
        const currentSortOrder = searchParams?.sort_by === sortBy && searchParams?.sort_order === 'desc' ? 'asc' : 'desc'
        if (onFilter) {
            onFilter('sort_by', sortBy as 'created_at' | 'level' | 'credit_score')
            onFilter('sort_order', currentSortOrder)
        }
    }

    return (
        <div className="space-y-4">
            {/* 搜索和过滤器 */}
            <div className="flex flex-col sm:flex-row gap-4">
                <form onSubmit={handleSearch} className="flex gap-2 flex-1">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <Input
                            placeholder="搜索用户名或显示名..."
                            value={localSearch}
                            onChange={(e) => setLocalSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <Button type="submit" variant="outline">
                        搜索
                    </Button>
                </form>

                <div className="flex gap-2">
                    {/* 国家过滤 */}
                    <Select
                        value={filters.country_code || 'all'}
                        onValueChange={(value) => handleFilterChange('country_code', value === 'all' ? undefined : value)}
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
                        value={filters.language_code || 'all'}
                        onValueChange={(value) => handleFilterChange('language_code', value === 'all' ? undefined : value)}
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

                    {/* 封禁状态过滤 */}
                    <Select
                        value={filters.is_banned === true ? 'true' : filters.is_banned === false ? 'false' : 'all'}
                        onValueChange={(value) => handleFilterChange('is_banned', value === 'true' ? true : value === 'false' ? false : undefined)}
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
                                <TableHead
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => handleSort('level')}
                                >
                                    等级
                                    {searchParams?.sort_by === 'level' && (
                                        <span className="ml-1">{searchParams?.sort_order === 'desc' ? '↓' : '↑'}</span>
                                    )}
                                </TableHead>
                                <TableHead>国家/语言</TableHead>
                                <TableHead
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => handleSort('credit_score')}
                                >
                                    信用分
                                    {searchParams?.sort_by === 'credit_score' && (
                                        <span className="ml-1">{searchParams?.sort_order === 'desc' ? '↓' : '↑'}</span>
                                    )}
                                </TableHead>
                                <TableHead>状态</TableHead>
                                <TableHead>最后登录</TableHead>
                                <TableHead
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => handleSort('created_at')}
                                >
                                    注册时间
                                    {searchParams?.sort_by === 'created_at' && (
                                        <span className="ml-1">{searchParams?.sort_order === 'desc' ? '↓' : '↑'}</span>
                                    )}
                                </TableHead>
                                <TableHead>操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-8">
                                        <div className="flex items-center justify-center">
                                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                                            <span className="ml-2">加载中...</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : users.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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
                                                <div>
                                                    <div className="font-medium">
                                                        {user.display_name || user.username || '未设置'}
                                                    </div>
                                                    {user.username && user.display_name && (
                                                        <div className="text-sm text-muted-foreground">
                                                            @{user.username}
                                                        </div>
                                                    )}
                                                </div>
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
                                            <Badge variant={user.credit_score >= 80 ? 'default' : user.credit_score >= 60 ? 'secondary' : 'destructive'}>
                                                {user.credit_score}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
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
                                                <Link href={`/dashboard/users/${user.id}`}>
                                                    <Button variant="ghost" size="sm">
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                </Link>
                                                {canEdit && (
                                                    <UserBanToggle user={user} />
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
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={!hasPrev}
                    >
                        <ChevronLeft className="h-4 w-4" />
                        上一页
                    </Button>
                    <div className="flex items-center gap-1">
                        <span className="text-sm">第 {currentPage} 页</span>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={!hasNext}
                    >
                        下一页
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
