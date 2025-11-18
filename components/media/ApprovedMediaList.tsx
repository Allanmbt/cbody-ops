'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, Eye, Trash2, Edit } from 'lucide-react'
import { toast } from 'sonner'
import { getMediaList, deleteMedia, updateMediaLevel } from '@/app/dashboard/media/actions'
import { MediaPreview } from '@/components/media/MediaPreview'
import { MediaThumbnail } from '@/components/media/MediaThumbnail'
import { UpdateLevelDialog } from '@/components/media/UpdateLevelDialog'
import type { MediaListItem } from '@/lib/features/media'
import { useCurrentAdmin } from '@/hooks/use-current-admin'

export function ApprovedMediaList() {
    const { admin, loading: adminLoading } = useCurrentAdmin()
    const [mediaList, setMediaList] = useState<MediaListItem[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [kindFilter, setKindFilter] = useState<string>('')
    const [levelFilter, setLevelFilter] = useState<string>('')
    const [selectedMedia, setSelectedMedia] = useState<MediaListItem | null>(null)
    const [editingMedia, setEditingMedia] = useState<MediaListItem | null>(null)
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)

    const limit = 20

    const fetchData = async () => {
        if (!admin?.id || adminLoading) {
            return
        }

        setLoading(true)
        try {
            const result = await getMediaList({
                status: 'approved',
                search: search || undefined,
                kind: kindFilter || undefined,
                min_user_level: levelFilter ? parseInt(levelFilter) : undefined,
                page,
                limit,
                sort_by: 'sort_order',
                sort_order: 'asc'
            })
            setMediaList(result.data)
            setTotal(result.total)
        } catch (error) {
            console.error('Failed to fetch media list:', error)
            toast.error('获取媒体列表失败')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [admin?.id, adminLoading, page, search, kindFilter, levelFilter])

    const handleDelete = async (id: string) => {
        if (!confirm('确定要删除这个媒体吗？')) {
            return
        }

        if (!admin?.id) {
            toast.error('未找到管理员信息')
            return
        }

        try {
            const result = await deleteMedia({ id })
            if (result.success) {
                toast.success('删除成功')
                fetchData()
            } else {
                toast.error(result.error || '删除失败')
            }
        } catch (error) {
            toast.error('删除失败')
        }
    }

    const handleUpdateLevel = async (level: number) => {
        if (!admin?.id || !editingMedia) {
            toast.error('未找到管理员信息')
            return
        }

        try {
            const result = await updateMediaLevel({
                id: editingMedia.id,
                min_user_level: level
            })
            if (result.success) {
                toast.success('等级修改成功')
                setEditingMedia(null)
                fetchData()
            } else {
                toast.error(result.error || '修改失败')
            }
        } catch (error) {
            toast.error('修改失败')
        }
    }

    const getKindBadge = (kind: string) => {
        switch (kind) {
            case 'image':
                return <Badge variant="default">图片</Badge>
            case 'video':
                return <Badge variant="secondary">视频</Badge>
            case 'live_photo':
                return <Badge variant="outline">实况照片</Badge>
            default:
                return <Badge>{kind}</Badge>
        }
    }

    const getLevelBadge = (level: number) => {
        const levelNames: Record<number, string> = {
            0: '公开',
            1: '普通',
            2: '银卡',
            3: '金卡',
            4: '白金',
            5: '钻石'
        }
        return <Badge variant="secondary">{levelNames[level] || `L${level}`}</Badge>
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>已发布媒体库</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex gap-4 mb-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="搜索技师名称..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-8"
                        />
                    </div>
                    <Select value={kindFilter || "all"} onValueChange={(value) => setKindFilter(value === "all" ? "" : value)}>
                        <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="媒体类型" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">全部</SelectItem>
                            <SelectItem value="image">图片</SelectItem>
                            <SelectItem value="video">视频</SelectItem>
                            <SelectItem value="live_photo">实况照片</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={levelFilter || "all"} onValueChange={(value) => setLevelFilter(value === "all" ? "" : value)}>
                        <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="会员等级" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">全部</SelectItem>
                            <SelectItem value="0">公开</SelectItem>
                            <SelectItem value="1">普通</SelectItem>
                            <SelectItem value="2">银卡</SelectItem>
                            <SelectItem value="3">金卡</SelectItem>
                            <SelectItem value="4">白金</SelectItem>
                            <SelectItem value="5">钻石</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>缩略图</TableHead>
                                <TableHead>技师</TableHead>
                                <TableHead>类型</TableHead>
                                <TableHead>会员等级</TableHead>
                                <TableHead>审核人</TableHead>
                                <TableHead>发布时间</TableHead>
                                <TableHead className="text-right">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8">
                                        加载中...
                                    </TableCell>
                                </TableRow>
                            ) : mediaList.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                        暂无已发布媒体
                                    </TableCell>
                                </TableRow>
                            ) : (
                                mediaList.map((media) => (
                                    <TableRow key={media.id}>
                                        <TableCell>
                                            <MediaThumbnail
                                                media={media}
                                                onClick={() => setSelectedMedia(media)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <div>
                                                <div className="font-medium">{media.girl_name}</div>
                                                <div className="text-sm text-muted-foreground">@{media.girl_username}</div>
                                            </div>
                                        </TableCell>
                                        <TableCell>{getKindBadge(media.kind)}</TableCell>
                                        <TableCell>{getLevelBadge(media.min_user_level)}</TableCell>
                                        <TableCell>{media.reviewer_name || '--'}</TableCell>
                                        <TableCell>{media.reviewed_at ? new Date(media.reviewed_at).toLocaleString() : '--'}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex gap-2 justify-end">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => setSelectedMedia(media)}
                                                    className="cursor-pointer"
                                                    title="查看详情"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => setEditingMedia(media)}
                                                    className="cursor-pointer"
                                                    title="修改等级"
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleDelete(media.id)}
                                                    className="cursor-pointer"
                                                    title="删除"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {total > limit && (
                    <div className="flex items-center justify-between mt-4">
                        <div className="text-sm text-muted-foreground">
                            共 {total} 条记录
                        </div>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={page === 1}
                                onClick={() => setPage(page - 1)}
                            >
                                上一页
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={page * limit >= total}
                                onClick={() => setPage(page + 1)}
                            >
                                下一页
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>

            {/* 媒体预览 */}
            <MediaPreview
                media={selectedMedia}
                open={!!selectedMedia}
                onOpenChange={(open) => !open && setSelectedMedia(null)}
            />

            {/* 修改等级对话框 */}
            {editingMedia && (
                <UpdateLevelDialog
                    open={!!editingMedia}
                    currentLevel={editingMedia.min_user_level}
                    onOpenChange={(open) => !open && setEditingMedia(null)}
                    onConfirm={handleUpdateLevel}
                />
            )}
        </Card>
    )
}