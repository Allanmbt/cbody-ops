"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MoreHorizontal, Edit, Settings, Eye, EyeOff, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { LoadingSpinner } from "@/components/ui/loading"
import { toast } from "sonner"
import type { Service } from "@/lib/features/services"
import { toggleServiceStatus } from "@/app/dashboard/services/actions"

interface ServiceTableProps {
    services: Service[]
    loading?: boolean
    onEdit: (service: Service) => void
    onManageDurations: (service: Service) => void
    onRefresh: () => void
}

export function ServiceTable({
    services,
    loading = false,
    onEdit,
    onManageDurations,
    onRefresh
}: ServiceTableProps) {
    const router = useRouter()
    const [toggleLoading, setToggleLoading] = useState<number | null>(null)

    const handleToggleStatus = async (service: Service) => {
        setToggleLoading(service.id)
        try {
            const result = await toggleServiceStatus(service.id)
            if (result.ok) {
                toast.success(`服务已${service.is_active ? '下架' : '上架'}`)
                onRefresh()
            } else {
                toast.error(result.error || '操作失败')
            }
        } catch (error) {
            console.error('切换状态失败:', error)
            toast.error('操作失败，请重试')
        } finally {
            setToggleLoading(null)
        }
    }

    const getServiceTitle = (service: Service): string => {
        return service.title.zh || service.title.en || service.title.th || service.code
    }

    const getCategoryName = (service: Service): string => {
        if (!service.category) return '未分类'
        return service.category.name.zh || service.category.name.en || service.category.name.th || service.category.code
    }

    const getBadgeVariant = (badge: string | null) => {
        switch (badge) {
            case 'HOT':
                return 'destructive'
            case 'NEW':
                return 'default'
            case 'TOP_PICK':
                return 'secondary'
            default:
                return 'outline'
        }
    }

    const getBadgeText = (badge: string | null) => {
        switch (badge) {
            case 'HOT':
                return '热门'
            case 'NEW':
                return '新品'
            case 'TOP_PICK':
                return '精选'
            default:
                return badge
        }
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center py-12">
                <LoadingSpinner size="lg" />
            </div>
        )
    }

    if (services.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="text-muted-foreground text-sm">暂无服务项目</div>
                <div className="text-xs text-muted-foreground mt-1">点击上方"新建服务"按钮添加第一个服务</div>
            </div>
        )
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>服务名称</TableHead>
                        <TableHead>代码</TableHead>
                        <TableHead>分类</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>徽章</TableHead>
                        <TableHead className="text-right">销量</TableHead>
                        <TableHead>更新时间</TableHead>
                        <TableHead className="w-[100px]">操作</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {services.map((service) => (
                        <TableRow key={service.id}>
                            <TableCell className="font-medium">
                                {getServiceTitle(service)}
                            </TableCell>
                            <TableCell>
                                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                    {service.code}
                                </code>
                            </TableCell>
                            <TableCell>{getCategoryName(service)}</TableCell>
                            <TableCell>
                                <Badge
                                    variant={service.is_active ? "default" : "secondary"}
                                    className={service.is_active ? "bg-green-100 text-green-800 hover:bg-green-200" : ""}
                                >
                                    {service.is_active ? "上架" : "下架"}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                {service.badge && (
                                    <Badge variant={getBadgeVariant(service.badge)}>
                                        {getBadgeText(service.badge)}
                                    </Badge>
                                )}
                            </TableCell>
                            <TableCell className="text-right">
                                {service.total_sales.toLocaleString()}
                            </TableCell>
                            <TableCell>
                                {new Date(service.updated_at).toLocaleDateString('zh-CN', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </TableCell>
                            <TableCell>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                            <span className="sr-only">打开菜单</span>
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>操作</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={() => onEdit(service)}>
                                            <Edit className="mr-2 h-4 w-4" />
                                            编辑服务
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onManageDurations(service)}>
                                            <Settings className="mr-2 h-4 w-4" />
                                            时长定价
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => router.push(`/dashboard/services/${service.id}/bind`)}>
                                            <Users className="mr-2 h-4 w-4" />
                                            绑定技师
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            onClick={() => handleToggleStatus(service)}
                                            disabled={toggleLoading === service.id}
                                        >
                                            {toggleLoading === service.id ? (
                                                <LoadingSpinner size="sm" className="mr-2" />
                                            ) : service.is_active ? (
                                                <EyeOff className="mr-2 h-4 w-4" />
                                            ) : (
                                                <Eye className="mr-2 h-4 w-4" />
                                            )}
                                            {service.is_active ? "下架" : "上架"}
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
