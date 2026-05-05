'use client'

import { useState } from 'react'
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

interface BatchApproveDialogProps {
    open: boolean
    onClose: () => void
    onConfirm: (minUserLevel: number) => Promise<void>
    count: number
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

export function BatchApproveDialog({ open, onClose, onConfirm, count }: BatchApproveDialogProps) {
    const [minUserLevel, setMinUserLevel] = useState('0')
    const [isLoading, setIsLoading] = useState(false)

    const handleConfirm = async () => {
        setIsLoading(true)
        try {
            await onConfirm(Number(minUserLevel))
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>批量审核通过</DialogTitle>
                    <DialogDescription>将批量通过 {count} 个媒体。</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="level">会员可见等级</Label>
                        <Select value={minUserLevel} onValueChange={setMinUserLevel}>
                            <SelectTrigger id="level">
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
                        <p className="text-xs text-muted-foreground">设置查看该媒体所需的最低会员等级。</p>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isLoading}>
                        取消
                    </Button>
                    <Button onClick={handleConfirm} disabled={isLoading} className="cursor-pointer">
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isLoading ? '处理中...' : '确认通过'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
