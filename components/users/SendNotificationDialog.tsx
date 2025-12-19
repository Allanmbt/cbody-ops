'use client'

import { useState } from 'react'
import { toast } from 'sonner'
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
import { LoadingSpinner } from '@/components/ui/loading'
import { Send } from 'lucide-react'
import { sendSystemNotificationToUser } from '@/app/dashboard/users/actions'

interface SendNotificationDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    userId: string
    userName?: string
}

export function SendNotificationDialog({
    open,
    onOpenChange,
    userId,
    userName
}: SendNotificationDialogProps) {
    const [content, setContent] = useState('')
    const [sending, setSending] = useState(false)

    const handleSend = async () => {
        if (!content.trim()) {
            toast.error('请输入通知内容')
            return
        }

        if (content.length > 1000) {
            toast.error('通知内容不能超过1000字符')
            return
        }

        setSending(true)

        try {
            const result = await sendSystemNotificationToUser(userId, content)

            if (result.success) {
                toast.success('系统通知已发送')
                setContent('')
                onOpenChange(false)
            } else {
                toast.error(result.error || '发送通知失败')
            }
        } catch (error) {
            toast.error('发送通知失败')
        } finally {
            setSending(false)
        }
    }

    const handleClose = () => {
        if (!sending) {
            setContent('')
            onOpenChange(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Send className="h-5 w-5" />
                        发送系统通知
                    </DialogTitle>
                    <DialogDescription>
                        向用户 <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{userName || userId}</code> 发送系统通知
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">通知内容</label>
                        <Textarea
                            placeholder="请输入要发送的通知内容..."
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            rows={6}
                            maxLength={1000}
                            disabled={sending}
                            className="resize-none"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>系统通知将发送到用户的聊天消息中</span>
                            <span>{content.length}/1000</span>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        disabled={sending}
                    >
                        取消
                    </Button>
                    <Button
                        onClick={handleSend}
                        disabled={sending || !content.trim()}
                    >
                        {sending ? (
                            <>
                                <LoadingSpinner className="mr-2" />
                                发送中...
                            </>
                        ) : (
                            <>
                                <Send className="mr-2 h-4 w-4" />
                                发送通知
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
