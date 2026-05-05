'use client'

import { useEffect, useState } from 'react'
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

interface BatchUpdateLevelDialogProps {
    open: boolean
    count: number
    onClose: () => void
    onConfirm: (level: number) => Promise<void>
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
    const [level, setLevel] = useState('0')
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        if (open) {
            setLevel('0')
        }
    }, [open])

    const handleConfirm = async () => {
        setIsLoading(true)
        try {
            await onConfirm(Number(level))
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>批量修改可见等级</DialogTitle>
                    <DialogDescription>将为 {count} 个已发布媒体统一修改可见等级。</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>选择会员等级（0-9）</Label>
                        <Select value={level} onValueChange={setLevel}>
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
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isLoading}>
                        取消
                    </Button>
                    <Button onClick={handleConfirm} disabled={isLoading} className="cursor-pointer">
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isLoading ? '处理中...' : '确认修改'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
