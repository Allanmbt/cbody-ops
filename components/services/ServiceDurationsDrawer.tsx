"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Edit, Trash2, Eye, EyeOff } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { ButtonLoading, LoadingSpinner } from "@/components/ui/loading"
import { toast } from "sonner"
import { serviceDurationFormSchema, type ServiceDurationFormData } from "@/lib/validations/service"
import type { Service, ServiceDuration } from "@/lib/types/service"
import {
    getServiceDurations,
    createServiceDuration,
    updateServiceDuration,
    toggleDurationStatus,
    deleteServiceDuration
} from "@/app/dashboard/services/actions"

interface ServiceDurationsDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    service: Service | null
}

const durationOptions = [
    { value: 30, label: '30分钟' },
    { value: 60, label: '1小时' },
    { value: 90, label: '1.5小时' },
    { value: 120, label: '2小时' },
    { value: 150, label: '2.5小时' },
    { value: 180, label: '3小时' },
    { value: 240, label: '4小时' },
    { value: 300, label: '5小时' },
    { value: 360, label: '6小时' },
    { value: 480, label: '8小时' },
]

export function ServiceDurationsDrawer({
    open,
    onOpenChange,
    service
}: ServiceDurationsDrawerProps) {
    const [durations, setDurations] = useState<ServiceDuration[]>([])
    const [loading, setLoading] = useState(false)
    const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({})
    const [showForm, setShowForm] = useState(false)
    const [editingDuration, setEditingDuration] = useState<ServiceDuration | null>(null)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<ServiceDuration | null>(null)

    const form = useForm<ServiceDurationFormData>({
        resolver: zodResolver(serviceDurationFormSchema) as any,
        defaultValues: {
            duration_minutes: 60,
            default_price: 1000,
            min_price: 800,
            max_price: 1200,
            is_active: true,
        }
    })

    // 加载时长列表
    const loadDurations = async () => {
        if (!service) return

        setLoading(true)
        try {
            const result = await getServiceDurations(service.id)
            if (result.ok && result.data) {
                setDurations(result.data)
            } else {
                toast.error(result.error || '获取时长列表失败')
            }
        } catch (error) {
            console.error('加载时长列表失败:', error)
            toast.error('加载时长列表失败')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (open && service) {
            loadDurations()
        }
    }, [open, service])

    // 重置表单
    const resetForm = () => {
        form.reset({
            duration_minutes: 60,
            default_price: 1000,
            min_price: 800,
            max_price: 1200,
            is_active: true,
        })
        setEditingDuration(null)
    }

    // 打开新建表单
    const handleAdd = () => {
        resetForm()
        setShowForm(true)
    }

    // 打开编辑表单
    const handleEdit = (duration: ServiceDuration) => {
        form.reset({
            duration_minutes: duration.duration_minutes,
            default_price: duration.default_price,
            min_price: duration.min_price,
            max_price: duration.max_price,
            is_active: duration.is_active,
        })
        setEditingDuration(duration)
        setShowForm(true)
    }

    // 提交表单
    const onSubmit = async (data: ServiceDurationFormData) => {
        if (!service) return

        const actionKey = editingDuration ? `edit-${editingDuration.id}` : 'create'
        setActionLoading(prev => ({ ...prev, [actionKey]: true }))

        try {
            const result = editingDuration
                ? await updateServiceDuration(editingDuration.id, data)
                : await createServiceDuration(service.id, data)

            if (result.ok) {
                toast.success(editingDuration ? '时长更新成功' : '时长创建成功')
                setShowForm(false)
                resetForm()
                loadDurations()
            } else {
                toast.error(result.error || '操作失败')
            }
        } catch (error) {
            console.error('提交失败:', error)
            toast.error('操作失败，请重试')
        } finally {
            setActionLoading(prev => ({ ...prev, [actionKey]: false }))
        }
    }

    // 切换状态
    const handleToggleStatus = async (duration: ServiceDuration) => {
        const actionKey = `toggle-${duration.id}`
        setActionLoading(prev => ({ ...prev, [actionKey]: true }))

        try {
            const result = await toggleDurationStatus(duration.id)
            if (result.ok) {
                toast.success(`时长已${duration.is_active ? '禁用' : '启用'}`)
                loadDurations()
            } else {
                toast.error(result.error || '操作失败')
            }
        } catch (error) {
            console.error('切换状态失败:', error)
            toast.error('操作失败，请重试')
        } finally {
            setActionLoading(prev => ({ ...prev, [actionKey]: false }))
        }
    }

    // 删除时长
    const handleDelete = async (duration: ServiceDuration) => {
        const actionKey = `delete-${duration.id}`
        setActionLoading(prev => ({ ...prev, [actionKey]: true }))

        try {
            const result = await deleteServiceDuration(duration.id)
            if (result.ok) {
                toast.success('时长删除成功')
                setShowDeleteConfirm(null)
                loadDurations()
            } else {
                toast.error(result.error || '删除失败')
            }
        } catch (error) {
            console.error('删除失败:', error)
            toast.error('删除失败，请重试')
        } finally {
            setActionLoading(prev => ({ ...prev, [actionKey]: false }))
        }
    }

    // 格式化时长显示
    const formatDuration = (minutes: number): string => {
        const option = durationOptions.find(opt => opt.value === minutes)
        return option ? option.label : `${minutes}分钟`
    }

    // 格式化价格显示
    const formatPrice = (price: number): string => {
        return `₿${price.toLocaleString()}`
    }

    const handleClose = () => {
        if (!Object.values(actionLoading).some(Boolean)) {
            onOpenChange(false)
            setShowForm(false)
            resetForm()
        }
    }

    return (
        <>
            <Sheet open={open} onOpenChange={handleClose}>
                <SheetContent className="w-full sm:w-[600px] sm:max-w-[600px] overflow-y-auto px-4 sm:px-6">
                    <SheetHeader className="px-2 sm:px-0">
                        <SheetTitle className="text-lg sm:text-xl">时长定价管理</SheetTitle>
                        <SheetDescription className="text-sm">
                            管理 "{service?.title.zh || service?.title.en || service?.code}" 的时长和定价
                        </SheetDescription>
                    </SheetHeader>

                    <div className="mt-4 sm:mt-6 px-2 sm:px-0">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4">
                            <h3 className="text-lg font-semibold">时长列表</h3>
                            <Button onClick={handleAdd} disabled={loading} className="w-full sm:w-auto">
                                <Plus className="mr-2 h-4 w-4" />
                                <span className="sm:inline">添加时长</span>
                            </Button>
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-8">
                                <LoadingSpinner size="lg" />
                            </div>
                        ) : durations.length === 0 ? (
                            <div className="text-center py-8">
                                <div className="text-muted-foreground text-sm">暂无时长配置</div>
                                <div className="text-xs text-muted-foreground mt-1">点击"添加时长"按钮开始配置</div>
                            </div>
                        ) : (
                            <div className="rounded-md border overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="min-w-[80px]">时长</TableHead>
                                            <TableHead className="min-w-[100px] hidden sm:table-cell">默认价格</TableHead>
                                            <TableHead className="min-w-[120px] hidden md:table-cell">价格范围</TableHead>
                                            <TableHead className="min-w-[60px]">状态</TableHead>
                                            <TableHead className="w-[100px] sm:w-[120px]">操作</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {durations.map((duration) => (
                                            <TableRow key={duration.id}>
                                                <TableCell className="font-medium">
                                                    <div className="flex flex-col">
                                                        <span>{formatDuration(duration.duration_minutes)}</span>
                                                        <span className="text-xs text-muted-foreground sm:hidden">
                                                            {formatPrice(duration.default_price)}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="hidden sm:table-cell">
                                                    {formatPrice(duration.default_price)}
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell">
                                                    {formatPrice(duration.min_price)} - {formatPrice(duration.max_price)}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant={duration.is_active ? "default" : "secondary"}
                                                        className={duration.is_active ? "bg-green-100 text-green-800 hover:bg-green-200" : ""}
                                                    >
                                                        {duration.is_active ? "启用" : "禁用"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-0.5 sm:gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleEdit(duration)}
                                                            disabled={actionLoading[`edit-${duration.id}`]}
                                                            className="h-8 w-8 p-0"
                                                        >
                                                            <Edit className="h-3 w-3" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleToggleStatus(duration)}
                                                            disabled={actionLoading[`toggle-${duration.id}`]}
                                                            className="h-8 w-8 p-0"
                                                        >
                                                            {actionLoading[`toggle-${duration.id}`] ? (
                                                                <LoadingSpinner size="sm" />
                                                            ) : duration.is_active ? (
                                                                <EyeOff className="h-3 w-3" />
                                                            ) : (
                                                                <Eye className="h-3 w-3" />
                                                            )}
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setShowDeleteConfirm(duration)}
                                                            disabled={actionLoading[`delete-${duration.id}`]}
                                                            className="h-8 w-8 p-0"
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </div>
                </SheetContent>
            </Sheet>

            {/* 时长表单对话框 */}
            <Dialog open={showForm} onOpenChange={setShowForm}>
                <DialogContent className="sm:max-w-md mx-4 sm:mx-auto">
                    <DialogHeader>
                        <DialogTitle className="text-lg">
                            {editingDuration ? '编辑时长' : '添加时长'}
                        </DialogTitle>
                        <DialogDescription className="text-sm">
                            配置服务的时长和价格信息
                        </DialogDescription>
                    </DialogHeader>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="duration_minutes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>时长 *</FormLabel>
                                        <Select
                                            value={field.value?.toString() || ''}
                                            onValueChange={(value) => field.onChange(parseInt(value))}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="选择时长" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {durationOptions.map((option) => (
                                                    <SelectItem key={option.value} value={option.value.toString()}>
                                                        {option.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="default_price"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>默认价格 (THB) *</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min={100}
                                                max={50000}
                                                step={100}
                                                placeholder="1000"
                                                {...field}
                                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="min_price"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>最低价格 (THB) *</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    min={100}
                                                    max={50000}
                                                    step={100}
                                                    placeholder="800"
                                                    {...field}
                                                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="max_price"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>最高价格 (THB) *</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    min={100}
                                                    max={50000}
                                                    step={100}
                                                    placeholder="1200"
                                                    {...field}
                                                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                                    取消
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={actionLoading[editingDuration ? `edit-${editingDuration.id}` : 'create']}
                                >
                                    {actionLoading[editingDuration ? `edit-${editingDuration.id}` : 'create'] ? (
                                        <div className="flex items-center gap-2">
                                            <ButtonLoading />
                                            <span>{editingDuration ? '更新中...' : '创建中...'}</span>
                                        </div>
                                    ) : (
                                        editingDuration ? '更新时长' : '添加时长'
                                    )}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* 删除确认对话框 */}
            <Dialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
                <DialogContent className="sm:max-w-md mx-4 sm:mx-auto">
                    <DialogHeader>
                        <DialogTitle className="text-lg">确认删除</DialogTitle>
                        <DialogDescription className="text-sm">
                            确定要删除时长 "{showDeleteConfirm && formatDuration(showDeleteConfirm.duration_minutes)}" 吗？此操作不可撤销。
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>
                            取消
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
                            disabled={!!(showDeleteConfirm && actionLoading[`delete-${showDeleteConfirm.id}`])}
                        >
                            {showDeleteConfirm && actionLoading[`delete-${showDeleteConfirm.id}`] ? (
                                <div className="flex items-center gap-2">
                                    <ButtonLoading />
                                    <span>删除中...</span>
                                </div>
                            ) : (
                                '确认删除'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
