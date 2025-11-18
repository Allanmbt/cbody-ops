"use client"

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/ui/loading'
import { ServiceBindGirlsTable } from '@/components/services/ServiceBindGirlsTable'
import { BatchOperationBar } from '@/components/services/BatchOperationBar'
import { SingleOperationDialogs } from '@/components/services/SingleOperationDialogs'
import { useCurrentAdmin } from '@/hooks/use-current-admin'
import type { Service, ServiceDuration, ServiceGirlBindItem, ServiceBindListParams } from '@/lib/features/services'
import {
    getServiceDetail,
    getServiceGirlBindList,
    batchBindGirls,
    batchUnbindGirls,
    batchRestoreGirls,
    bindSingleGirl,
    unbindSingleGirl,
    restoreSingleGirl
} from './actions'
import { getCities, getCategories } from '@/app/dashboard/girls/actions'
import { ArrowLeft } from 'lucide-react'

export default function ServiceBindPage() {
    const params = useParams()
    const router = useRouter()
    const serviceId = parseInt(params.serviceId as string)
    const { admin, loading: adminLoading } = useCurrentAdmin()

    // 服务信息
    const [service, setService] = useState<Service & { durations?: ServiceDuration[] } | null>(null)
    const [serviceLoading, setServiceLoading] = useState(true)

    // 技师列表
    const [girls, setGirls] = useState<ServiceGirlBindItem[]>([])
    const [loading, setLoading] = useState(false)
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0
    })

    // 筛选条件
    const [filters, setFilters] = useState<Omit<ServiceBindListParams, 'page' | 'limit'>>({
        search: '',
        city_id: undefined,
        category_id: undefined,
        bind_status: 'all',
        sort_by: 'girl_number',
        sort_order: 'asc'
    })

    // 选择状态
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [allSelected, setAllSelected] = useState(false)

    // 单个操作对话框
    const [singleOperationDialog, setSingleOperationDialog] = useState<{
        open: boolean
        girlId: string | null
        girlName: string
        type: 'unbind' | 'restore' | null
    }>({
        open: false,
        girlId: null,
        girlName: '',
        type: null
    })

    // 城市和分类数据
    const [cities, setCities] = useState<any[]>([])
    const [categories, setCategories] = useState<any[]>([])

    // 加载服务详情
    const loadServiceDetail = async () => {
        setServiceLoading(true)
        try {
            const result = await getServiceDetail(serviceId)
            if (result.ok && result.data) {
                setService(result.data)
            } else {
                toast.error(result.error || '获取服务信息失败')
            }
        } catch (error) {
            console.error('加载服务详情失败:', error)
            toast.error('加载服务详情失败')
        } finally {
            setServiceLoading(false)
        }
    }

    // 加载技师列表
    const loadGirls = async (params?: Partial<ServiceBindListParams>) => {
        if (!admin?.id) return

        try {
            setLoading(true)
            const queryParams: ServiceBindListParams = {
                page: pagination.page,
                limit: pagination.limit,
                ...filters,
                ...params
            }

            const result = await getServiceGirlBindList(serviceId, queryParams)

            if (result.ok && result.data) {
                setGirls(result.data.data)
                setPagination({
                    page: result.data.page,
                    limit: result.data.limit,
                    total: result.data.total
                })
            } else {
                toast.error(result.error || '获取技师列表失败')
            }
        } catch (error) {
            console.error('加载技师列表失败:', error)
            toast.error('加载技师列表失败')
        } finally {
            setLoading(false)
        }
    }

    // 加载城市和分类
    const loadCitiesAndCategories = async () => {
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

    // 初始加载
    useEffect(() => {
        loadServiceDetail()
        loadCitiesAndCategories()
    }, [serviceId])

    useEffect(() => {
        if (admin?.id && !adminLoading) {
            loadGirls()
        }
    }, [admin?.id, adminLoading])

    // 处理搜索
    const handleSearch = (search: string) => {
        setFilters(prev => ({ ...prev, search }))
        setPagination(prev => ({ ...prev, page: 1 }))
        loadGirls({ search, page: 1 })
    }

    // 处理筛选
    const handleFilter = (key: string, value: string | number | undefined) => {
        setFilters(prev => ({ ...prev, [key]: value }))
        setPagination(prev => ({ ...prev, page: 1 }))
        loadGirls({ [key]: value, page: 1 })
    }

    // 处理分页
    const handlePageChange = (page: number) => {
        setPagination(prev => ({ ...prev, page }))
        loadGirls({ page })
    }

    // 选择操作
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const pageIds = new Set(girls.map(g => g.id))
            setSelectedIds(pageIds)
        } else {
            setSelectedIds(new Set())
        }
        setAllSelected(false)
    }

    const handleSelectOne = (id: string, checked: boolean) => {
        const newSelected = new Set(selectedIds)
        if (checked) {
            newSelected.add(id)
        } else {
            newSelected.delete(id)
        }
        setSelectedIds(newSelected)
        setAllSelected(false)
    }

    const handleSelectAllFiltered = () => {
        setAllSelected(true)
        setSelectedIds(new Set())
    }

    const handleClearSelection = () => {
        setSelectedIds(new Set())
        setAllSelected(false)
    }

    // 批量操作
    const handleBatchBind = async () => {
        if (!admin?.id) return

        const girlIds = allSelected
            ? girls.map(g => g.id) // 这里简化处理，实际应该获取所有符合筛选的ID
            : Array.from(selectedIds)

        if (girlIds.length === 0) {
            toast.error('请选择要绑定的技师')
            return
        }

        const result = await batchBindGirls({
            girl_ids: girlIds,
            service_id: serviceId,
            admin_id: admin.id
        })

        if (result.ok) {
            toast.success(result.message || '批量绑定成功')
            handleClearSelection()
            loadGirls()
        } else {
            toast.error(result.error || '批量绑定失败')
        }
    }

    const handleBatchUnbind = async (notes: string, disableDurations: boolean) => {
        if (!admin?.id) return

        const girlIds = allSelected
            ? girls.map(g => g.id)
            : Array.from(selectedIds)

        if (girlIds.length === 0) {
            toast.error('请选择要解绑的技师')
            return
        }

        const result = await batchUnbindGirls({
            girl_ids: girlIds,
            service_id: serviceId,
            admin_id: admin.id,
            notes,
            disable_durations: disableDurations
        })

        if (result.ok) {
            toast.success(result.message || '批量解绑成功')
            handleClearSelection()
            loadGirls()
        } else {
            toast.error(result.error || '批量解绑失败')
        }
    }

    const handleBatchRestore = async (notes?: string) => {
        if (!admin?.id) return

        const girlIds = allSelected
            ? girls.map(g => g.id)
            : Array.from(selectedIds)

        if (girlIds.length === 0) {
            toast.error('请选择要恢复的技师')
            return
        }

        const result = await batchRestoreGirls({
            girl_ids: girlIds,
            service_id: serviceId,
            admin_id: admin.id,
            notes
        })

        if (result.ok) {
            toast.success(result.message || '批量恢复成功')
            handleClearSelection()
            loadGirls()
        } else {
            toast.error(result.error || '批量恢复失败')
        }
    }

    // 单个操作
    const handleBindSingle = async (girlId: string) => {
        if (!admin?.id) return

        const result = await bindSingleGirl(girlId, serviceId, admin.id)
        if (result.ok) {
            toast.success('绑定成功')
            loadGirls()
        } else {
            toast.error(result.error || '绑定失败')
        }
    }

    const handleUnbindSingle = (girlId: string) => {
        const girl = girls.find(g => g.id === girlId)
        if (!girl) return

        setSingleOperationDialog({
            open: true,
            girlId,
            girlName: girl.name,
            type: 'unbind'
        })
    }

    const handleRestoreSingle = (girlId: string) => {
        const girl = girls.find(g => g.id === girlId)
        if (!girl) return

        setSingleOperationDialog({
            open: true,
            girlId,
            girlName: girl.name,
            type: 'restore'
        })
    }

    const handleSingleOperationConfirm = async (notes?: string, disableDurations?: boolean) => {
        if (!admin?.id || !singleOperationDialog.girlId) return

        if (singleOperationDialog.type === 'unbind' && notes) {
            const result = await unbindSingleGirl(
                singleOperationDialog.girlId,
                serviceId,
                admin.id,
                notes,
                disableDurations
            )
            if (result.ok) {
                toast.success('解绑成功')
                loadGirls()
            } else {
                toast.error(result.error || '解绑失败')
            }
        } else if (singleOperationDialog.type === 'restore') {
            const result = await restoreSingleGirl(
                singleOperationDialog.girlId,
                serviceId,
                admin.id,
                notes
            )
            if (result.ok) {
                toast.success('恢复成功')
                loadGirls()
            } else {
                toast.error(result.error || '恢复失败')
            }
        }
    }

    if (adminLoading || serviceLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <LoadingSpinner />
            </div>
        )
    }

    if (!admin) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">未找到管理员信息</p>
            </div>
        )
    }

    if (!service) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">服务不存在</p>
            </div>
        )
    }

    const activeDurations = service.durations?.filter(d => d.is_active) || []
    const priceRange = activeDurations.length > 0
        ? `${Math.min(...activeDurations.map(d => d.default_price))} - ${Math.max(...activeDurations.map(d => d.default_price))} THB`
        : '未设置'

    return (
        <div className="space-y-6 pb-24">
            {/* 顶部导航 */}
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push('/dashboard/services')}
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    返回服务列表
                </Button>
            </div>

            {/* 服务信息卡 */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-2xl">
                                {service.title.zh || service.title.en}
                            </CardTitle>
                            <CardDescription>
                                {service.description.zh || service.description.en}
                            </CardDescription>
                        </div>
                        <Badge variant={service.is_active ? 'default' : 'secondary'}>
                            {service.is_active ? '已启用' : '未启用'}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                            <div className="text-muted-foreground">服务代码</div>
                            <div className="font-medium">{service.code}</div>
                        </div>
                        <div>
                            <div className="text-muted-foreground">已启用时长</div>
                            <div className="font-medium">{activeDurations.length} 个</div>
                        </div>
                        <div>
                            <div className="text-muted-foreground">价格区间</div>
                            <div className="font-medium">{priceRange}</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 技师列表 */}
            <Card>
                <CardHeader>
                    <CardTitle>技师绑定管理</CardTitle>
                    <CardDescription>
                        为此服务绑定或解绑技师
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ServiceBindGirlsTable
                        girls={girls}
                        total={pagination.total}
                        currentPage={pagination.page}
                        limit={pagination.limit}
                        loading={loading}
                        selectedIds={selectedIds}
                        allSelected={allSelected}
                        onSearch={handleSearch}
                        onFilter={handleFilter}
                        onPageChange={handlePageChange}
                        onSelectAll={handleSelectAll}
                        onSelectOne={handleSelectOne}
                        onSelectAllFiltered={handleSelectAllFiltered}
                        onBindSingle={handleBindSingle}
                        onUnbindSingle={handleUnbindSingle}
                        onRestoreSingle={handleRestoreSingle}
                        cities={cities}
                        categories={categories}
                    />
                </CardContent>
            </Card>

            {/* 批量操作条 */}
            <BatchOperationBar
                selectedCount={selectedIds.size}
                allSelected={allSelected}
                totalCount={pagination.total}
                onBind={handleBatchBind}
                onUnbind={handleBatchUnbind}
                onRestore={handleBatchRestore}
                onClearSelection={handleClearSelection}
                loading={loading}
            />

            {/* 单个操作对话框 */}
            <SingleOperationDialogs
                girlName={singleOperationDialog.girlName}
                operationType={singleOperationDialog.type}
                open={singleOperationDialog.open}
                onClose={() => setSingleOperationDialog({ open: false, girlId: null, girlName: '', type: null })}
                onConfirm={handleSingleOperationConfirm}
            />
        </div>
    )
}
