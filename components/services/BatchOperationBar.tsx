"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

interface BatchOperationBarProps {
    selectedCount: number
    allSelected: boolean
    totalCount: number
    onBind: () => void
    onUnbind: (notes: string, disableDurations: boolean) => void
    onRestore: (notes?: string) => void
    onClearSelection: () => void
    loading?: boolean
}

export function BatchOperationBar({
    selectedCount,
    allSelected,
    totalCount,
    onBind,
    onUnbind,
    onRestore,
    onClearSelection,
    loading = false
}: BatchOperationBarProps) {
    const [unbindDialogOpen, setUnbindDialogOpen] = useState(false)
    const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
    const [unbindNotes, setUnbindNotes] = useState('')
    const [disableDurations, setDisableDurations] = useState(false)
    const [restoreNotes, setRestoreNotes] = useState('')

    const displayCount = allSelected ? totalCount : selectedCount

    if (displayCount === 0) return null

    const handleUnbind = () => {
        if (!unbindNotes.trim()) {
            return
        }
        onUnbind(unbindNotes, disableDurations)
        setUnbindDialogOpen(false)
        setUnbindNotes('')
        setDisableDurations(false)
    }

    const handleRestore = () => {
        onRestore(restoreNotes || undefined)
        setRestoreDialogOpen(false)
        setRestoreNotes('')
    }

    return (
        <>
            <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg z-50">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <span className="text-sm font-medium">
                                已选择 {displayCount} 位技师
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onClearSelection}
                            >
                                清除选择
                            </Button>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="default"
                                onClick={onBind}
                                disabled={loading}
                            >
                                批量绑定
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setUnbindDialogOpen(true)}
                                disabled={loading}
                            >
                                批量解绑
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setRestoreDialogOpen(true)}
                                disabled={loading}
                            >
                                批量恢复
                            </Button>
                            <Button
                                variant="ghost"
                                disabled
                            >
                                套用时长模板
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* 解绑对话框 */}
            <Dialog open={unbindDialogOpen} onOpenChange={setUnbindDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>批量解绑技师</DialogTitle>
                        <DialogDescription>
                            您即将解绑 {displayCount} 位技师，请填写解绑理由
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="unbind-notes">解绑理由 *</Label>
                            <Textarea
                                id="unbind-notes"
                                placeholder="请输入解绑理由..."
                                value={unbindNotes}
                                onChange={(e) => setUnbindNotes(e.target.value)}
                                rows={4}
                            />
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="disable-durations"
                                checked={disableDurations}
                                onCheckedChange={(checked) => setDisableDurations(checked as boolean)}
                            />
                            <Label htmlFor="disable-durations" className="text-sm font-normal cursor-pointer">
                                同时禁用这些技师的所有服务时长
                            </Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setUnbindDialogOpen(false)}
                        >
                            取消
                        </Button>
                        <Button
                            onClick={handleUnbind}
                            disabled={!unbindNotes.trim()}
                        >
                            确认解绑
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 恢复对话框 */}
            <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>批量恢复技师</DialogTitle>
                        <DialogDescription>
                            您即将恢复 {displayCount} 位技师的服务绑定
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="restore-notes">备注（可选）</Label>
                            <Textarea
                                id="restore-notes"
                                placeholder="可选填写恢复备注..."
                                value={restoreNotes}
                                onChange={(e) => setRestoreNotes(e.target.value)}
                                rows={4}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setRestoreDialogOpen(false)}
                        >
                            取消
                        </Button>
                        <Button onClick={handleRestore}>
                            确认恢复
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
