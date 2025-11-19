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

export function BatchApproveDialog({ open, onClose, onConfirm, count }: BatchApproveDialogProps) {
    const [minUserLevel, setMinUserLevel] = useState(0)
    const [isLoading, setIsLoading] = useState(false)

    const handleConfirm = async () => {
        setIsLoading(true)
        try {
            await onConfirm(minUserLevel)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>批量审核通过</DialogTitle>
                    <DialogDescription>
                        将批量通过 {count} 个媒体
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="level">会员可见等级</Label>
                        <Select
                            value={minUserLevel.toString()}
                            onValueChange={(value) => setMinUserLevel(parseInt(value))}
                        >
                            <SelectTrigger id="level">
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
                        <p className="text-xs text-muted-foreground">
                            设置可查看该媒体的最低会员等级
                        </p>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isLoading}>
                        取消
                    </Button>
                    <Button onClick={handleConfirm} disabled={isLoading} className="cursor-pointer">
                        {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        {isLoading ? '处理中...' : '确认通过'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
