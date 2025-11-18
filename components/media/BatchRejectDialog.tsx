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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
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
        if (!reason.trim()) {
            return
        }
        setIsLoading(true)
        try {
            await onConfirm(reason)
            setReason('')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>批量驳回</DialogTitle>
                    <DialogDescription>
                        将批量驳回 {count} 个媒体
                    </DialogDescription>
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
                        <p className="text-xs text-muted-foreground">
                            {reason.length}/500 字符
                        </p>
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
                        {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        {isLoading ? '处理中...' : '确认驳回'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
