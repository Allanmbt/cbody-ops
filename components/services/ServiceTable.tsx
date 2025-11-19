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
import { getServiceTitle, getCategoryName, getBadgeVariant, getBadgeText } from "@/lib/features/services"
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
                        <TableHead className="text-center">最低等级</TableHead>
                        <TableHead>更新时间</TableHead>
                        <TableHead className="w-[100px]">操作</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        <TableRow>
                            <TableCell colSpan={9} className="h-32 text-center">
                                <LoadingSpinner size="lg" />
                            </TableCell>
                        </TableRow>
                    ) : services.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={9} className="h-32 text-center">
                                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                                    <div className="text-sm">暂无服务项目</div>
                                    <div className="text-xs">点击右上角"新建服务"按钮添加</div>
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : (
                        services.map((service) => (
                        <TableRow key={service.id}>
                            <TableCell className="font-medium">
                                <div className="flex flex-col gap-0.5">
                                    <div>{service.title.zh || getServiceTitle(service)}</div>
                                    {service.title.en && (
                                        <div className="text-xs text-muted-foreground">{service.title.en}</div>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell>
                                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                    {service.code}
                                </code>
                            </TableCell>
                            <TableCell>{service.category ? getCategoryName(service.category) : '未分类'}</TableCell>
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
                            <TableCell className="text-center">
                                <Badge variant="outline" className="font-mono">
                                    Lv.{service.min_user_level}
                                </Badge>
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
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    )
}
