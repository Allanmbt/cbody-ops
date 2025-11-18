"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { LoadingSpinner } from "@/components/ui/loading"
import { Plus, Search } from "lucide-react"
import { GirlTable } from "@/components/girls/GirlTable"
import { GirlFormDialog } from "@/components/girls/GirlFormDialog"
import { GirlStatusDrawer } from "@/components/girls/GirlStatusDrawer"
import {
    getGirls,
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

    // 分页状态
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0
    })

    // 筛选状态
    const [filters, setFilters] = useState<Omit<GirlListParams, 'page' | 'limit'>>({
        search: '',
        city_id: undefined,
        category_id: undefined,
        status: undefined as GirlStatusType | undefined,
        is_verified: undefined,
        is_blocked: undefined, // 改为is_blocked筛选: all/true/false
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

            const result = await getGirls(queryParams as any)

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
                            <p className="text-sm text-muted-foreground">
                                当前共有 {pagination.total} 个技师
                            </p>
                        </CardHeader>
                        <CardContent>
                            {/* 搜索和筛选 */}
                            <div className="flex items-center gap-4 mb-6">
                                <div className="relative flex-1 max-w-sm">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground" />
                                    <Input
                                        placeholder="搜索工号、用户名..."
                                        value={filters.search}
                                        onChange={(e) => handleSearch(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                                <Button
                                    variant="outline"
                                    onClick={handleResetFilters}
                                >
                                    刷新
                                </Button>
                            </div>

                            {/* 筛选器 */}
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

                                <Select
                                    value={filters.status || 'all'}
                                    onValueChange={(value) => handleFilter('status', value === 'all' ? undefined : value)}
                                >
                                    <SelectTrigger className="w-[140px]">
                                        <SelectValue placeholder="在线状态" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">全部状态</SelectItem>
                                        <SelectItem value="available">在线</SelectItem>
                                        <SelectItem value="busy">忙碌</SelectItem>
                                        <SelectItem value="offline">离线</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Select
                                    value={filters.is_verified?.toString() || 'all'}
                                    onValueChange={(value) => handleFilter('is_verified', value === 'all' ? undefined : value === 'true')}
                                >
                                    <SelectTrigger className="w-[140px]">
                                        <SelectValue placeholder="认证状态" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">全部</SelectItem>
                                        <SelectItem value="true">已认证</SelectItem>
                                        <SelectItem value="false">未认证</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Select
                                    value={filters.is_blocked === undefined ? 'all' : filters.is_blocked ? 'blocked' : 'active'}
                                    onValueChange={(value) => handleFilter('is_blocked', value === 'all' ? undefined : value === 'blocked')}
                                >
                                    <SelectTrigger className="w-[140px]">
                                        <SelectValue placeholder="是否屏蔽" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">全部</SelectItem>
                                        <SelectItem value="blocked">仅屏蔽</SelectItem>
                                        <SelectItem value="active">仅活跃</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Select
                                    value={`${filters.sort_by}_${filters.sort_order}`}
                                    onValueChange={(value) => {
                                        const [sort_by, sort_order] = value.split('_')
                                        handleFilter('sort_by', sort_by)
                                        handleFilter('sort_order', sort_order)
                                    }}
                                >
                                    <SelectTrigger className="w-[140px]">
                                        <SelectValue placeholder="排序" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="sort_order_asc">权重升序</SelectItem>
                                        <SelectItem value="sort_order_desc">权重降序</SelectItem>
                                        <SelectItem value="created_at_desc">创建时间</SelectItem>
                                        <SelectItem value="rating_desc">评分高低</SelectItem>
                                        <SelectItem value="total_sales_desc">销量高低</SelectItem>
                                        <SelectItem value="trust_score_desc">诚信分</SelectItem>
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
                            {/* 分页 */}
                            {pagination.totalPages > 1 && (
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div className="text-sm text-muted-foreground">
                                        第 {pagination.page} 页，共 {pagination.totalPages} 页
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handlePageChange(pagination.page - 1)}
                                            disabled={pagination.page <= 1 || loading}
                                        >
                                            上一页
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handlePageChange(pagination.page + 1)}
                                            disabled={pagination.page >= pagination.totalPages || loading}
                                        >
                                            下一页
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
