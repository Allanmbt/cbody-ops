'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, CheckCircle2, XCircle, Image } from 'lucide-react'
import { getMediaStats } from '@/app/dashboard/media/actions'
import type { MediaStats as MediaStatsType } from '@/lib/features/media'
import { useCurrentAdmin } from '@/hooks/use-current-admin'

export function MediaStats() {
    const { admin, loading: adminLoading } = useCurrentAdmin()
    const [stats, setStats] = useState<MediaStatsType | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchStats() {
            if (!admin?.id || adminLoading) {
                return
            }

            try {
                const data = await getMediaStats()
                setStats(data)
            } catch (error) {
                console.error('Failed to fetch media stats:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchStats()
    }, [admin?.id, adminLoading])

    if (loading) {
        return (
            <div className="grid gap-4 md:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <Card key={i}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">加载中...</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">--</div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        )
    }

    return (
        <div className="grid gap-4 md:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">待审核</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats?.pending_count || 0}</div>
                    <p className="text-xs text-muted-foreground">等待审核的媒体</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">已发布</CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats?.approved_count || 0}</div>
                    <p className="text-xs text-muted-foreground">审核通过的媒体</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">已驳回</CardTitle>
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats?.rejected_count || 0}</div>
                    <p className="text-xs text-muted-foreground">被驳回的媒体</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">总计</CardTitle>
                    <Image className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats?.total_count || 0}</div>
                    <p className="text-xs text-muted-foreground">所有媒体文件</p>
                </CardContent>
            </Card>
        </div>
    )
}
