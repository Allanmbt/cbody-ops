'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Ban, CheckCircle, Loader2 } from 'lucide-react'
import type { UserListItem } from '@/lib/types/user'
import { toggleUserBan } from '@/app/dashboard/users/actions'

interface UserBanToggleProps {
    user: UserListItem
}

export function UserBanToggle({ user }: UserBanToggleProps) {
    const router = useRouter()
    const [isOpen, setIsOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [reason, setReason] = useState('')

    const handleToggleBan = async () => {
        if (!reason.trim() && !user.is_banned) {
            toast.error('请输入封禁原因')
            return
        }

        setIsSubmitting(true)
        try {
            const result = await toggleUserBan({
                user_id: user.id,
                is_banned: !user.is_banned,
                reason: reason.trim() || undefined,
            })

            if (result.success) {
                toast.success(user.is_banned ? '用户已解禁' : '用户已封禁')
                setIsOpen(false)
                setReason('')
                router.refresh()
            } else {
                toast.error(result.error || '操作失败')
            }
        } catch (error) {
            console.error('Toggle ban error:', error)
            toast.error('操作失败，请稍后重试')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            setReason('')
        }
        setIsOpen(open)
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button
                    variant={user.is_banned ? "default" : "destructive"}
                    size="sm"
                >
                    {user.is_banned ? (
                        <CheckCircle className="h-4 w-4" />
                    ) : (
                        <Ban className="h-4 w-4" />
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {user.is_banned ? '解禁用户' : '封禁用户'}
                    </DialogTitle>
                    <DialogDescription>
                        {user.is_banned
                            ? `确定要解禁用户 "${user.display_name || user.username}" 吗？`
                            : `确定要封禁用户 "${user.display_name || user.username}" 吗？`
                        }
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="reason">
                            {user.is_banned ? '解禁原因（可选）' : '封禁原因'}
                        </Label>
                        <Textarea
                            id="reason"
                            placeholder={user.is_banned ? '输入解禁原因...' : '输入封禁原因...'}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={3}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => setIsOpen(false)}
                        disabled={isSubmitting}
                    >
                        取消
                    </Button>
                    <Button
                        variant={user.is_banned ? "default" : "destructive"}
                        onClick={handleToggleBan}
                        disabled={isSubmitting || (!user.is_banned && !reason.trim())}
                    >
                        {isSubmitting ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : user.is_banned ? (
                            <CheckCircle className="h-4 w-4 mr-2" />
                        ) : (
                            <Ban className="h-4 w-4 mr-2" />
                        )}
                        {user.is_banned ? '解禁' : '封禁'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
