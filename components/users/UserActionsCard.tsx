'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Ban, CheckCircle, Key, Loader2, Settings, AlertTriangle } from 'lucide-react'
import type { UserProfile, UserListItem } from '@/lib/types/user'
import { toggleUserBan, resetUserPassword } from '@/app/dashboard/users/actions'

interface UserActionsCardProps {
    profile: UserProfile
}

export function UserActionsCard({ profile }: UserActionsCardProps) {
    const router = useRouter()
    const [isBanDialogOpen, setIsBanDialogOpen] = useState(false)
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false)
    const [isBanSubmitting, setIsBanSubmitting] = useState(false)
    const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false)
    const [banReason, setBanReason] = useState('')
    const [newPassword, setNewPassword] = useState('')

    // 处理封禁/解禁
    const handleToggleBan = async () => {
        if (!profile.is_banned && !banReason.trim()) {
            toast.error('请输入封禁原因')
            return
        }

        setIsBanSubmitting(true)
        try {
            const result = await toggleUserBan({
                user_id: profile.id,
                is_banned: !profile.is_banned,
                reason: banReason.trim() || undefined,
            })

            if (result.success) {
                toast.success(profile.is_banned ? '用户已解禁' : '用户已封禁')
                setIsBanDialogOpen(false)
                setBanReason('')
                router.refresh()
            } else {
                toast.error(result.error || '操作失败')
            }
        } catch (error) {
            console.error('Toggle ban error:', error)
            toast.error('操作失败，请稍后重试')
        } finally {
            setIsBanSubmitting(false)
        }
    }

    // 处理重置密码
    const handleResetPassword = async () => {
        if (!newPassword.trim()) {
            toast.error('请输入新密码')
            return
        }

        if (newPassword.length < 8) {
            toast.error('密码至少需要8个字符')
            return
        }

        setIsPasswordSubmitting(true)
        try {
            const result = await resetUserPassword({
                user_id: profile.id,
                new_password: newPassword,
            })

            if (result.success) {
                toast.success('密码重置成功')
                setIsPasswordDialogOpen(false)
                setNewPassword('')
            } else {
                toast.error(result.error || '重置失败')
            }
        } catch (error) {
            console.error('Reset password error:', error)
            toast.error('重置失败，请稍后重试')
        } finally {
            setIsPasswordSubmitting(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    管理操作
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex gap-2 flex-wrap">
                    {/* 封禁/解禁按钮 */}
                    <Dialog open={isBanDialogOpen} onOpenChange={setIsBanDialogOpen}>
                        <DialogTrigger asChild>
                            <Button
                                variant={profile.is_banned ? "default" : "destructive"}
                                className="gap-2"
                            >
                                {profile.is_banned ? (
                                    <>
                                        <CheckCircle className="h-4 w-4" />
                                        解禁用户
                                    </>
                                ) : (
                                    <>
                                        <Ban className="h-4 w-4" />
                                        封禁用户
                                    </>
                                )}
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    {profile.is_banned ? (
                                        <CheckCircle className="h-5 w-5" />
                                    ) : (
                                        <AlertTriangle className="h-5 w-5 text-destructive" />
                                    )}
                                    {profile.is_banned ? '解禁用户' : '封禁用户'}
                                </DialogTitle>
                                <DialogDescription>
                                    {profile.is_banned
                                        ? `确定要解禁用户 "${profile.display_name || profile.username}" 吗？`
                                        : `确定要封禁用户 "${profile.display_name || profile.username}" 吗？此操作将阻止用户登录和使用服务。`
                                    }
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="ban-reason">
                                        {profile.is_banned ? '解禁原因（可选）' : '封禁原因'}
                                    </Label>
                                    <Textarea
                                        id="ban-reason"
                                        placeholder={profile.is_banned ? '输入解禁原因...' : '输入封禁原因...'}
                                        value={banReason}
                                        onChange={(e) => setBanReason(e.target.value)}
                                        rows={3}
                                    />
                                </div>
                            </div>

                            <DialogFooter>
                                <Button
                                    variant="outline"
                                    onClick={() => setIsBanDialogOpen(false)}
                                    disabled={isBanSubmitting}
                                >
                                    取消
                                </Button>
                                <Button
                                    variant={profile.is_banned ? "default" : "destructive"}
                                    onClick={handleToggleBan}
                                    disabled={isBanSubmitting || (!profile.is_banned && !banReason.trim())}
                                >
                                    {isBanSubmitting ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : profile.is_banned ? (
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                    ) : (
                                        <Ban className="h-4 w-4 mr-2" />
                                    )}
                                    {profile.is_banned ? '确认解禁' : '确认封禁'}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* 重置密码按钮 */}
                    <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="gap-2">
                                <Key className="h-4 w-4" />
                                重置密码
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <Key className="h-5 w-5" />
                                    重置用户密码
                                </DialogTitle>
                                <DialogDescription>
                                    为用户 &quot;{profile.display_name || profile.username}&quot; 设置新密码。用户将需要使用新密码登录。
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="new-password">新密码</Label>
                                    <Input
                                        id="new-password"
                                        type="password"
                                        placeholder="输入新密码（至少8个字符）"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                    />
                                </div>

                                <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                                    <p>⚠️ 重置密码后，用户的所有登录会话将失效，需要使用新密码重新登录。</p>
                                </div>
                            </div>

                            <DialogFooter>
                                <Button
                                    variant="outline"
                                    onClick={() => setIsPasswordDialogOpen(false)}
                                    disabled={isPasswordSubmitting}
                                >
                                    取消
                                </Button>
                                <Button
                                    onClick={handleResetPassword}
                                    disabled={isPasswordSubmitting || !newPassword.trim() || newPassword.length < 8}
                                >
                                    {isPasswordSubmitting ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <Key className="h-4 w-4 mr-2" />
                                    )}
                                    确认重置
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="mt-4 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                    <p>⚠️ 注意：以上操作仅限超级管理员使用，操作将被记录到审计日志中。</p>
                </div>
            </CardContent>
        </Card>
    )
}
