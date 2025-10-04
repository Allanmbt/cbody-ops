'use client'

import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Link2, Mail, Star, Clock } from 'lucide-react'
import type { UserConnectedAccount } from '@/lib/types/user'

interface UserConnectedAccountsCardProps {
    connectedAccounts: UserConnectedAccount[]
}

// 提供商名称映射
const PROVIDER_NAMES: Record<string, string> = {
    'google': 'Google',
    'apple': 'Apple',
    'facebook': 'Facebook',
    'line': 'Line',
    'kakao': 'Kakao',
    'wechat': '微信',
}

// 提供商颜色
const PROVIDER_COLORS: Record<string, string> = {
    'google': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    'apple': 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    'facebook': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    'line': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    'kakao': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    'wechat': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
}

// 提供商图标（使用emoji作为简单图标）
const PROVIDER_ICONS: Record<string, string> = {
    'google': '🔍',
    'apple': '🍎',
    'facebook': '📘',
    'line': '💬',
    'kakao': '💛',
    'wechat': '💚',
}

export function UserConnectedAccountsCard({ connectedAccounts }: UserConnectedAccountsCardProps) {
    if (connectedAccounts.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Link2 className="h-5 w-5" />
                        绑定账号
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                        暂无绑定账号
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Link2 className="h-5 w-5" />
                    绑定账号
                    <Badge variant="secondary" className="ml-auto">
                        {connectedAccounts.length} 个账号
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {connectedAccounts.map((account) => (
                        <div
                            key={account.id}
                            className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                        >
                            <div className="flex-shrink-0">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${PROVIDER_COLORS[account.provider] || 'bg-muted'
                                    }`}>
                                    {PROVIDER_ICONS[account.provider] || '🔗'}
                                </div>
                            </div>

                            <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium">
                                        {PROVIDER_NAMES[account.provider] || account.provider}
                                    </span>
                                    {account.is_primary && (
                                        <Badge variant="default" className="text-xs">
                                            <Star className="h-3 w-3 mr-1" />
                                            主要登录方式
                                        </Badge>
                                    )}
                                </div>

                                <div className="space-y-1 text-sm text-muted-foreground">
                                    {account.provider_email && (
                                        <div className="flex items-center gap-1">
                                            <Mail className="h-3 w-3" />
                                            {account.provider_email}
                                        </div>
                                    )}

                                    <div className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        绑定时间: {format(new Date(account.linked_at), 'yyyy年MM月dd日', { locale: zhCN })}
                                    </div>

                                    {account.last_used_at && (
                                        <div className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            最后使用: {format(new Date(account.last_used_at), 'yyyy年MM月dd日', { locale: zhCN })}
                                        </div>
                                    )}

                                    <div className="text-xs font-mono bg-muted px-2 py-1 rounded">
                                        ID: {account.provider_user_id}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-4 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                    <p>💡 提示：第三方账号绑定和解绑需要在客户端应用中进行，后台仅可查看绑定状态。</p>
                </div>
            </CardContent>
        </Card>
    )
}
