"use client"

import { useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadingSpinner } from '@/components/ui/loading'
import type { ServiceGirlBindItem } from '@/lib/features/services'

interface ServiceBindGirlsTableProps {
    girls: ServiceGirlBindItem[]
    total: number
    currentPage: number
    limit: number
    loading: boolean
    selectedIds: Set<string>
    allSelected: boolean
    onSearch: (search: string) => void
    onFilter: (key: string, value: string | number | undefined) => void
    onPageChange: (page: number) => void
    onSelectAll: (checked: boolean) => void
    onSelectOne: (id: string, checked: boolean) => void
    onSelectAllFiltered: () => void
    onBindSingle: (girlId: string) => void
    onUnbindSingle: (girlId: string) => void
    onRestoreSingle: (girlId: string) => void
    cities: Array<{ id: number; name: any }>
    categories: Array<{ id: number; name: any }>
}

export function ServiceBindGirlsTable({
    girls,
    total,
    currentPage,
    limit,
    loading,
    selectedIds,
    allSelected,
    onSearch,
    onFilter,
    onPageChange,
    onSelectAll,
    onSelectOne,
    onSelectAllFiltered,
    onBindSingle,
    onUnbindSingle,
    onRestoreSingle,
    cities,
    categories
}: ServiceBindGirlsTableProps) {
    const [searchValue, setSearchValue] = useState('')

    const totalPages = Math.ceil(total / limit)
    const pageGirlsAllSelected = girls.length > 0 && girls.every(g => selectedIds.has(g.id))

    const handleSearch = () => {
        onSearch(searchValue)
    }

    const handlePageSelect = (checked: boolean) => {
        onSelectAll(checked)
    }

    return (
        <div className="space-y-4">
            {/* 筛选区 */}
            <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                    <div className="flex gap-2">
                        <Input
                            placeholder="搜索技师名称/工号..."
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                        <Button onClick={handleSearch}>搜索</Button>
                    </div>
                </div>

                <Select onValueChange={(v) => onFilter('city_id', v === 'all' ? undefined : parseInt(v))}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="选择城市" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">全部城市</SelectItem>
                        {cities.map(city => (
                            <SelectItem key={city.id} value={city.id.toString()}>
                                {city.name.zh || city.name.en}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select onValueChange={(v) => onFilter('category_id', v === 'all' ? undefined : parseInt(v))}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="选择分组" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">全部分组</SelectItem>
                        {categories.map(cat => (
                            <SelectItem key={cat.id} value={cat.id.toString()}>
                                {cat.name.zh || cat.name.en}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select defaultValue="all" onValueChange={(v) => onFilter('bind_status', v)}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="绑定状态" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">全部状态</SelectItem>
                        <SelectItem value="bound-enabled">已绑定(合格)</SelectItem>
                        <SelectItem value="bound-disabled">已绑定(禁用)</SelectItem>
                        <SelectItem value="unbound">未绑定</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Gmail式跨页选择提示 */}
            {pageGirlsAllSelected && !allSelected && girls.length < total && (
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-center justify-between">
                    <span className="text-sm text-blue-900 dark:text-blue-100">
                        已选择本页所有 {girls.length} 条记录
                    </span>
                    <Button
                        variant="link"
                        size="sm"
                        onClick={onSelectAllFiltered}
                        className="text-blue-600 dark:text-blue-400"
                    >
                        选择所有符合筛选的 {total} 条记录
                    </Button>
                </div>
            )}

            {allSelected && (
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <span className="text-sm text-blue-900 dark:text-blue-100">
                        已选择所有符合筛选的 {total} 条记录
                    </span>
                </div>
            )}

            {/* 表格 */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]">
                                <Checkbox
                                    checked={pageGirlsAllSelected}
                                    onCheckedChange={handlePageSelect}
                                    disabled={loading || girls.length === 0}
                                />
                            </TableHead>
                            <TableHead>头像</TableHead>
                            <TableHead>工号</TableHead>
                            <TableHead>姓名</TableHead>
                            <TableHead>城市/分组</TableHead>
                            <TableHead>绑定状态</TableHead>
                            <TableHead>已启用时长</TableHead>
                            <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center h-32">
                                    <LoadingSpinner />
                                </TableCell>
                            </TableRow>
                        ) : girls.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center text-muted-foreground h-32">
                                    暂无数据
                                </TableCell>
                            </TableRow>
                        ) : (
                            girls.map((girl) => (
                                <TableRow key={girl.id}>
                                    <TableCell>
                                        <Checkbox
                                            checked={selectedIds.has(girl.id) || allSelected}
                                            onCheckedChange={(checked) => onSelectOne(girl.id, checked as boolean)}
                                            disabled={allSelected}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={girl.avatar_url || undefined} />
                                            <AvatarFallback>{girl.name[0]}</AvatarFallback>
                                        </Avatar>
                                    </TableCell>
                                    <TableCell className="font-mono">{girl.girl_number}</TableCell>
                                    <TableCell className="font-medium">{girl.name}</TableCell>
                                    <TableCell>
                                        <div className="space-y-1">
                                            {girl.city && (
                                                <div className="text-sm">{girl.city.name.zh || girl.city.name.en}</div>
                                            )}
                                            <div className="flex flex-wrap gap-1">
                                                {girl.categories?.slice(0, 2).map(cat => (
                                                    <Badge key={cat.id} variant="outline" className="text-xs">
                                                        {cat.name.zh || cat.name.en}
                                                    </Badge>
                                                ))}
                                                {girl.categories && girl.categories.length > 2 && (
                                                    <Badge variant="outline" className="text-xs">
                                                        +{girl.categories.length - 2}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {!girl.binding ? (
                                            <Badge variant="outline">未绑定</Badge>
                                        ) : girl.binding.is_qualified ? (
                                            <Badge className="bg-green-500">已绑定</Badge>
                                        ) : (
                                            <Badge variant="secondary">已禁用</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {girl.binding ? (
                                            <span className="text-sm">{girl.binding.enabled_durations_count} 个</span>
                                        ) : (
                                            <span className="text-sm text-muted-foreground">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            {!girl.binding ? (
                                                <Button
                                                    size="sm"
                                                    onClick={() => onBindSingle(girl.id)}
                                                >
                                                    绑定
                                                </Button>
                                            ) : girl.binding.is_qualified ? (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => onUnbindSingle(girl.id)}
                                                >
                                                    禁用
                                                </Button>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => onRestoreSingle(girl.id)}
                                                >
                                                    恢复
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* 分页 */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                        共 {total} 条记录，第 {currentPage} / {totalPages} 页
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPageChange(currentPage - 1)}
                            disabled={currentPage === 1 || loading}
                        >
                            上一页
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPageChange(currentPage + 1)}
                            disabled={currentPage === totalPages || loading}
                        >
                            下一页
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
