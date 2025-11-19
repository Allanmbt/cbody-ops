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
                        <Label>选择会员等级（0-9）</Label>
                        <Select value={level} onValueChange={setLevel}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="0">0 - 公开</SelectItem>
                                <SelectItem value="1">1 - 注册会员</SelectItem>
                                <SelectItem value="2">2 - 已消费会员</SelectItem>
                                <SelectItem value="3">3 - VIP3</SelectItem>
                                <SelectItem value="4">4 - VIP4</SelectItem>
                                <SelectItem value="5">5 - VIP5</SelectItem>
                                <SelectItem value="6">6 - VIP6</SelectItem>
                                <SelectItem value="7">7 - VIP7</SelectItem>
                                <SelectItem value="8">8 - VIP8</SelectItem>
                                <SelectItem value="9">9 - VIP9</SelectItem>
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
