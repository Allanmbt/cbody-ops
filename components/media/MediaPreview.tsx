'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import type { MediaListItem } from '@/lib/features/media'
import { useEffect, useState } from 'react'
import { generateSignedUrl } from '@/app/dashboard/media/actions'
import { useCurrentAdmin } from '@/hooks/use-current-admin'
import { Loader2 } from 'lucide-react'

interface MediaPreviewProps {
    media: MediaListItem | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function MediaPreview({ media, open, onOpenChange }: MediaPreviewProps) {
    const { admin } = useCurrentAdmin()
    const [imageUrl, setImageUrl] = useState<string | null>(null)
    const [videoUrl, setVideoUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        async function loadMedia() {
            if (!media || !admin?.id || !open) {
                setImageUrl(null)
                setVideoUrl(null)
                return
            }

            setLoading(true)

            try {
                // 根据状态确定存储桶
                const bucket = media.status === 'approved' ? 'girls-media' : 'tmp-uploads'

                if (media.kind === 'live_photo') {
                    // Live Photo: 显示图片和视频
                    const live = media.meta?.live
                    if (live?.image_key) {
                        const imageResult = await generateSignedUrl({
                            key: live.image_key,
                            type: 'main',
                            bucket,
                            expires_in: 3600
                        })
                        if (imageResult) {
                            setImageUrl(imageResult.url)
                        }
                    }
                    if (live?.video_key) {
                        const videoResult = await generateSignedUrl(admin.id, {
                            key: live.video_key,
                            type: 'main',
                            bucket,
                            expires_in: 3600
                        })
                        if (videoResult) {
                            setVideoUrl(videoResult.url)
                        }
                    }
                } else if (media.kind === 'video') {
                    // 视频：只显示视频播放器，不显示封面图
                    if (media.storage_key) {
                        const videoResult = await generateSignedUrl(admin.id, {
                            key: media.storage_key,
                            type: 'main',
                            bucket,
                            expires_in: 3600
                        })
                        if (videoResult) {
                            setVideoUrl(videoResult.url)
                        }
                    }
                } else {
                    // 图片：只显示图片
                    if (media.storage_key) {
                        const imageResult = await generateSignedUrl({
                            key: media.storage_key,
                            type: 'main',
                            bucket,
                            expires_in: 3600
                        })
                        if (imageResult) {
                            setImageUrl(imageResult.url)
                        }
                    }
                }
            } catch (error) {
                console.error('Failed to load media:', error)
            } finally {
                setLoading(false)
            }
        }

        loadMedia()
    }, [media, admin?.id, open])

    if (!media) return null

    const getKindBadge = (kind: string) => {
        switch (kind) {
            case 'image':
                return <Badge variant="default">图片</Badge>
            case 'video':
                return <Badge variant="secondary">视频</Badge>
            case 'live_photo':
                return <Badge variant="outline">实况照片</Badge>
            default:
                return null
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return <Badge variant="secondary">待审核</Badge>
            case 'approved':
                return <Badge variant="default">已发布</Badge>
            case 'rejected':
                return <Badge variant="destructive">已驳回</Badge>
            default:
                return null
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        媒体预览
                        {getKindBadge(media.kind)}
                        {getStatusBadge(media.status)}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* 媒体信息 */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-muted-foreground">技师：</span>
                            <span className="ml-2">{media.girl_name || '未知'}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground">会员等级：</span>
                            <span className="ml-2">Lv.{media.min_user_level}</span>
                        </div>
                        {media.reviewed_by && (
                            <>
                                <div>
                                    <span className="text-muted-foreground">审核人：</span>
                                    <span className="ml-2">{media.reviewer_name || '未知'}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">审核时间：</span>
                                    <span className="ml-2">
                                        {media.reviewed_at ? new Date(media.reviewed_at).toLocaleString('zh-CN') : '-'}
                                    </span>
                                </div>
                            </>
                        )}
                        {media.reject_reason && (
                            <div className="col-span-2">
                                <span className="text-muted-foreground">驳回原因：</span>
                                <p className="mt-1 text-red-600">{media.reject_reason}</p>
                            </div>
                        )}
                    </div>

                    {/* 媒体预览 */}
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {imageUrl && (
                                <div>
                                    <img
                                        src={imageUrl}
                                        alt="Media preview"
                                        className="w-full h-auto rounded-lg"
                                    />
                                </div>
                            )}
                            {videoUrl && (
                                <div>
                                    <video
                                        src={videoUrl}
                                        controls
                                        className="w-full h-auto rounded-lg"
                                        autoPlay
                                    />
                                </div>
                            )}
                            {!imageUrl && !videoUrl && (
                                <div className="flex items-center justify-center h-64 text-muted-foreground">
                                    无法加载媒体内容
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
