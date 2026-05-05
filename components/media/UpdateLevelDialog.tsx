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

interface UpdateLevelDialogProps {
    open: boolean
    currentLevel: number
    onOpenChange: (open: boolean) => void
    onConfirm: (level: number) => void
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

export function UpdateLevelDialog({ open, currentLevel, onOpenChange, onConfirm }: UpdateLevelDialogProps) {
    const [level, setLevel] = useState(currentLevel.toString())

    useEffect(() => {
        if (open) {
            setLevel(currentLevel.toString())
        }
    }, [currentLevel, open])

    const handleConfirm = () => {
        onConfirm(Number(level))
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>修改可见等级</DialogTitle>
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
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        取消
                    </Button>
                    <Button onClick={handleConfirm} className="cursor-pointer">
                        确认修改
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
