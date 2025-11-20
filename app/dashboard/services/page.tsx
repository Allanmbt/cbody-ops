"use client"

import { useState, useEffect } from "react"
import { Search, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { ServiceTable } from "@/components/services/ServiceTable"
import { ServiceFormDialog } from "@/components/services/ServiceFormDialog"
import { ServiceDurationsDrawer } from "@/components/services/ServiceDurationsDrawer"
import { ServiceStatsCards } from "@/components/services/ServiceStatsCards"
import type { Service, Category, ServiceListParams, PaginatedResponse } from "@/lib/features/services"
import { getCategoryName } from "@/lib/features/services"
import { getServices, getCategories } from "./actions"

export default function ServicesPage() {
    const [services, setServices] = useState<Service[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0
    })

    // 筛选状态
    const [filters, setFilters] = useState<ServiceListParams>({
        page: 1,
        limit: 20,
        search: '',
        category_id: undefined,
        is_active: undefined,
        sort_by: 'sort_order',
        sort_order: 'asc'
    })

    // 对话框状态
    const [showServiceDialog, setShowServiceDialog] = useState(false)
    const [editingService, setEditingService] = useState<Service | null>(null)
    const [showDurationsDrawer, setShowDurationsDrawer] = useState(false)
    const [selectedService, setSelectedService] = useState<Service | null>(null)

    // 加载分类列表(只加载一次)
    useEffect(() => {
        async function loadCategories() {
            try {
                const result = await getCategories()
                if (result.ok && result.data) {
                    setCategories(result.data)
                    // 默认选择 wellness 分类
                    const wellnessCategory = result.data.find(cat => cat.code === 'wellness')
                    if (wellnessCategory) {
                        setFilters(prev => ({ ...prev, category_id: wellnessCategory.id }))
                    }
                }
            } catch (error) {
                console.error('加载分类失败:', error)
            }
        }
        loadCategories()
    }, [])

    // 加载服务列表
    const loadServices = async (params?: ServiceListParams) => {
        setLoading(true)
        try {
            const queryParams = params || filters
            const result = await getServices(queryParams as any)
            if (result.ok && result.data) {
                const data = result.data as PaginatedResponse<Service>
                setServices(data.data)
                setPagination({
                    page: data.page,
                    limit: data.limit,
                    total: data.total,
                    totalPages: data.totalPages
                })
            } else {
                toast.error(result.error || '加载服务列表失败')
            }
        } catch (error) {
            console.error('加载服务失败:', error)
            toast.error('加载服务列表失败')
        } finally {
            setLoading(false)
        }
    }

    // 初始化数据(仅在分类加载后)
    useEffect(() => {
        if (filters.category_id) {
            loadServices()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.category_id])

    // 搜索处理
    const handleSearch = (value: string) => {
        const newFilters = { ...filters, search: value, page: 1 }
        setFilters(newFilters)
        loadServices(newFilters)
    }

    // 分类筛选
    const handleCategoryFilter = (categoryId: string) => {
        const newFilters = {
            ...filters,
            category_id: parseInt(categoryId),
            page: 1
        }
        setFilters(newFilters)
        loadServices(newFilters)
    }

    // 状态筛选
    const handleActiveFilter = (checked: boolean) => {
        const newFilters = {
            ...filters,
            is_active: checked ? true : undefined,
            page: 1
        }
        setFilters(newFilters)
        loadServices(newFilters)
    }

    // 重置筛选
    const handleResetFilters = () => {
        // 找到 wellness 分类作为默认值
        const wellnessCategory = categories.find(cat => cat.code === 'wellness')
        const defaultCategoryId = wellnessCategory ? wellnessCategory.id : categories[0]?.id || 1

        const newFilters: ServiceListParams = {
            page: 1,
            limit: 20,
            search: '',
            category_id: defaultCategoryId,
            is_active: undefined,
            sort_by: 'sort_order',
            sort_order: 'asc'
        }
        setFilters(newFilters)
        loadServices(newFilters)
    }

    // 分页处理
    const handlePageChange = (newPage: number) => {
        const newFilters = { ...filters, page: newPage }
        setFilters(newFilters)
        loadServices(newFilters)
    }

    // 新建服务
    const handleCreateService = () => {
        setEditingService(null)
        setShowServiceDialog(true)
    }

    // 编辑服务
    const handleEditService = (service: Service) => {
        setEditingService(service)
        setShowServiceDialog(true)
    }

    // 管理时长定价
    const handleManageDurations = (service: Service) => {
        setSelectedService(service)
        setShowDurationsDrawer(true)
    }

    // 刷新列表
    const handleRefresh = () => {
        loadServices()
    }

    return (
        <div className="flex flex-col gap-6 p-4 md:px-8 md:py-6">
            {/* 页面标题 */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">服务管理</h1>
                <Button onClick={handleCreateService}>
                    <Plus className="mr-2 h-4 w-4" />
                    新建服务
                </Button>
            </div>

            {/* 统计卡片 */}
            <ServiceStatsCards />

            {/* 筛选区域 */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center">
                        {/* 搜索 */}
                        <div className="flex-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="搜索服务代码或名称..."
                                    value={filters.search || ''}
                                    onChange={(e) => handleSearch(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>

                        {/* 分类筛选 */}
                        <div className="w-full md:w-48">
                            <Select
                                value={filters.category_id?.toString() || ''}
                                onValueChange={handleCategoryFilter}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="选择分类" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map((category) => (
                                        <SelectItem key={category.id} value={category.id.toString()}>
                                            {getCategoryName(category)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* 状态筛选 */}
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="active-only"
                                checked={filters.is_active === true}
                                onCheckedChange={handleActiveFilter}
                            />
                            <Label htmlFor="active-only" className="text-sm cursor-pointer">
                                仅显示上架
                            </Label>
                        </div>

                        {/* 重置按钮 */}
                        <Button variant="outline" onClick={handleResetFilters}>
                            重置
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* 服务列表 */}
            <Card>
                <CardHeader>
                    <CardTitle>服务列表</CardTitle>
                </CardHeader>
                <CardContent>
                    <ServiceTable
                        services={services}
                        loading={loading}
                        onEdit={handleEditService}
                        onManageDurations={handleManageDurations}
                        onRefresh={handleRefresh}
                    />

                    {/* 分页 - 统一规范 */}
                    {!loading && pagination.total > 0 && (
                        <div className="flex items-center justify-between mt-4">
                            <div className="text-sm text-muted-foreground">
                                显示 {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} 条，共 {pagination.total} 条
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handlePageChange(pagination.page - 1)}
                                    disabled={pagination.page <= 1}
                                >
                                    上一页
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled
                                >
                                    第 {pagination.page} 页
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handlePageChange(pagination.page + 1)}
                                    disabled={pagination.page >= pagination.totalPages}
                                >
                                    下一页
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 服务表单对话框 */}
            <ServiceFormDialog
                open={showServiceDialog}
                onOpenChange={setShowServiceDialog}
                service={editingService}
                onSuccess={handleRefresh}
            />

            {/* 时长定价抽屉 */}
            <ServiceDurationsDrawer
                open={showDurationsDrawer}
                onOpenChange={setShowDurationsDrawer}
                service={selectedService}
            />
        </div>
    )
}
