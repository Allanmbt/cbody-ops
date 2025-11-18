"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LoadingSpinner } from "@/components/ui/loading"
import { MapPin, Clock, Wifi, ExternalLink } from "lucide-react"
import { girlStatusSchema, type GirlStatusData } from "@/lib/features/girls"
import { getGirlStatus, updateGirlStatus } from "@/app/dashboard/girls/actions"
import type { GirlWithStatus, GirlStatus, GirlStatusType } from "@/lib/features/girls"

interface GirlStatusDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    girl?: GirlWithStatus | null
    onSuccess: () => void
}

export function GirlStatusDrawer({ open, onOpenChange, girl, onSuccess }: GirlStatusDrawerProps) {
    const [loading, setLoading] = useState(false)
    const [statusData, setStatusData] = useState<GirlStatus | null>(null)
    const [loadingStatus, setLoadingStatus] = useState(false)

    const form = useForm<GirlStatusData>({
        resolver: zodResolver(girlStatusSchema) as any,
        defaultValues: {
            status: 'offline',
            current_lat: undefined,
            current_lng: undefined,
            next_available_time: null,
        }
    })

    // 将 ISO 时间转换为 datetime-local 格式
    const formatDateTimeLocal = (isoString: string | null | undefined): string => {
        if (!isoString) return ''
        try {
            const date = new Date(isoString)
            // 转换为本地时区的 YYYY-MM-DDTHH:mm 格式
            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, '0')
            const day = String(date.getDate()).padStart(2, '0')
            const hours = String(date.getHours()).padStart(2, '0')
            const minutes = String(date.getMinutes()).padStart(2, '0')
            return `${year}-${month}-${day}T${hours}:${minutes}`
        } catch {
            return ''
        }
    }

    // 加载技师状态
    useEffect(() => {
        async function loadStatus() {
            if (!girl?.id) return

            setLoadingStatus(true)
            try {
                const result = await getGirlStatus(girl.id)
                if (result.ok && result.data) {
                    setStatusData(result.data)
                    form.reset({
                        status: result.data.status,
                        current_lat: result.data.current_lat ?? undefined,
                        current_lng: result.data.current_lng ?? undefined,
                        next_available_time: formatDateTimeLocal(result.data.next_available_time),
                    })
                } else {
                    // 如果没有状态数据，使用默认值
                    form.reset({
                        status: 'offline',
                        current_lat: undefined,
                        current_lng: undefined,
                        next_available_time: null,
                    })
                }
            } catch (error) {
                console.error('加载技师状态失败:', error)
                toast.error("加载技师状态失败")
            } finally {
                setLoadingStatus(false)
            }
        }

        if (open && girl) {
            loadStatus()
        }
    }, [open, girl, form])

    const onSubmit = async (data: GirlStatusData) => {
        if (!girl?.id) {
            toast.error("技师ID不存在")
            return
        }

        try {
            setLoading(true)

            console.log('提交状态更新:', { girlId: girl.id, data })

            const result = await updateGirlStatus(girl.id, data)

            console.log('更新结果:', result)

            if (result.ok) {
                toast.success("技师状态更新成功")
                onSuccess()
                onOpenChange(false)
            } else {
                // 显示详细的错误信息
                const errorMsg = result.error || "更新失败"
                console.error('更新失败:', errorMsg)
                toast.error(errorMsg, {
                    description: "请检查权限或稍后重试",
                    duration: 5000
                })
            }
        } catch (error: any) {
            console.error('更新技师状态失败:', error)
            const errorMsg = error?.message || "更新失败，请重试"
            toast.error(errorMsg, {
                description: "如果问题持续存在，请联系技术支持",
                duration: 5000
            })
        } finally {
            setLoading(false)
        }
    }

    const getStatusBadge = (status: GirlStatusType) => {
        const statusMap = {
            available: { text: '在线', variant: 'default' as const, className: 'bg-green-100 text-green-800 hover:bg-green-200' },
            busy: { text: '忙碌', variant: 'secondary' as const, className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' },
            offline: { text: '离线', variant: 'outline' as const, className: 'bg-gray-100 text-gray-600' }
        }

        const config = statusMap[status as keyof typeof statusMap] || statusMap.offline
        return (
            <Badge variant={config.variant} className={config.className}>
                <Wifi className="w-3 h-3 mr-1" />
                {config.text}
            </Badge>
        )
    }

    const formatDateTime = (dateTime: string | undefined): string => {
        if (!dateTime) return '-'
        try {
            return new Date(dateTime).toLocaleString('zh-CN')
        } catch {
            return '-'
        }
    }

    // 查看位置（打开Google Maps）
    const handleViewLocation = (lat?: number | null, lng?: number | null, label: string = '位置') => {
        if (!lat || !lng) {
            toast.error(`${label}坐标未设置`)
            return
        }
        const url = `https://www.google.com/maps?q=${lat},${lng}`
        window.open(url, '_blank')
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:w-[500px] sm:max-w-[500px] overflow-y-auto px-4 sm:px-6">
                <SheetHeader className="px-2 sm:px-0">
                    <SheetTitle className="text-lg sm:text-xl flex items-center gap-2">
                        <MapPin className="w-5 h-5" />
                        状态位置管理
                    </SheetTitle>
                    <SheetDescription className="text-sm">
                        管理 "{girl?.name || girl?.username}" 的在线状态和地理位置
                    </SheetDescription>
                </SheetHeader>

                <div className="mt-4 sm:mt-6 px-2 sm:px-0">
                    {loadingStatus ? (
                        <div className="flex justify-center py-8">
                            <LoadingSpinner size="lg" />
                        </div>
                    ) : (
                        <>
                            {/* 当前状态显示 */}
                            <div className="mb-6 p-4 bg-muted/50 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium">当前状态</span>
                                    {statusData && getStatusBadge(statusData.status as GirlStatusType)}
                                </div>
                                <div className="text-xs text-muted-foreground space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-3 h-3" />
                                        最后更新: {formatDateTime(statusData?.updated_at)}
                                    </div>
                                    {statusData?.next_available_time && (
                                        <div>下次可用: {formatDateTime(statusData.next_available_time)}</div>
                                    )}
                                </div>
                            </div>

                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
                                    {/* 状态设置 */}
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-medium text-muted-foreground">状态设置</h3>

                                        <FormField
                                            control={form.control}
                                            name="status"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>在线状态 *</FormLabel>
                                                    <Select
                                                        value={field.value}
                                                        onValueChange={field.onChange}
                                                        disabled={loading}
                                                    >
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="选择状态" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="available">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                                    在线 - 可接单
                                                                </div>
                                                            </SelectItem>
                                                            <SelectItem value="busy">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                                                    忙碌 - 服务中
                                                                </div>
                                                            </SelectItem>
                                                            <SelectItem value="offline">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                                                                    离线 - 不可用
                                                                </div>
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="next_available_time"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>下次可用时间</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="datetime-local"
                                                            {...field}
                                                            value={field.value || ''}
                                                            disabled={loading}
                                                        />
                                                    </FormControl>
                                                    <FormDescription>
                                                        设置技师下次可用的时间
                                                    </FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    {/* 当前位置 */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-medium text-muted-foreground">当前位置</h3>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleViewLocation(
                                                    form.getValues('current_lat'),
                                                    form.getValues('current_lng'),
                                                    '当前位置'
                                                )}
                                                disabled={loading}
                                            >
                                                <ExternalLink className="w-3 h-3 mr-1" />
                                                查看当前位置
                                            </Button>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <FormField
                                                control={form.control}
                                                name="current_lat"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>纬度</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="number"
                                                                step="any"
                                                                placeholder="13.7563"
                                                                {...field}
                                                                value={field.value ?? ''}
                                                                onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                                                                disabled={loading}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="current_lng"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>经度</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="number"
                                                                step="any"
                                                                placeholder="100.5018"
                                                                {...field}
                                                                value={field.value ?? ''}
                                                                onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                                                                disabled={loading}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => onOpenChange(false)}
                                            className="w-full sm:w-auto"
                                        >
                                            取消
                                        </Button>
                                        <Button
                                            type="submit"
                                            disabled={loading}
                                            className="w-full sm:w-auto"
                                        >
                                            {loading && <LoadingSpinner size="sm" className="mr-2" />}
                                            更新状态
                                        </Button>
                                    </div>
                                </form>
                            </Form>
                        </>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    )
}
