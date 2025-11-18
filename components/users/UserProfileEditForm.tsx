'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Save, Loader2 } from 'lucide-react'
import type { UserProfile, UpdateUserProfileData } from '@/lib/features/users'
import { updateUserProfileSchema } from '@/lib/features/users'
import { updateUserProfile } from '@/app/dashboard/users/actions'
import { useCurrentAdmin } from '@/hooks/use-current-admin'

interface UserProfileEditFormProps {
    profile: UserProfile
    onSuccess: () => void
    onCancel: () => void
}

// 语言选项
const LANGUAGE_OPTIONS = [
    { value: 'en', label: 'English' },
    { value: 'zh', label: '中文' },
    { value: 'th', label: 'ไทย' },
]

// 用户等级选项
const LEVEL_OPTIONS = Array.from({ length: 10 }, (_, i) => ({
    value: i + 1,
    label: `Lv.${i + 1}`,
}))

export function UserProfileEditForm({
    profile,
    onSuccess,
    onCancel,
}: UserProfileEditFormProps) {
    const { admin } = useCurrentAdmin()
    const [isSubmitting, setIsSubmitting] = useState(false)

    const form = useForm<UpdateUserProfileData>({
        resolver: zodResolver(updateUserProfileSchema),
        defaultValues: {
            display_name: profile.display_name || '',
            username: profile.username || '',
            language_code: profile.language_code,
            timezone: profile.timezone || '',
            level: profile.level,
            credit_score: profile.credit_score,
            is_banned: profile.is_banned,
        },
    })

    const onSubmit = async (data: UpdateUserProfileData) => {
        if (!admin?.id) {
            toast.error('未找到管理员信息')
            return
        }

        setIsSubmitting(true)
        try {
            const result = await updateUserProfile(profile.id, data)

            if (result.success) {
                toast.success('用户资料更新成功')
                onSuccess()
            } else {
                toast.error(result.error || '更新失败')
            }
        } catch (error) {
            console.error('Update profile error:', error)
            toast.error('更新失败，请稍后重试')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="display_name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>显示名称</FormLabel>
                                <FormControl>
                                    <Input placeholder="输入显示名称" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="username"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>用户名</FormLabel>
                                <FormControl>
                                    <Input placeholder="输入用户名" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="language_code"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>语言</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="选择语言" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {LANGUAGE_OPTIONS.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="timezone"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>时区</FormLabel>
                                <FormControl>
                                    <Input placeholder="如: Asia/Bangkok" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="level"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>用户等级</FormLabel>
                                <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={String(field.value)}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="选择等级" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {LEVEL_OPTIONS.map((option) => (
                                            <SelectItem key={option.value} value={String(option.value)}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="credit_score"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>信用分 (0-1000)</FormLabel>
                                <FormControl>
                                    <Input
                                        type="number"
                                        min={0}
                                        max={1000}
                                        placeholder="输入信用分"
                                        {...field}
                                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <FormField
                    control={form.control}
                    name="is_banned"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>账户状态</FormLabel>
                            <Select onValueChange={(value) => field.onChange(value === 'true')} defaultValue={String(field.value)}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="选择状态" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="false">正常</SelectItem>
                                    <SelectItem value="true">已封禁</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="flex gap-2 pt-4">
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4 mr-2" />
                        )}
                        保存更改
                    </Button>
                    <Button type="button" variant="outline" onClick={onCancel}>
                        取消
                    </Button>
                </div>
            </form>
        </Form>
    )
}



