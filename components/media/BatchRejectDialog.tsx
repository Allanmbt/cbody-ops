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
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'

interface BatchRejectDialogProps {
    open: boolean
    onClose: () => void
    onConfirm: (reason: string) => Promise<void>
    count: number
}

export function BatchRejectDialog({ open, onClose, onConfirm, count }: BatchRejectDialogProps) {
    const [reason, setReason] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    const handleConfirm = async () => {
        const trimmedReason = reason.trim()
        if (!trimmedReason) {
            return
        }

        setIsLoading(true)
        try {
            await onConfirm(trimmedReason)
            setReason('')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>批量驳回</DialogTitle>
                    <DialogDescription>将批量驳回 {count} 个媒体。</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="reason">驳回原因 *</Label>
                        <Textarea
                            id="reason"
                            placeholder="请输入驳回原因..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={4}
                            maxLength={500}
                        />
                        <p className="text-xs text-muted-foreground">{reason.length}/500 字</p>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isLoading}>
                        取消
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleConfirm}
                        disabled={!reason.trim() || isLoading}
                        className="cursor-pointer"
                    >
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isLoading ? '处理中...' : '确认驳回'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
