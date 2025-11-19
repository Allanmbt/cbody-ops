"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { LoadingSpinner } from "@/components/ui/loading"
import { MoreVertical, Eye, EyeOff, Edit, Shield, ShieldCheck, MapPin, Image as ImageIcon } from "lucide-react"
import type { GirlWithStatus } from "@/lib/features/girls"

interface GirlTableProps {
    girls: GirlWithStatus[]
    loading: boolean
    onEdit: (girl: GirlWithStatus) => void
    onToggleBlocked: (girl: GirlWithStatus) => void
    onToggleVerified: (girl: GirlWithStatus) => void
    onManageStatus: (girl: GirlWithStatus) => void
    onManageMedia: (girl: GirlWithStatus) => void
}

export function GirlTable({
    girls,
    loading,
    onEdit,
    onToggleBlocked,
    onToggleVerified,
    onManageStatus,
    onManageMedia
}: GirlTableProps) {
    const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
    const [previewImage, setPreviewImage] = useState<string | null>(null)

    const handleAction = async (actionKey: string, action: () => Promise<void>) => {
        setActionLoading(prev => ({ ...prev, [actionKey]: true }))
        try {
            await action()
        } finally {
            setActionLoading(prev => ({ ...prev, [actionKey]: false }))
        }
    }

    const getGirlName = (girl: GirlWithStatus): string => {
        return girl.name || girl.username || `#${girl.girl_number}`
    }

    const getCityName = (girl: GirlWithStatus): string => {
        if (!girl.city) return '-'
        return girl.city.name?.zh || girl.city.name?.en || girl.city.name?.th || '-'
    }

    const getCategoriesDisplay = (girl: GirlWithStatus): string => {
        if (!girl.categories || girl.categories.length === 0) return '-'
        return girl.categories.map(cat => cat.name?.zh || cat.name?.en || cat.name?.th || '').filter(Boolean).join(', ')
    }

    // 业务审核状态（UI 层）：Pending / Approved / Deleted
    const getReviewStatusBadge = (girl: GirlWithStatus) => {
        const isDeleted = !!girl.deleted_at && !!girl.previous_user_id

        if (isDeleted) {
            return (
                <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-200">
                    已注销
                </Badge>
            )
        }

        if (girl.is_blocked) {
            return (
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
                    未审核
                </Badge>
            )
        }

        return (
            <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-200">
                已通过
            </Badge>
        )
    }

    const getBadgeDisplay = (badge: string | null | undefined) => {
        if (!badge) return null

        const badgeMap = {
            new: { text: '新人', className: 'bg-blue-100 text-blue-800' },
            hot: { text: '热门', className: 'bg-red-100 text-red-800' },
            top_rated: { text: '优质', className: 'bg-purple-100 text-purple-800' }
        }

        const config = badgeMap[badge as keyof typeof badgeMap]
        if (!config) return null

        return (
            <Badge variant="secondary" className={config.className}>
                {config.text}
            </Badge>
        )
    }

    const formatAge = (birthDate: string | null | undefined): string => {
        if (!birthDate) return '-'
        const age = new Date().getFullYear() - new Date(birthDate).getFullYear()
        return `${age}岁`
    }

    const formatRating = (rating: number): string => {
        return rating > 0 ? rating.toFixed(1) : '-'
    }

    // 头像点击放大预览
    const handleAvatarClick = (avatarUrl?: string | null) => {
        if (avatarUrl) {
            setPreviewImage(avatarUrl)
        }
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center py-12">
                <LoadingSpinner size="lg" />
            </div>
        )
    }

    if (girls.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="text-muted-foreground text-sm">暂无技师</div>
                <div className="text-xs text-muted-foreground mt-1">点击上方"新建技师"按钮添加第一个技师</div>
            </div>
        )
    }

    return (
        <>
            <Table className="min-w-[800px] w-full">
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[80px]">头像</TableHead>
                        <TableHead className="min-w-[150px]">技师信息</TableHead>
                        <TableHead className="min-w-[80px] hidden sm:table-cell">城市</TableHead>
                        <TableHead className="min-w-[100px] hidden md:table-cell">分类</TableHead>
                        <TableHead className="min-w-[80px]">审核状态</TableHead>
                        <TableHead className="min-w-[80px] hidden md:table-cell">评分</TableHead>
                        <TableHead className="min-w-[80px] hidden lg:table-cell">诚信分</TableHead>
                        <TableHead className="min-w-[80px] hidden lg:table-cell">销量</TableHead>
                        <TableHead className="min-w-[80px] hidden sm:table-cell">认证</TableHead>
                        <TableHead className="w-[60px]">操作</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {girls.map((girl) => (
                        <TableRow key={girl.id}>
                            {/* 头像列 */}
                            <TableCell>
                                <div
                                    className="w-12 h-12 rounded-full overflow-hidden bg-muted cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                                    onClick={() => handleAvatarClick(girl.avatar_url)}
                                >
                                    {girl.avatar_url ? (
                                        <img
                                            src={girl.avatar_url}
                                            alt={getGirlName(girl)}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement
                                                target.style.display = 'none'
                                            }}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                                        </div>
                                    )}
                                </div>
                            </TableCell>

                            {/* 技师信息 */}
                            <TableCell className="font-medium">
                                <div className="flex flex-col gap-1">
                                    <div>
                                        <div className="font-medium">{getGirlName(girl)}</div>
                                        <div className="text-xs text-muted-foreground">
                                            #{girl.girl_number} • {girl.username}
                                        </div>
                                    </div>
                                    <div className="text-xs text-muted-foreground sm:hidden">
                                        {getCityName(girl)} • {formatAge(girl.birth_date)}
                                    </div>
                                    {girl.badge && (
                                        <div className="lg:hidden">{getBadgeDisplay(girl.badge)}</div>
                                    )}
                                </div>
                            </TableCell>

                            <TableCell className="hidden sm:table-cell">{getCityName(girl)}</TableCell>
                            <TableCell className="hidden md:table-cell">
                                <div className="max-w-[200px] truncate" title={getCategoriesDisplay(girl)}>
                                    {getCategoriesDisplay(girl)}
                                </div>
                            </TableCell>
                            <TableCell>{getReviewStatusBadge(girl)}</TableCell>

                            <TableCell className="hidden md:table-cell">
                                <div className="flex flex-col text-sm">
                                    <span>{formatRating(girl.rating)}</span>
                                    <span className="text-xs text-muted-foreground">
                                        {girl.total_reviews}条评价
                                    </span>
                                </div>
                            </TableCell>

                            <TableCell className="hidden lg:table-cell">
                                <span>{girl.trust_score}</span>
                            </TableCell>

                            <TableCell className="hidden lg:table-cell">
                                <div className="flex flex-col text-sm">
                                    <span>{girl.total_sales}</span>
                                </div>
                            </TableCell>

                            <TableCell className="hidden sm:table-cell">
                                <div className="flex flex-col gap-1">
                                    <Badge
                                        variant={girl.is_verified ? "default" : "secondary"}
                                        className={girl.is_verified ? "bg-blue-100 text-blue-800 hover:bg-blue-200" : ""}
                                    >
                                        {girl.is_verified ? "已认证" : "未认证"}
                                    </Badge>
                                </div>
                            </TableCell>

                            {/* 三点操作菜单 */}
                            <TableCell>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                        <DropdownMenuItem onClick={() => onEdit(girl)}>
                                            <Edit className="mr-2 h-4 w-4" />
                                            编辑
                                        </DropdownMenuItem>

                                        <DropdownMenuItem
                                            onClick={() => handleAction(`verified-${girl.id}`, async () => await onToggleVerified(girl))}
                                            disabled={actionLoading[`verified-${girl.id}`]}
                                        >
                                            {girl.is_verified ? (
                                                <ShieldCheck className="mr-2 h-4 w-4 text-green-600" />
                                            ) : (
                                                <Shield className="mr-2 h-4 w-4" />
                                            )}
                                            {girl.is_verified ? "取消资料认证" : "通过资料认证"}
                                        </DropdownMenuItem>

                                        <DropdownMenuItem
                                            onClick={() => handleAction(`blocked-${girl.id}`, async () => await onToggleBlocked(girl))}
                                            disabled={actionLoading[`blocked-${girl.id}`]}
                                        >
                                            {girl.is_blocked ? (
                                                <Eye className="mr-2 h-4 w-4 text-green-600" />
                                            ) : (
                                                <EyeOff className="mr-2 h-4 w-4" />
                                            )}
                                            {girl.is_blocked ? "恢复展示" : "暂停展示"}
                                        </DropdownMenuItem>

                                        <DropdownMenuSeparator />

                                        <DropdownMenuItem onClick={() => onManageStatus(girl)}>
                                            <MapPin className="mr-2 h-4 w-4" />
                                            管理运营状态
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            {/* 头像放大预览对话框 */}
            <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>头像预览</DialogTitle>
                    </DialogHeader>
                    <div className="flex justify-center items-center">
                        {previewImage && (
                            <img
                                src={previewImage}
                                alt="头像预览"
                                className="max-w-full max-h-[70vh] object-contain rounded-lg"
                            />
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
