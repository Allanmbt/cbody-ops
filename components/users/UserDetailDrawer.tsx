'use client'

import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { LoadingSpinner } from '@/components/ui/loading'
import {
    User,
    Mail,
    Phone,
    Globe,
    MapPin,
    Calendar,
    Award,
    Shield,
    Ban,
    CheckCircle,
    Smartphone,
    Monitor,
    Tablet,
    Copy,
    Edit2,
    Save,
    X
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { getUserDetail, updateUserAdminTags } from '@/app/dashboard/users/actions'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { UserAdminTags } from './UserAdminTags'

interface UserDetailDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    userId: string | null
}

// 性别映射
const GENDER_MAP: Record<number, string> = {
    0: '男',
    1: '女',
    2: '不愿透露'
}

// 国家代码映射
const COUNTRY_NAMES: Record<string, string> = {
    'TH': '泰国 🇹🇭',
    'CN': '中国 🇨🇳',
    'US': '美国 🇺🇸',
    'JP': '日本 🇯🇵',
    'KR': '韩国 🇰🇷',
    'SG': '新加坡 🇸🇬',
    'MY': '马来西亚 🇲🇾',
    'VN': '越南 🇻🇳',
    'ID': '印尼 🇮🇩',
    'PH': '菲律宾 🇵🇭',
    'HK': '香港 🇭🇰',
    'NO': '挪威 🇳🇴',
}

// 语言代码映射
const LANGUAGE_NAMES: Record<string, string> = {
    'en': 'English',
    'zh': '中文',
    'th': 'ไทย',
}

// 解析设备类型（从 preferences 字段）
function getDeviceType(preferences: any): string {
    if (!preferences || typeof preferences !== 'object') {
        return 'Web'
    }

    const osName = preferences.osName?.toLowerCase() || ''

    if (osName.includes('ios') || osName.includes('iphone') || osName.includes('ipad')) {
        return 'iOS'
    }
    if (osName.includes('android')) {
        return 'Android'
    }
    if (osName.includes('mac') || osName.includes('windows') || osName.includes('linux')) {
        return 'Web'
    }

    return 'Web'
}

// 获取设备图标
function getDeviceIcon(deviceType: string) {
    switch (deviceType) {
        case 'iOS':
            return <Smartphone className="h-4 w-4" />
        case 'Android':
            return <Tablet className="h-4 w-4" />
        default:
            return <Monitor className="h-4 w-4" />
    }
}

export function UserDetailDrawer({ open, onOpenChange, userId }: UserDetailDrawerProps) {
    const [user, setUser] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [editingTags, setEditingTags] = useState(false)
    const [tagInput, setTagInput] = useState('')
    const [savingTags, setSavingTags] = useState(false)

    useEffect(() => {
        if (open && userId) {
            loadUserDetail()
        }
    }, [open, userId])

    const loadUserDetail = async () => {
        if (!userId) return

        setLoading(true)
        const result = await getUserDetail(userId)
        if (result.success && result.data) {
            setUser(result.data)
            setTagInput((result.data.admin_tags || []).join('，'))
            setEditingTags(false)
        } else {
            toast.error(result.error || '加载用户详情失败')
        }
        setLoading(false)
    }

    const formatDateTime = (dateStr: string | null) => {
        if (!dateStr) return '-'
        return format(new Date(dateStr), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })
    }

    // 复制到剪贴板
    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text).then(() => {
            toast.success(`${label}已复制`)
        }).catch(() => {
            toast.error('复制失败')
        })
    }

    const deviceType = user ? getDeviceType(user.preferences) : 'Web'

    const parseTagInput = () => Array.from(new Set(
        tagInput
            .split(/[,，\n]/)
            .map((tag) => tag.trim())
            .filter(Boolean)
    ))

    const handleSaveTags = async () => {
        if (!user) return

        const tags = parseTagInput()
        if (tags.length > 10) {
            toast.error('后台标签最多10个')
            return
        }
        if (tags.some((tag) => tag.length > 20)) {
            toast.error('后台标签最长20个字符')
            return
        }

        setSavingTags(true)
        const result = await updateUserAdminTags(user.id, tags)
        setSavingTags(false)

        if (!result.success) {
            toast.error(result.error || '更新用户标签失败')
            return
        }

        setUser((prev: any) => prev ? { ...prev, admin_tags: tags } : prev)
        setEditingTags(false)
        toast.success('用户标签已更新')
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>用户详情</SheetTitle>
                </SheetHeader>

                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <LoadingSpinner />
                    </div>
                ) : user ? (
                    <div className="mt-6 space-y-6 px-4">
                        {/* 基本信息 */}
                        <div className="flex items-start gap-4">
                            <Avatar className="h-20 w-20">
                                <AvatarImage src={user.avatar_url || undefined} />
                                <AvatarFallback className="text-2xl">
                                    {user.display_name?.charAt(0) || user.username?.charAt(0) || '?'}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <h2 className="text-2xl font-bold break-words">
                                    {user.display_name || user.username || '未设置'}
                                </h2>
                                <div className="mt-2 space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <UserAdminTags tags={user.admin_tags} />
                                        {!editingTags && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 px-2 text-xs"
                                                onClick={() => {
                                                    setTagInput((user.admin_tags || []).join('，'))
                                                    setEditingTags(true)
                                                }}
                                            >
                                                <Edit2 className="mr-1 h-3 w-3" />
                                                编辑标签
                                            </Button>
                                        )}
                                    </div>
                                    {editingTags && (
                                        <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                                            <Textarea
                                                value={tagInput}
                                                onChange={(event) => setTagInput(event.target.value)}
                                                placeholder="例如：暴力行为，多次取消&#10;有点讨厌"
                                                className="min-h-[80px] bg-background"
                                            />
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-xs text-muted-foreground">
                                                    逗号、中文逗号或换行分隔；最多10个，每个最多20字。
                                                </p>
                                                <div className="flex shrink-0 items-center gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={savingTags}
                                                        onClick={() => {
                                                            setTagInput((user.admin_tags || []).join('，'))
                                                            setEditingTags(false)
                                                        }}
                                                    >
                                                        <X className="mr-1 h-3 w-3" />
                                                        取消
                                                    </Button>
                                                    <Button size="sm" disabled={savingTags} onClick={handleSaveTags}>
                                                        <Save className="mr-1 h-3 w-3" />
                                                        {savingTags ? '保存中' : '保存标签'}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {user.username && user.display_name && (
                                    <p className="text-muted-foreground mt-1">@{user.username}</p>
                                )}
                                {/* ID 显示和复制 */}
                                <div className="flex items-center gap-2 mt-2">
                                    <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded font-mono">
                                        {user.id}
                                    </code>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0"
                                        onClick={() => copyToClipboard(user.id, 'ID')}
                                    >
                                        <Copy className="h-3 w-3" />
                                    </Button>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 mt-3">
                                    <Badge variant="secondary">Lv.{user.level}</Badge>
                                    {user.is_banned ? (
                                        <Badge variant="destructive">
                                            <Ban className="h-3 w-3 mr-1" />
                                            已封禁
                                        </Badge>
                                    ) : (
                                        <Badge variant="default">
                                            <CheckCircle className="h-3 w-3 mr-1" />
                                            正常
                                        </Badge>
                                    )}
                                    {user.is_whitelisted && (
                                        <Badge variant="outline" className="border-blue-500 text-blue-600">
                                            <Shield className="h-3 w-3 mr-1" />
                                            白名单
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* 联系信息 */}
                        <div>
                            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                <User className="h-4 w-4" />
                                联系信息
                            </h3>
                            <dl className="space-y-2.5 text-sm">
                                <div className="flex justify-between">
                                    <dt className="text-muted-foreground flex items-center gap-2">
                                        <Mail className="h-4 w-4" />
                                        邮箱
                                    </dt>
                                    <dd className="font-medium">{user.email || '-'}</dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-muted-foreground flex items-center gap-2">
                                        <Phone className="h-4 w-4" />
                                        手机号
                                    </dt>
                                    <dd className="font-medium">
                                        {user.phone_number
                                            ? `${user.phone_country_code || '+66'} ${user.phone_number}`
                                            : '-'
                                        }
                                    </dd>
                                </div>
                            </dl>
                        </div>

                        <Separator />

                        {/* 地区和语言 */}
                        <div>
                            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                <Globe className="h-4 w-4" />
                                地区和语言
                            </h3>
                            <dl className="space-y-2.5 text-sm">
                                <div className="flex justify-between">
                                    <dt className="text-muted-foreground">国家</dt>
                                    <dd className="font-medium">
                                        {COUNTRY_NAMES[user.country_code] || user.country_code || '-'}
                                    </dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-muted-foreground">语言偏好</dt>
                                    <dd className="font-medium">
                                        {LANGUAGE_NAMES[user.language_code] || user.language_code}
                                    </dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-muted-foreground">时区</dt>
                                    <dd className="font-medium">{user.timezone || '-'}</dd>
                                </div>
                            </dl>
                        </div>

                        <Separator />

                        {/* 用户属性 */}
                        <div>
                            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                <Award className="h-4 w-4" />
                                用户属性
                            </h3>
                            <dl className="space-y-2.5 text-sm">
                                <div className="flex justify-between">
                                    <dt className="text-muted-foreground">性别</dt>
                                    <dd className="font-medium">{GENDER_MAP[user.gender] || '-'}</dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-muted-foreground">等级</dt>
                                    <dd className="font-medium">
                                        <Badge variant="secondary">Lv.{user.level}</Badge>
                                    </dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-muted-foreground">经验值</dt>
                                    <dd className="font-medium">{user.experience.toLocaleString()}</dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-muted-foreground">信用分</dt>
                                    <dd className="font-medium">
                                        <Badge variant={user.credit_score >= 80 ? 'default' : user.credit_score >= 60 ? 'secondary' : 'destructive'}>
                                            {user.credit_score}
                                        </Badge>
                                    </dd>
                                </div>
                            </dl>
                        </div>

                        <Separator />

                        {/* 设备和登录信息 */}
                        <div>
                            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                <Smartphone className="h-4 w-4" />
                                设备和登录信息
                            </h3>
                            <dl className="space-y-2.5 text-sm">
                                <div className="flex justify-between">
                                    <dt className="text-muted-foreground flex items-center gap-2">
                                        {getDeviceIcon(deviceType)}
                                        设备类型
                                    </dt>
                                    <dd className="font-medium">
                                        <Badge variant="outline">{deviceType}</Badge>
                                    </dd>
                                </div>
                                {user.preferences?.osVersion && (
                                    <div className="flex justify-between">
                                        <dt className="text-muted-foreground">系统版本</dt>
                                        <dd className="font-medium text-xs">{user.preferences.osVersion}</dd>
                                    </div>
                                )}
                                {user.preferences?.appVersion && (
                                    <div className="flex justify-between">
                                        <dt className="text-muted-foreground">应用版本</dt>
                                        <dd className="font-medium text-xs">{user.preferences.appVersion}</dd>
                                    </div>
                                )}
                                {user.preferences?.deviceModel && (
                                    <div className="flex justify-between">
                                        <dt className="text-muted-foreground">设备型号</dt>
                                        <dd className="font-medium text-xs">{user.preferences.deviceModel}</dd>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <dt className="text-muted-foreground">最后登录IP</dt>
                                    <dd className="font-mono text-xs">{user.last_ip_address || '-'}</dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-muted-foreground">最后登录时间</dt>
                                    <dd className="font-medium">{formatDateTime(user.last_login_at)}</dd>
                                </div>
                            </dl>
                        </div>

                        <Separator />

                        {/* 时间信息 */}
                        <div>
                            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                时间信息
                            </h3>
                            <dl className="space-y-2.5 text-sm">
                                <div className="flex justify-between">
                                    <dt className="text-muted-foreground">注册时间</dt>
                                    <dd className="font-medium">{formatDateTime(user.created_at)}</dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-muted-foreground">最后更新</dt>
                                    <dd className="font-medium">{formatDateTime(user.updated_at)}</dd>
                                </div>
                            </dl>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-64">
                        <p className="text-muted-foreground">未找到用户信息</p>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    )
}
