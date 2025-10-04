'use client'

import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Smartphone, Monitor, Tablet, Globe, Clock } from 'lucide-react'
import type { UserLoginEvent } from '@/lib/types/user'

interface UserLoginHistoryCardProps {
    loginEvents: UserLoginEvent[]
}

// 登录方式映射
const LOGIN_METHOD_NAMES: Record<string, string> = {
    'phone': '手机号',
    'google': 'Google',
    'apple': 'Apple',
    'facebook': 'Facebook',
    'line': 'Line',
}

// 登录方式颜色
const LOGIN_METHOD_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    'phone': 'default',
    'google': 'secondary',
    'apple': 'outline',
    'facebook': 'default',
    'line': 'secondary',
}

// 根据User Agent判断设备类型
function getDeviceIcon(userAgent: string | null) {
    if (!userAgent) return Globe

    const ua = userAgent.toLowerCase()

    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
        return Smartphone
    } else if (ua.includes('tablet') || ua.includes('ipad')) {
        return Tablet
    } else {
        return Monitor
    }
}

// 简化User Agent显示
function simplifyUserAgent(userAgent: string | null): string {
    if (!userAgent) return '未知设备'

    const ua = userAgent.toLowerCase()

    // 检测浏览器
    let browser = '未知浏览器'
    if (ua.includes('chrome')) browser = 'Chrome'
    else if (ua.includes('firefox')) browser = 'Firefox'
    else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari'
    else if (ua.includes('edge')) browser = 'Edge'

    // 检测操作系统
    let os = ''
    if (ua.includes('windows')) os = 'Windows'
    else if (ua.includes('mac')) os = 'macOS'
    else if (ua.includes('linux')) os = 'Linux'
    else if (ua.includes('android')) os = 'Android'
    else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS'

    return `${browser}${os ? ` / ${os}` : ''}`
}

export function UserLoginHistoryCard({ loginEvents }: UserLoginHistoryCardProps) {
    if (loginEvents.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        登录记录
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                        暂无登录记录
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    登录记录
                    <Badge variant="secondary" className="ml-auto">
                        {loginEvents.length} 条记录
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {loginEvents.map((event) => {
                        const DeviceIcon = getDeviceIcon(event.user_agent)

                        return (
                            <div
                                key={event.id}
                                className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                            >
                                <div className="flex-shrink-0">
                                    <DeviceIcon className="h-5 w-5 text-muted-foreground" />
                                </div>

                                <div className="flex-1 space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-medium">
                                            {format(new Date(event.logged_at), 'yyyy年MM月dd日 HH:mm:ss', { locale: zhCN })}
                                        </span>
                                        {event.login_method && (
                                            <Badge variant={LOGIN_METHOD_COLORS[event.login_method] || 'outline'}>
                                                {LOGIN_METHOD_NAMES[event.login_method] || event.login_method}
                                            </Badge>
                                        )}
                                    </div>

                                    <div className="text-sm text-muted-foreground space-y-1">
                                        {event.ip_address && (
                                            <div>IP: {event.ip_address}</div>
                                        )}

                                        {event.device_id && (
                                            <div>设备ID: {event.device_id}</div>
                                        )}

                                        {event.user_agent && (
                                            <div>设备: {simplifyUserAgent(event.user_agent)}</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {loginEvents.length >= 50 && (
                    <div className="mt-4 text-center text-sm text-muted-foreground">
                        仅显示最近 50 条登录记录
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
