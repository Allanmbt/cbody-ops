'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, CheckCircle2, XCircle, Eye, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { getMediaList, approveMedia, rejectMedia, batchApproveMedia, batchRejectMedia } from '@/app/dashboard/media/actions'
import { MediaPreview } from '@/components/media/MediaPreview'
import { MediaThumbnail } from '@/components/media/MediaThumbnail'
import { RejectDialog } from '@/components/media/RejectDialog'
import { BatchApproveDialog } from '@/components/media/BatchApproveDialog'
import { BatchRejectDialog } from '@/components/media/BatchRejectDialog'
import type { MediaListItem } from '@/lib/features/media'
import { useCurrentAdmin } from '@/hooks/use-current-admin'

export function PendingMediaList() {
    const { admin, loading: adminLoading } = useCurrentAdmin()
    const [mediaList, setMediaList] = useState<MediaListItem[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [search, setSearch] = useState('')
    const [kindFilter, setKindFilter] = useState<string>('')
    const [selectedMedia, setSelectedMedia] = useState<MediaListItem | null>(null)
    const [rejectingId, setRejectingId] = useState<string | null>(null)
    const [showBatchApprove, setShowBatchApprove] = useState(false)
    const [showBatchReject, setShowBatchReject] = useState(false)
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
                status: 'pending',
                search: search || undefined,
                kind: kindFilter || undefined,
                page,
                limit
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

    const handleSelectAll = () => {
        if (selectedIds.length === mediaList.length) {
            setSelectedIds([])
        } else {
            setSelectedIds(mediaList.map(m => m.id))
        }
    }

    const handleSelect = (id: string) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(i => i !== id))
        } else {
            setSelectedIds([...selectedIds, id])
        }
    }

    const handleApprove = async (id: string, minUserLevel: number = 0) => {
        if (!admin?.id) {
            toast.error('未找到管理员信息')
            return
        }

        try {
            const result = await approveMedia({ id, min_user_level: minUserLevel })
            if (result.success) {
                toast.success('审核通过')
                fetchData()
            } else {
                toast.error(result.error || '审核失败')
            }
        } catch (error) {
            toast.error('审核失败')
        }
    }

    const handleBatchApprove = async (minUserLevel: number) => {
        if (!admin?.id) {
            toast.error('未找到管理员信息')
            return
        }

        try {
            const result = await batchApproveMedia({ ids: selectedIds, min_user_level: minUserLevel })
            if (result.success) {
                toast.success(`批量审核通过 ${selectedIds.length} 个媒体`)
                setSelectedIds([])
                setShowBatchApprove(false)
                fetchData()
            } else {
                toast.error(result.error || '批量审核失败')
            }
        } catch (error) {
            toast.error('批量审核失败')
        }
    }

    const handleBatchReject = async (reason: string) => {
        if (!admin?.id) {
            toast.error('未找到管理员信息')
            return
        }

        try {
            const result = await batchRejectMedia({ ids: selectedIds, reason })
            if (result.success) {
                toast.success(`批量驳回 ${selectedIds.length} 个媒体`)
                setSelectedIds([])
                setShowBatchReject(false)
                fetchData()
            } else {
                toast.error(result.error || '批量驳回失败')
            }
        } catch (error) {
            toast.error('批量驳回失败')
        }
    }

    const handleReject = async (id: string, reason: string) => {
        if (!admin?.id) {
            toast.error('未找到管理员信息')
            return
        }

        try {
            const result = await rejectMedia({ id, reason })
            if (result.success) {
                toast.success('已驳回')
                setRejectingId(null)
                fetchData()
            } else {
                toast.error(result.error || '驳回失败')
            }
        } catch (error) {
            toast.error('驳回失败')
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

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B'
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span>待审核队列</span>
                    {selectedIds.length > 0 && (
                        <div className="flex gap-2">
                            <Button size="sm" onClick={() => setShowBatchApprove(true)} className="cursor-pointer">
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                批量通过 ({selectedIds.length})
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => setShowBatchReject(true)} className="cursor-pointer">
                                <XCircle className="h-4 w-4 mr-1" />
                                批量驳回 ({selectedIds.length})
                            </Button>
                        </div>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {/* 过滤器 */}
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
                </div>

                {/* 表格 */}
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]">
                                    <Checkbox
                                        checked={selectedIds.length === mediaList.length && mediaList.length > 0}
                                        onCheckedChange={handleSelectAll}
                                    />
                                </TableHead>
                                <TableHead>缩略图</TableHead>
                                <TableHead>技师</TableHead>
                                <TableHead>类型</TableHead>
                                <TableHead>大小</TableHead>
                                <TableHead>上传时间</TableHead>
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
                                        暂无待审核媒体
                                    </TableCell>
                                </TableRow>
                            ) : (
                                mediaList.map((media) => (
                                    <TableRow key={media.id}>
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedIds.includes(media.id)}
                                                onCheckedChange={() => handleSelect(media.id)}
                                            />
                                        </TableCell>
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
                                        <TableCell>{media.meta?.size ? formatFileSize(media.meta.size) : '--'}</TableCell>
                                        <TableCell>{new Date(media.created_at).toLocaleString()}</TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => setSelectedMedia(media)}
                                                className="cursor-pointer"
                                                title="查看详情"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* 分页 */}
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

            {/* 驳回对话框 */}
            {rejectingId && (
                <RejectDialog
                    open={!!rejectingId}
                    onClose={() => setRejectingId(null)}
                    onConfirm={(reason) => handleReject(rejectingId, reason)}
                />
            )}

            {/* 批量通过对话框 */}
            <BatchApproveDialog
                open={showBatchApprove}
                onClose={() => setShowBatchApprove(false)}
                onConfirm={handleBatchApprove}
                count={selectedIds.length}
            />

            {/* 批量驳回对话框 */}
            <BatchRejectDialog
                open={showBatchReject}
                onClose={() => setShowBatchReject(false)}
                onConfirm={handleBatchReject}
                count={selectedIds.length}
            />
        </Card>
    )
}
