'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'

interface UpdateLevelDialogProps {
    open: boolean
    currentLevel: number
    onOpenChange: (open: boolean) => void
    onConfirm: (level: number) => void
}

export function UpdateLevelDialog({ open, currentLevel, onOpenChange, onConfirm }: UpdateLevelDialogProps) {
    const [level, setLevel] = useState(currentLevel.toString())

    const handleConfirm = () => {
        onConfirm(parseInt(level))
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>修改会员等级</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>选择会员等级</Label>
                        <Select value={level} onValueChange={setLevel}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="0">Lv.0 - 公开</SelectItem>
                                <SelectItem value="1">Lv.1 - 普通会员</SelectItem>
                                <SelectItem value="2">Lv.2 - 银卡会员</SelectItem>
                                <SelectItem value="3">Lv.3 - 金卡会员</SelectItem>
                                <SelectItem value="4">Lv.4 - 白金会员</SelectItem>
                                <SelectItem value="5">Lv.5 - 钻石会员</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
                    <Button onClick={handleConfirm} className="cursor-pointer">确认修改</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
