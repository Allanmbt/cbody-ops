'use client'

import { useState, useEffect, memo } from 'react'
import { generateSignedUrl } from '@/app/dashboard/media/actions'
import { useCurrentAdmin } from '@/hooks/use-current-admin'
import { Loader2 } from 'lucide-react'
import type { MediaListItem } from '@/lib/features/media'

interface MediaThumbnailProps {
    media: MediaListItem
    onClick?: () => void
    className?: string
}

function MediaThumbnailComponent({ media, onClick, className = '' }: MediaThumbnailProps) {
    const { admin } = useCurrentAdmin()
    const [thumbUrl, setThumbUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)

    useEffect(() => {
        async function loadThumbnail() {
            if (!admin?.id) return

            try {
                setLoading(true)
                setError(false)

                // 根据状态确定存储桶
                const bucket = media.status === 'approved' ? 'girls-media' : 'tmp-uploads'

                // 所有类型统一使用 thumb_key 作为缩略图
                let thumbKey: string | null = null

                if (media.kind === 'live_photo') {
                    // Live Photo: 使用 image_key 作为缩略图
                    thumbKey = media.meta?.live?.image_key || null
                } else {
                    // 图片和视频：统一使用 thumb_key
                    thumbKey = media.thumb_key || null
                }

                if (!thumbKey) {
                    console.log('[MediaThumbnail] No thumb_key found for media:', media.id)
                    setError(true)
                    return
                }

                const result = await generateSignedUrl({
                    key: thumbKey,
                    type: 'thumb',
                    bucket,
                    expires_in: 3600
                })

                if (result) {
                    setThumbUrl(result.url)
                } else {
                    setError(true)
                }
            } catch (err) {
                console.error('Failed to load thumbnail:', err)
                setError(true)
            } finally {
                setLoading(false)
            }
        }

        loadThumbnail()
    }, [admin?.id, media])

    const handleClick = () => {
        if (onClick) {
            onClick()
        }
    }

    return (
        <div
            className={`h-16 w-16 bg-muted rounded flex items-center justify-center overflow-hidden ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''
                } ${className}`}
            onClick={handleClick}
        >
            {loading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : error || !thumbUrl ? (
                <div className="text-2xl">
                    {media.kind === 'video' ? '🎬' : media.kind === 'live_photo' ? '📸' : '📷'}
                </div>
            ) : (
                <img
                    src={thumbUrl}
                    alt={`${media.girl_name}的媒体`}
                    className="h-full w-full object-cover"
                />
            )}
        </div>
    )
}

// 使用 memo 避免不必要的重新渲染
export const MediaThumbnail = memo(MediaThumbnailComponent, (prevProps, nextProps) => {
    return prevProps.media.id === nextProps.media.id &&
        prevProps.media.storage_key === nextProps.media.storage_key &&
        prevProps.media.thumb_key === nextProps.media.thumb_key
})
