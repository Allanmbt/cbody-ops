'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Edit, X } from 'lucide-react'
import type { UserProfile } from '@/lib/types/user'
import { UserProfileEditForm } from './UserProfileEditForm'

interface UserProfileCardProps {
    profile: UserProfile
    canEdit: boolean
}

// 国家代码映射
const COUNTRY_NAMES: Record<string, string> = {
    'TH': '泰国',
    'CN': '中国',
    'US': '美国',
    'JP': '日本',
    'KR': '韩国',
    'SG': '新加坡',
    'MY': '马来西亚',
    'VN': '越南',
    'ID': '印尼',
    'PH': '菲律宾',
}

// 语言代码映射
const LANGUAGE_NAMES: Record<string, string> = {
    'en': 'English',
    'zh': '中文',
    'th': 'ไทย',
}

// 性别映射
const GENDER_NAMES: Record<number, string> = {
    0: '男',
    1: '女',
    2: '不愿透露',
}

export function UserProfileCard({ profile, canEdit }: UserProfileCardProps) {
    const [isEditing, setIsEditing] = useState(false)

    const handleEditSuccess = () => {
        setIsEditing(false)
    }

    const handleEditCancel = () => {
        setIsEditing(false)
    }

    if (isEditing && canEdit) {
        return (
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>编辑用户资料</CardTitle>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleEditCancel}
                        >
                            <X className="h-4 w-4" />
                            取消
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <UserProfileEditForm
                        profile={profile}
                        onSuccess={handleEditSuccess}
                        onCancel={handleEditCancel}
                    />
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>基本资料</CardTitle>
                    {canEdit && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsEditing(true)}
                        >
                            <Edit className="h-4 w-4 mr-2" />
                            编辑
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    {/* 头像和基本信息 */}
                    <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16">
                            <AvatarImage src={profile.avatar_url || undefined} />
                            <AvatarFallback className="text-lg">
                                {profile.display_name?.charAt(0) || profile.username?.charAt(0) || '?'}
                            </AvatarFallback>
                        </Avatar>
                        <div className="space-y-1">
                            <h3 className="text-xl font-semibold">
                                {profile.display_name || profile.username || '未设置'}
                            </h3>
                            {profile.username && profile.display_name && (
                                <p className="text-muted-foreground">@{profile.username}</p>
                            )}
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary">
                                    Lv.{profile.level}
                                </Badge>
                                <Badge variant={profile.credit_score >= 80 ? 'default' : profile.credit_score >= 60 ? 'secondary' : 'destructive'}>
                                    信用分: {profile.credit_score}
                                </Badge>
                                {profile.is_banned && (
                                    <Badge variant="destructive">已封禁</Badge>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 详细信息 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">用户ID</label>
                            <p className="text-sm font-mono bg-muted px-2 py-1 rounded">
                                {profile.id}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">用户名</label>
                            <p>{profile.username || '-'}</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">显示名称</label>
                            <p>{profile.display_name || '-'}</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">性别</label>
                            <p>{GENDER_NAMES[profile.gender] || '未知'}</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">国家</label>
                            <p>{COUNTRY_NAMES[profile.country_code || ''] || profile.country_code || '-'}</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">语言</label>
                            <p>{LANGUAGE_NAMES[profile.language_code] || profile.language_code}</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">时区</label>
                            <p>{profile.timezone || '-'}</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">用户等级</label>
                            <p>Lv.{profile.level}</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">经验值</label>
                            <p>{profile.experience.toLocaleString()}</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">信用分</label>
                            <p>{profile.credit_score}/1000</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">注册时间</label>
                            <p>{format(new Date(profile.created_at), 'yyyy年MM月dd日 HH:mm', { locale: zhCN })}</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">更新时间</label>
                            <p>{format(new Date(profile.updated_at), 'yyyy年MM月dd日 HH:mm', { locale: zhCN })}</p>
                        </div>
                    </div>

                    {/* 通知设置 */}
                    {profile.notification_settings && Object.keys(profile.notification_settings).length > 0 && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">通知设置</label>
                            <div className="flex gap-2 flex-wrap">
                                {Object.entries(profile.notification_settings).map(([key, enabled]) => (
                                    <Badge key={key} variant={enabled ? 'default' : 'secondary'}>
                                        {key}: {enabled ? '开启' : '关闭'}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
