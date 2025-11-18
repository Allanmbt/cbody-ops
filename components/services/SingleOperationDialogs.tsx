"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

interface SingleOperationDialogsProps {
    girlName: string
    operationType: 'unbind' | 'restore' | null
    open: boolean
    onClose: () => void
    onConfirm: (notes?: string, disableDurations?: boolean) => void
}

export function SingleOperationDialogs({
    girlName,
    operationType,
    open,
    onClose,
    onConfirm
}: SingleOperationDialogsProps) {
    const [notes, setNotes] = useState('')
    const [disableDurations, setDisableDurations] = useState(false)

    const handleConfirm = () => {
        if (operationType === 'unbind' && !notes.trim()) {
            return
        }
        onConfirm(notes || undefined, disableDurations)
        setNotes('')
        setDisableDurations(false)
        onClose()
    }

    const handleClose = () => {
        setNotes('')
        setDisableDurations(false)
        onClose()
    }

    if (operationType === 'unbind') {
        return (
            <Dialog open={open} onOpenChange={handleClose}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>解绑技师服务</DialogTitle>
                        <DialogDescription>
                            您即将解绑技师「{girlName}」的此服务，请填写解绑理由
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="single-unbind-notes">解绑理由 *</Label>
                            <Textarea
                                id="single-unbind-notes"
                                placeholder="请输入解绑理由..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={4}
                            />
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="single-disable-durations"
                                checked={disableDurations}
                                onCheckedChange={(checked) => setDisableDurations(checked as boolean)}
                            />
                            <Label htmlFor="single-disable-durations" className="text-sm font-normal cursor-pointer">
                                同时禁用该技师的所有服务时长
                            </Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={handleClose}>
                            取消
                        </Button>
                        <Button onClick={handleConfirm} disabled={!notes.trim()}>
                            确认解绑
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        )
    }

    if (operationType === 'restore') {
        return (
            <Dialog open={open} onOpenChange={handleClose}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>恢复技师服务</DialogTitle>
                        <DialogDescription>
                            您即将恢复技师「{girlName}」的此服务绑定
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="single-restore-notes">备注（可选）</Label>
                            <Textarea
                                id="single-restore-notes"
                                placeholder="可选填写恢复备注..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={4}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={handleClose}>
                            取消
                        </Button>
                        <Button onClick={handleConfirm}>
                            确认恢复
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        )
    }

    return null
}
