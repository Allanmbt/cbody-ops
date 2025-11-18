import { Suspense } from 'react'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { UserProfileCard } from '@/components/users/UserProfileCard'
import { UserLoginHistoryCard } from '@/components/users/UserLoginHistoryCard'
import { UserConnectedAccountsCard } from '@/components/users/UserConnectedAccountsCard'
import { UserActionsCard } from '@/components/users/UserActionsCard'
import type { UserDetails, UserProfile, UserLoginEvent, UserConnectedAccount } from '@/lib/features/users'
import { getCurrentAdmin } from '@/lib/auth'

// 获取用户详情数据
async function getUserDetails(userId: string): Promise<UserDetails> {
    const supabase = createServerComponentClient({ cookies })

    // 获取用户基本资料
    const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

    if (profileError) {
        if (profileError.code === 'PGRST116') {
            throw new Error('USER_NOT_FOUND')
        }
        console.error('Error fetching user profile:', profileError)
        throw new Error('获取用户资料失败')
    }

    // 获取登录记录（最近50条）
    const { data: loginEvents, error: loginError } = await supabase
        .from('user_login_events')
        .select('*')
        .eq('user_id', userId)
        .order('logged_at', { ascending: false })
        .limit(50)

    if (loginError) {
        console.error('Error fetching login events:', loginError)
        throw new Error('获取登录记录失败')
    }

    // 获取绑定账号
    const { data: connectedAccounts, error: accountsError } = await supabase
        .from('user_connected_accounts')
        .select('*')
        .eq('user_id', userId)
        .order('linked_at', { ascending: false })

    if (accountsError) {
        console.error('Error fetching connected accounts:', accountsError)
        throw new Error('获取绑定账号失败')
    }

    return {
        profile: profile as UserProfile,
        login_events: (loginEvents as UserLoginEvent[]) || [],
        connected_accounts: (connectedAccounts as UserConnectedAccount[]) || []
    }
}

// 用户详情内容组件
async function UserDetailsContent({ userId }: { userId: string }) {
    try {
        const userDetails = await getUserDetails(userId)
        const admin = await getCurrentAdmin()

        if (!admin) {
            redirect('/login')
        }

        const canEdit = admin.role === 'superadmin'

        return (
            <div className="grid gap-6">
                {/* 用户基本资料卡片 */}
                <UserProfileCard
                    profile={userDetails.profile}
                    canEdit={canEdit}
                />

                {/* 操作区域（仅superadmin可见） */}
                {canEdit && (
                    <UserActionsCard profile={userDetails.profile} />
                )}

                {/* 登录记录卡片 */}
                <UserLoginHistoryCard
                    loginEvents={userDetails.login_events}
                />

                {/* 绑定账号卡片 */}
                <UserConnectedAccountsCard
                    connectedAccounts={userDetails.connected_accounts}
                />
            </div>
        )
    } catch (error) {
        if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
            notFound()
        }
        throw error
    }
}

// 主页面组件
export default async function UserDetailsPage({
    params,
}: {
    params: { id: string }
}) {
    // 检查管理员权限
    const admin = await getCurrentAdmin()
    if (!admin) {
        redirect('/login')
    }

    // 只有admin和superadmin可以访问用户详情
    if (!['admin', 'superadmin'].includes(admin.role)) {
        redirect('/dashboard')
    }

    const userId = params.id

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">用户详情</h1>
                    <p className="text-muted-foreground">
                        查看和管理用户的详细信息
                    </p>
                </div>
            </div>

            <Suspense fallback={<UserDetailsSkeleton />}>
                <UserDetailsContent userId={userId} />
            </Suspense>
        </div>
    )
}

// 用户详情加载骨架屏
function UserDetailsSkeleton() {
    return (
        <div className="grid gap-6">
            {/* 基本资料卡片骨架 */}
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-24" />
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4">
                        <div className="flex items-center gap-4">
                            <Skeleton className="h-16 w-16 rounded-full" />
                            <div className="space-y-2">
                                <Skeleton className="h-6 w-32" />
                                <Skeleton className="h-4 w-24" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <div key={i} className="space-y-2">
                                    <Skeleton className="h-4 w-20" />
                                    <Skeleton className="h-6 w-32" />
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 操作区域骨架 */}
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-24" />
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2">
                        <Skeleton className="h-10 w-24" />
                        <Skeleton className="h-10 w-24" />
                        <Skeleton className="h-10 w-24" />
                    </div>
                </CardContent>
            </Card>

            {/* 登录记录卡片骨架 */}
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-24" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex justify-between items-center">
                                <div className="space-y-1">
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-3 w-48" />
                                </div>
                                <Skeleton className="h-4 w-24" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* 绑定账号卡片骨架 */}
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-24" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <Skeleton className="h-8 w-8 rounded" />
                                    <div className="space-y-1">
                                        <Skeleton className="h-4 w-24" />
                                        <Skeleton className="h-3 w-48" />
                                    </div>
                                </div>
                                <Skeleton className="h-6 w-16" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
