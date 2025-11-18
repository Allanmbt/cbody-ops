"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, Plus, Filter, RotateCcw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LoadingSpinner } from "@/components/ui/loading"
import { toast } from "sonner"
import { ServiceTable } from "@/components/services/ServiceTable"
import { ServiceFormDialog } from "@/components/services/ServiceFormDialog"
import { ServiceDurationsDrawer } from "@/components/services/ServiceDurationsDrawer"
import type { Service, Category, ServiceListParams, PaginatedResponse } from "@/lib/features/services"
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
        category_id: 1, // 默认选择第一个分类
        is_active: undefined,
        sort_by: 'sort_order',
        sort_order: 'asc'
    })

    // 对话框状态
    const [showServiceDialog, setShowServiceDialog] = useState(false)
    const [editingService, setEditingService] = useState<Service | null>(null)
    const [showDurationsDrawer, setShowDurationsDrawer] = useState(false)
    const [selectedService, setSelectedService] = useState<Service | null>(null)

    // 加载分类列表
    const loadCategories = useCallback(async () => {
        try {
            const result = await getCategories()
            if (result.ok && result.data) {
                setCategories(result.data)
                // 默认选择 wellness 分类
                const wellnessCategory = result.data.find(cat => cat.code === 'wellness')
                if (wellnessCategory && !filters.category_id) {
                    setFilters(prev => ({ ...prev, category_id: wellnessCategory.id }))
                }
            }
        } catch (error) {
            console.error('加载分类失败:', error)
        }
    }, [filters.category_id])

    // 加载服务列表
    const loadServices = useCallback(async (params: ServiceListParams = filters) => {
        setLoading(true)
        try {
            const result = await getServices(params as any)
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
    }, [filters])

    // 初始化数据
    useEffect(() => {
        loadCategories()
        loadServices()
    }, [loadCategories, loadServices])

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

    const getCategoryName = (category: Category): string => {
        return category.name.zh || category.name.en || category.name.th || category.code
    }

    return (
        <div className="space-y-6">
            {/* 页面标题 */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">服务管理</h1>
                {/* <p className="text-muted-foreground">
                    管理平台服务项目和定价策略
                </p> */}
            </div>


            {/* 工具栏 */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">筛选和搜索</CardTitle>
                    {/* <CardDescription>使用下方工具筛选和搜索服务</CardDescription> */}
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col gap-4 md:flex-row md:items-end">
                        {/* 搜索 */}
                        <div className="flex-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    id="search"
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
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="active-only"
                                checked={filters.is_active === true}
                                onCheckedChange={handleActiveFilter}
                            />
                            <Label htmlFor="active-only" className="text-sm">
                                仅显示上架
                            </Label>
                        </div>

                        {/* 操作按钮 */}
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleResetFilters}>
                                重置
                            </Button>
                            <Button onClick={handleCreateService}>
                                <Plus className="mr-2 h-4 w-4" />
                                新建服务
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 服务列表 */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>服务列表</CardTitle>
                            <CardDescription>
                                共 {pagination.total} 个服务，当前第 {pagination.page} 页
                            </CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleRefresh}>
                            刷新
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <ServiceTable
                        services={services}
                        loading={loading}
                        onEdit={handleEditService}
                        onManageDurations={handleManageDurations}
                        onRefresh={handleRefresh}
                    />

                    {/* 分页 */}
                    {pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between mt-6">
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
                                <div className="flex items-center gap-1">
                                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                                        const page = i + 1
                                        return (
                                            <Button
                                                key={page}
                                                variant={page === pagination.page ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => handlePageChange(page)}
                                            >
                                                {page}
                                            </Button>
                                        )
                                    })}
                                </div>
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
