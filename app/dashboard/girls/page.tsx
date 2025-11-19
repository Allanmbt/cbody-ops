"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { LoadingSpinner } from "@/components/ui/loading"
import { Plus, Search, ChevronLeft, ChevronRight } from "lucide-react"
import { GirlTable } from "@/components/girls/GirlTable"
import { GirlFormDialog } from "@/components/girls/GirlFormDialog"
import { GirlStatusDrawer } from "@/components/girls/GirlStatusDrawer"
import {
    getGirlsProfileList,
    getCities,
    getCategories,
    toggleGirlBlockedStatus,
    toggleGirlVerifiedStatus
} from "./actions"
import type {
    GirlWithStatus,
    GirlListParams,
    PaginatedResponse,
    GirlStatusType
} from "@/lib/features/girls"

export default function GirlsPage() {
    const [girls, setGirls] = useState<GirlWithStatus[]>([])
    const [loading, setLoading] = useState(true)
    const [cities, setCities] = useState<any[]>([])
    const [categories, setCategories] = useState<any[]>([])

    // 分页状态（默认每页10条，提升响应速度）
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0
    })

    // 筛选状态：默认只展示“已通过”的技师
    const [filters, setFilters] = useState<Omit<GirlListParams, 'page' | 'limit'>>({
        search: '',
        city_id: undefined,
        category_id: undefined,
        status: undefined as GirlStatusType | undefined,
        is_verified: undefined,
        is_blocked: undefined,
        review_status: 'approved',
        sort_by: 'sort_order',
        sort_order: 'asc'
    })

    // 对话框状态
    const [showFormDialog, setShowFormDialog] = useState(false)
    const [editingGirl, setEditingGirl] = useState<GirlWithStatus | null>(null)

    // 状态抽屉
    const [showStatusDrawer, setShowStatusDrawer] = useState(false)
    const [statusGirl, setStatusGirl] = useState<GirlWithStatus | null>(null)

    // 加载城市和分类
    useEffect(() => {
        async function loadData() {
            const [citiesResult, categoriesResult] = await Promise.all([
                getCities(),
                getCategories()
            ])

            if (citiesResult.ok && citiesResult.data) {
                setCities(citiesResult.data)
            }

            if (categoriesResult.ok && categoriesResult.data) {
                setCategories(categoriesResult.data)
            }
        }

        loadData()
    }, [])

    // 加载技师列表
    const loadGirls = async (params?: Partial<GirlListParams>) => {
        try {
            setLoading(true)
            const queryParams: GirlListParams = {
                page: pagination.page,
                limit: pagination.limit,
                ...filters,
                ...params
            }

            const result = await getGirlsProfileList(queryParams as any)

            if (result.ok && result.data) {
                setGirls(result.data.data)
                setPagination({
                    page: result.data.page,
                    limit: result.data.limit,
                    total: result.data.total,
                    totalPages: result.data.totalPages
                })
            } else {
                toast.error(result.error || "获取技师列表失败")
            }
        } catch (error) {
            console.error('加载技师列表失败:', error)
            toast.error("加载技师列表失败")
        } finally {
            setLoading(false)
        }
    }

    // 初始加载
    useEffect(() => {
        loadGirls()
    }, [])

    // 处理搜索
    const handleSearch = (search: string) => {
        setFilters(prev => ({ ...prev, search }))
        setPagination(prev => ({ ...prev, page: 1 }))
        loadGirls({ search, page: 1 })
    }

    // 处理筛选
    const handleFilter = (key: keyof typeof filters, value: any) => {
        setFilters(prev => ({ ...prev, [key]: value }))
        setPagination(prev => ({ ...prev, page: 1 }))
        loadGirls({ [key]: value, page: 1 })
    }

    // 处理分页
    const handlePageChange = (page: number) => {
        setPagination(prev => ({ ...prev, page }))
        loadGirls({ page })
    }

    // 重置筛选
    const handleResetFilters = () => {
        const resetFilters = {
            search: '',
            city_id: undefined,
            category_id: undefined,
            status: undefined as GirlStatusType | undefined,
            is_verified: undefined,
            is_blocked: undefined,
            review_status: 'approved' as const,
            sort_by: 'sort_order' as const,
            sort_order: 'asc' as const
        }
        setFilters(resetFilters)
        setPagination(prev => ({ ...prev, page: 1 }))
        loadGirls({ ...resetFilters, page: 1 })
    }

    // 新建技师
    const handleAdd = () => {
        setEditingGirl(null)
        setShowFormDialog(true)
    }

    // 编辑技师
    const handleEdit = (girl: GirlWithStatus) => {
        setEditingGirl(girl)
        setShowFormDialog(true)
    }

    // 表单成功回调
    const handleFormSuccess = () => {
        loadGirls()
    }

    // 切换屏蔽状态
    const handleToggleBlocked = async (girl: GirlWithStatus) => {
        try {
            const result = await toggleGirlBlockedStatus(girl.id)
            if (result.ok) {
                toast.success(girl.is_blocked ? "技师已解除屏蔽" : "技师已屏蔽")
                loadGirls()
            } else {
                toast.error(result.error || "操作失败")
            }
        } catch (error) {
            console.error('切换屏蔽状态失败:', error)
            toast.error("操作失败")
        }
    }

    // 切换认证状态
    const handleToggleVerified = async (girl: GirlWithStatus) => {
        try {
            const result = await toggleGirlVerifiedStatus(girl.id)
            if (result.ok) {
                toast.success(girl.is_verified ? "技师认证已取消" : "技师已认证")
                loadGirls()
            } else {
                toast.error(result.error || "操作失败")
            }
        } catch (error) {
            console.error('切换认证状态失败:', error)
            toast.error("操作失败")
        }
    }

    // 管理状态
    const handleManageStatus = (girl: GirlWithStatus) => {
        setStatusGirl(girl)
        setShowStatusDrawer(true)
    }

    // 管理媒体（暂时占位）
    const handleManageMedia = (girl: GirlWithStatus) => {
        toast.info("媒体管理功能即将开放")
    }

    // 状态成功回调
    const handleStatusSuccess = () => {
        loadGirls()
    }

    return (
        <>
            {/* 页面标题 */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-semibold">技师管理</h1>
                    <p className="text-muted-foreground">管理技师信息、状态和位置</p>
                </div>
                <Button onClick={handleAdd} className="gap-2">
                    <Plus className="size-4" />
                    新建技师
                </Button>
            </div>

            <div className="grid gap-6">
                <div>
                    <Card>
                        <CardHeader>
                            <h2 className="text-lg font-semibold">技师列表</h2>
                        </CardHeader>
                        <CardContent>
                            {/* 搜索 + 审核状态导航 + 基础筛选（自适应换行，移动端友好） */}
                            <div className="flex flex-wrap items-center gap-3 mb-4">
                                {/* 搜索框 */}
                                <div className="relative flex-1 min-w-[220px] max-w-md">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground" />
                                    <Input
                                        placeholder="搜索工号、用户名..."
                                        value={filters.search}
                                        onChange={(e) => handleSearch(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>

                                {/* 刷新按钮 */}
                                <Button
                                    variant="outline"
                                    onClick={handleResetFilters}
                                >
                                    重置筛选
                                </Button>

                                {/* 审核状态导航：已通过 / 未审核 / 已注销 */}
                                <div className="flex flex-wrap gap-2 ml-auto">
                                    {([
                                        { key: 'approved', label: '已通过' },
                                        { key: 'pending', label: '未审核' },
                                        { key: 'deleted', label: '已注销' },
                                    ] as const).map((tab) => {
                                        const isActive = (filters.review_status || 'approved') === tab.key
                                        return (
                                            <Button
                                                key={tab.key}
                                                size="sm"
                                                variant={isActive ? "default" : "outline"}
                                                className="px-3"
                                                onClick={() => handleFilter('review_status', tab.key)}
                                            >
                                                {tab.label}
                                            </Button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* 城市 / 分类筛选：保持轻量，仅做资料检索 */}
                            <div className="flex flex-wrap gap-2 mb-6">
                                <Select
                                    value={filters.city_id?.toString() || 'all'}
                                    onValueChange={(value) => handleFilter('city_id', value === 'all' ? undefined : parseInt(value))}
                                >
                                    <SelectTrigger className="w-[140px]">
                                        <SelectValue placeholder="选择城市" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">全部城市</SelectItem>
                                        {cities.map((city) => (
                                            <SelectItem key={city.id} value={city.id.toString()}>
                                                {city.name.zh || city.name.en || city.name.th}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select
                                    value={filters.category_id?.toString() || 'all'}
                                    onValueChange={(value) => handleFilter('category_id', value === 'all' ? undefined : parseInt(value))}
                                >
                                    <SelectTrigger className="w-[140px]">
                                        <SelectValue placeholder="选择分类" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">全部分类</SelectItem>
                                        {categories.map((category) => (
                                            <SelectItem key={category.id} value={category.id.toString()}>
                                                {category.name.zh || category.name.en || category.name.th}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* 技师表格 */}
                            <div className="rounded-md border overflow-hidden">
                                <div className="overflow-x-auto">
                                    <GirlTable
                                        girls={girls}
                                        loading={loading}
                                        onEdit={handleEdit}
                                        onToggleBlocked={handleToggleBlocked}
                                        onToggleVerified={handleToggleVerified}
                                        onManageStatus={handleManageStatus}
                                        onManageMedia={handleManageMedia}
                                    />
                                </div>
                            </div>
                            {/* 分页：与用户管理保持一致的布局 */}
                            {pagination.total > 0 && (
                                <div className="flex items-center justify-between mt-4">
                                    <div className="text-sm text-muted-foreground">
                                        显示 {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} 条，共 {pagination.total} 条
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handlePageChange(pagination.page - 1)}
                                            disabled={pagination.page <= 1 || loading}
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                            上一页
                                        </Button>
                                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                            第 {pagination.page} 页
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handlePageChange(pagination.page + 1)}
                                            disabled={pagination.page * pagination.limit >= pagination.total || loading}
                                        >
                                            下一页
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}

                        </CardContent>
                    </Card>
                </div>
            </div>


            {/* 表单对话框 */}
            <GirlFormDialog
                open={showFormDialog}
                onOpenChange={setShowFormDialog}
                girl={editingGirl}
                onSuccess={handleFormSuccess}
            />

            {/* 状态管理抽屉 */}
            <GirlStatusDrawer
                open={showStatusDrawer}
                onOpenChange={setShowStatusDrawer}
                girl={statusGirl}
                onSuccess={handleStatusSuccess}
            />
        </>
    )
}
