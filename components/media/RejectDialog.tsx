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

interface RejectDialogProps {
    open: boolean
    onClose: () => void
    onConfirm: (reason: string) => void
}

export function RejectDialog({ open, onClose, onConfirm }: RejectDialogProps) {
    const [reason, setReason] = useState('')

    const handleConfirm = () => {
        if (!reason.trim()) {
            return
        }
        onConfirm(reason)
        setReason('')
    }

    return (
        <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>驳回媒体</DialogTitle>
                    <DialogDescription>
                        请填写驳回原因，将发送给技师
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
                    <Button variant="outline" onClick={onClose}>
                        取消
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleConfirm}
                        disabled={!reason.trim()}
                    >
                        确认驳回
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
