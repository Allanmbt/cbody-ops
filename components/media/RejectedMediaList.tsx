'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, Eye, RotateCcw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { getMediaList, deleteMedia, restoreToPending } from '@/app/dashboard/media/actions'
import { MediaPreview } from '@/components/media/MediaPreview'
import { MediaThumbnail } from '@/components/media/MediaThumbnail'
import type { MediaListItem } from '@/lib/features/media'
import { useCurrentAdmin } from '@/hooks/use-current-admin'
import { LoadingSpinner } from '@/components/ui/loading'

export function RejectedMediaList() {
    const { admin, loading: adminLoading } = useCurrentAdmin()
    const [mediaList, setMediaList] = useState<MediaListItem[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [kindFilter, setKindFilter] = useState<string>('')
    const [selectedMedia, setSelectedMedia] = useState<MediaListItem | null>(null)
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
                status: 'rejected',
                search: search || undefined,
                kind: kindFilter || undefined,
                page,
                limit,
                sort_by: 'reviewed_at',
                sort_order: 'desc'
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
    }, [admin?.id, adminLoading, page, search, kindFilter])

    const handleRestore = async (id: string) => {
        if (!confirm('确定要恢复这个媒体为待审核状态吗？')) {
            return
        }

        if (!admin?.id) {
            toast.error('未找到管理员信息')
            return
        }

        try {
            const result = await restoreToPending(id)
            if (result.success) {
                toast.success('已恢复为待审核状态')
                fetchData()
            } else {
                toast.error(result.error || '恢复失败')
            }
        } catch (error) {
            toast.error('恢复失败')
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('确定要彻底删除这个媒体吗？此操作不可恢复！')) {
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

    return (
        <Card>
            <CardHeader>
                <CardTitle>驳回箱</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex gap-4 mb-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="搜索技师名称 / 工号 / 用户名..."
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
                </div>

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>缩略图</TableHead>
                                <TableHead>技师</TableHead>
                                <TableHead>类型</TableHead>
                                <TableHead>驳回原因</TableHead>
                                <TableHead>审核人</TableHead>
                                <TableHead>驳回时间</TableHead>
                                <TableHead className="text-right">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="py-8">
                                        <div className="flex items-center justify-center">
                                            <LoadingSpinner />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : mediaList.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                        暂无已驳回媒体
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
                                                <div className="text-sm text-muted-foreground">
                                                    {media.girl_number ? `#${media.girl_number}` : ''}
                                                    {media.girl_number && media.girl_username ? ' • ' : ''}
                                                    {media.girl_username ?? ''}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>{getKindBadge(media.kind)}</TableCell>
                                        <TableCell>
                                            <div className="max-w-xs">
                                                <p className="text-sm line-clamp-2">{media.reject_reason || '--'}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell>{media.reviewer_name || '--'}</TableCell>
                                        <TableCell>{media.reviewed_at ? new Date(media.reviewed_at).toLocaleString() : '--'}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex gap-2 justify-end">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => setSelectedMedia(media)}
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleRestore(media.id)}
                                                >
                                                    <RotateCcw className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleDelete(media.id)}
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

                {total > 0 && (
                    <div className="flex items-center justify-between mt-4">
                        <div className="text-sm text-muted-foreground">
                            显示 {(page - 1) * limit + 1} - {Math.min(page * limit, total)} 条，共 {total} 条
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={page === 1}
                                onClick={() => setPage(page - 1)}
                            >
                                上一页
                            </Button>
                            <div className="text-sm text-muted-foreground">
                                第 {page} 页
                            </div>
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
        </Card>
    )
}