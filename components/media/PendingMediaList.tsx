'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, CheckCircle2, XCircle, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { getMediaList, rejectMedia, batchApproveMedia, batchRejectMedia } from '@/app/dashboard/media/actions'
import { MediaPreview } from '@/components/media/MediaPreview'
import { MediaThumbnail } from '@/components/media/MediaThumbnail'
import { RejectDialog } from '@/components/media/RejectDialog'
import { BatchApproveDialog } from '@/components/media/BatchApproveDialog'
import { BatchRejectDialog } from '@/components/media/BatchRejectDialog'
import type { MediaListItem } from '@/lib/features/media'
import { useCurrentAdmin } from '@/hooks/use-current-admin'
import { LoadingSpinner } from '@/components/ui/loading'

export function PendingMediaList() {
    const { admin, loading: adminLoading } = useCurrentAdmin()
    const [mediaList, setMediaList] = useState<MediaListItem[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [searchInput, setSearchInput] = useState('')
    const [search, setSearch] = useState('')
    const [kindFilter, setKindFilter] = useState<string>('')
    const [appliedKindFilter, setAppliedKindFilter] = useState<string>('')
    const [selectedMedia, setSelectedMedia] = useState<MediaListItem | null>(null)
    const [rejectingId, setRejectingId] = useState<string | null>(null)
    const [showBatchApprove, setShowBatchApprove] = useState(false)
    const [showBatchReject, setShowBatchReject] = useState(false)
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)

    const limit = 20

    const fetchData = useCallback(async () => {
        if (!admin?.id || adminLoading) {
            return
        }

        setLoading(true)
        try {
            const result = await getMediaList({
                status: 'pending',
                search: search || undefined,
                kind: appliedKindFilter || undefined,
                page,
                limit
            })
            setMediaList(result.data)
            setTotal(result.total)
            setSelectedIds([])
        } catch (error) {
            console.error('Failed to fetch media list:', error)
            toast.error('获取媒体列表失败')
        } finally {
            setLoading(false)
        }
    }, [admin?.id, adminLoading, page, search, appliedKindFilter])

    useEffect(() => {
        void fetchData()
    }, [fetchData])

    const handleSearch = () => {
        setPage(1)
        setSearch(searchInput.trim())
        setAppliedKindFilter(kindFilter)
    }

    const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            handleSearch()
        }
    }

    const handleSelectAll = () => {
        if (selectedIds.length === mediaList.length) {
            setSelectedIds([])
            return
        }

        setSelectedIds(mediaList.map((item) => item.id))
    }

    const handleSelect = (id: string) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter((item) => item !== id))
            return
        }

        setSelectedIds([...selectedIds, id])
    }

    const handleBatchApprove = async (minUserLevel: number) => {
        if (!admin?.id) {
            toast.error('未找到管理员信息')
            return
        }

        try {
            const result = await batchApproveMedia({ ids: selectedIds, min_user_level: minUserLevel })
            if (!result.success) {
                toast.error(result.error || '批量审核失败')
                return
            }

            toast.success(`已批量通过 ${selectedIds.length} 个媒体`)
            setSelectedIds([])
            setShowBatchApprove(false)
            fetchData()
        } catch {
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
            if (!result.success) {
                toast.error(result.error || '批量驳回失败')
                return
            }

            toast.success(`已批量驳回 ${selectedIds.length} 个媒体`)
            setSelectedIds([])
            setShowBatchReject(false)
            fetchData()
        } catch {
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
            if (!result.success) {
                toast.error(result.error || '驳回失败')
                return
            }

            toast.success('已驳回媒体')
            setRejectingId(null)
            fetchData()
        } catch {
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

    const formatDuration = (seconds?: number) => {
        if (!seconds || seconds <= 0) {
            return '--'
        }

        const totalSeconds = Math.round(seconds)
        const minutes = Math.floor(totalSeconds / 60)
        const remainSeconds = totalSeconds % 60

        if (minutes === 0) {
            return `${totalSeconds} 秒`
        }

        return `${minutes}:${remainSeconds.toString().padStart(2, '0')}`
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span>待审核队列</span>
                    {selectedIds.length > 0 && (
                        <div className="flex gap-2">
                            <Button size="sm" onClick={() => setShowBatchApprove(true)} className="cursor-pointer">
                                <CheckCircle2 className="mr-1 h-4 w-4" />
                                批量通过 ({selectedIds.length})
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => setShowBatchReject(true)} className="cursor-pointer">
                                <XCircle className="mr-1 h-4 w-4" />
                                批量驳回 ({selectedIds.length})
                            </Button>
                        </div>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="mb-4 flex flex-wrap items-center gap-3">
                    <div className="flex max-w-md min-w-[220px] flex-1 gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="搜索技师名称 / 工号 / 用户名..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                onKeyDown={handleSearchKeyDown}
                                className="pl-10"
                            />
                        </div>
                        <Button onClick={handleSearch} size="default" className="cursor-pointer">
                            <Search className="mr-2 h-4 w-4" />
                            搜索
                        </Button>
                    </div>

                    <Select value={kindFilter || 'all'} onValueChange={(value) => setKindFilter(value === 'all' ? '' : value)}>
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
                                <TableHead className="w-[50px]">
                                    <Checkbox
                                        checked={selectedIds.length === mediaList.length && mediaList.length > 0}
                                        onCheckedChange={handleSelectAll}
                                    />
                                </TableHead>
                                <TableHead>缩略图</TableHead>
                                <TableHead>技师</TableHead>
                                <TableHead>类型</TableHead>
                                <TableHead>时长</TableHead>
                                <TableHead>上传时间</TableHead>
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
                                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
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
                                            <MediaThumbnail media={media} onClick={() => setSelectedMedia(media)} />
                                        </TableCell>
                                        <TableCell>
                                            <div>
                                                <div className="font-medium">{media.girl_name || '--'}</div>
                                                <div className="text-sm text-muted-foreground">
                                                    {media.girl_number ? `#${media.girl_number}` : ''}
                                                    {media.girl_number && media.girl_username ? ' • ' : ''}
                                                    {media.girl_username ?? ''}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>{getKindBadge(media.kind)}</TableCell>
                                        <TableCell>{formatDuration(media.meta?.duration)}</TableCell>
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

                {total > 0 && (
                    <div className="mt-4 flex items-center justify-between">
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
                            <div className="text-sm text-muted-foreground">第 {page} 页</div>
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

            <MediaPreview
                media={selectedMedia}
                open={!!selectedMedia}
                onOpenChange={(open) => !open && setSelectedMedia(null)}
            />

            {rejectingId && (
                <RejectDialog
                    open={!!rejectingId}
                    onClose={() => setRejectingId(null)}
                    onConfirm={(reason) => handleReject(rejectingId, reason)}
                />
            )}

            <BatchApproveDialog
                open={showBatchApprove}
                onClose={() => setShowBatchApprove(false)}
                onConfirm={handleBatchApprove}
                count={selectedIds.length}
            />

            <BatchRejectDialog
                open={showBatchReject}
                onClose={() => setShowBatchReject(false)}
                onConfirm={handleBatchReject}
                count={selectedIds.length}
            />
        </Card>
    )
}
