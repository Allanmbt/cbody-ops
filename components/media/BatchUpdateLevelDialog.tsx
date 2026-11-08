'use client'

import { useEffect, useRef, useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { MEDIA_PLATFORM_OPTIONS, buildMediaPlatformVisibility, type MediaPlatformScope, type BatchUpdateMediaLevelData } from '@/lib/features/media'

interface BatchUpdateLevelDialogProps {
    open: boolean
    count: number
    onClose: () => void
    onConfirm: (settings: Omit<BatchUpdateMediaLevelData, 'ids'>) => Promise<boolean>
}

const LEVEL_OPTIONS = [
    { value: '0', label: '0 - 公开' },
    { value: '1', label: '1 - 注册会员' },
    { value: '2', label: '2 - 已消费会员' },
    { value: '3', label: '3 - VIP3' },
    { value: '4', label: '4 - VIP4' },
    { value: '5', label: '5 - VIP5' },
    { value: '6', label: '6 - VIP6' },
    { value: '7', label: '7 - VIP7' },
    { value: '8', label: '8 - VIP8' },
    { value: '9', label: '9 - VIP9' },
]

export function BatchUpdateLevelDialog({ open, count, onClose, onConfirm }: BatchUpdateLevelDialogProps) {
    const [level, setLevel] = useState('unchanged')
    const [scope, setScope] = useState<MediaPlatformScope | 'unchanged'>('unchanged')
    const [isLoading, setIsLoading] = useState(false)
    const savingLock = useRef(false)

    useEffect(() => {
        if (open) {
            setLevel('unchanged')
            setScope('unchanged')
        }
    }, [open])

    const handleConfirm = async () => {
        if (savingLock.current || (level === 'unchanged' && scope === 'unchanged')) return
        savingLock.current = true
        setIsLoading(true)
        try {
            const settings = {
                ...(level === 'unchanged' ? {} : { min_user_level: Number(level) }),
                ...(scope === 'unchanged' ? {} : buildMediaPlatformVisibility(scope)),
            }
            if (await onConfirm(settings)) onClose()
        } finally {
            savingLock.current = false
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => !savingLock.current && !nextOpen && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>批量编辑展示设置</DialogTitle>
                    <DialogDescription>修改选中 {count} 个媒体的等级或平台范围，未修改的项目保留原值；仅更新已发布媒体。</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="batch-media-level">会员等级（0-9）</Label>
                        <Select value={level} onValueChange={setLevel} disabled={isLoading}>
                            <SelectTrigger id="batch-media-level">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="unchanged">不修改，保留原等级</SelectItem>
                                {LEVEL_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="batch-media-platform">平台展示范围</Label>
                        <Select value={scope} onValueChange={value => setScope(value as MediaPlatformScope | 'unchanged')} disabled={isLoading}>
                            <SelectTrigger id="batch-media-platform"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="unchanged">不修改，保留原平台范围</SelectItem>
                                {MEDIA_PLATFORM_OPTIONS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Web 始终可见；可只修改平台范围，保留各媒体原有会员等级。</p>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isLoading}>
                        取消
                    </Button>
                    <Button onClick={handleConfirm} disabled={isLoading || (level === 'unchanged' && scope === 'unchanged')} className="cursor-pointer">
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isLoading ? '处理中...' : '确认修改'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
