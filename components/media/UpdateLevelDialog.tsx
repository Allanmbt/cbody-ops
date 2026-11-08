'use client'

import { useEffect, useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import { Loader2 } from 'lucide-react'
import { MediaPlatformSelect } from './MediaPlatformSelect'
import { buildMediaPlatformVisibility, getMediaPlatformScope, type MediaPlatformScope, type MediaPlatformVisibility } from '@/lib/features/media'

interface UpdateLevelDialogProps {
    open: boolean
    currentLevel: number
    currentVisibility: MediaPlatformVisibility
    onOpenChange: (open: boolean) => void
    onConfirm: (level: number, visibility: MediaPlatformVisibility) => Promise<boolean>
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

export function UpdateLevelDialog({ open, currentLevel, currentVisibility, onOpenChange, onConfirm }: UpdateLevelDialogProps) {
    const [level, setLevel] = useState(currentLevel.toString())
    const [scope, setScope] = useState<MediaPlatformScope>('all')
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        if (open) {
            setLevel(currentLevel.toString())
            setScope(getMediaPlatformScope({ visible_on_ios: currentVisibility.visible_on_ios, visible_on_android: currentVisibility.visible_on_android }))
        }
    }, [currentLevel, currentVisibility.visible_on_ios, currentVisibility.visible_on_android, open])

    const handleConfirm = async () => {
        if (isLoading) return
        setIsLoading(true)
        try {
            if (await onConfirm(Number(level), buildMediaPlatformVisibility(scope))) onOpenChange(false)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => { if (!isLoading) onOpenChange(nextOpen) }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>编辑媒体展示设置</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>选择会员等级（0-9）</Label>
                        <Select disabled={isLoading} value={level} onValueChange={setLevel}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {LEVEL_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <MediaPlatformSelect value={scope} onChange={setScope} disabled={isLoading} />
                </div>
                <DialogFooter>
                    <Button disabled={isLoading} variant="outline" onClick={() => onOpenChange(false)}>
                        取消
                    </Button>
                    <Button disabled={isLoading} onClick={handleConfirm} className="cursor-pointer">
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isLoading ? '保存中...' : '确认修改'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
