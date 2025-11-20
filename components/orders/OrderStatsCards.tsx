"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ShoppingCart, Clock, Activity, CheckCircle2, XCircle } from "lucide-react"
import { getAdminOrderStats, type AdminOrderStats } from "@/app/dashboard/orders/actions"

export function OrderStatsCards() {
    const [stats, setStats] = useState<AdminOrderStats | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function loadStats() {
            setLoading(true)
            const result = await getAdminOrderStats()
            if (result.ok && result.data) {
                setStats(result.data)
            }
            setLoading(false)
        }
        loadStats()
    }, [])

    return (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-7">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium">总订单数</CardTitle>
                    <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {loading ? "-" : (stats?.total || 0).toLocaleString()}
                        <span className="text-base font-normal text-muted-foreground ml-1">单</span>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium">待确认</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {loading ? "-" : stats?.pending || 0}
                        <span className="text-base font-normal text-muted-foreground ml-1">单</span>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium">进行中</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {loading ? "-" : stats?.active || 0}
                        <span className="text-base font-normal text-muted-foreground ml-1">单</span>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium">今日完成</CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {loading ? "-" : stats?.today_completed || 0}
                        <span className="text-base font-normal text-muted-foreground ml-1">单</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">6:00起</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium">今日取消</CardTitle>
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {loading ? "-" : stats?.today_cancelled || 0}
                        <span className="text-base font-normal text-muted-foreground ml-1">单</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">6:00起</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium">昨日完成</CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {loading ? "-" : stats?.yesterday_completed || 0}
                        <span className="text-base font-normal text-muted-foreground ml-1">单</span>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium">昨日取消</CardTitle>
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {loading ? "-" : stats?.yesterday_cancelled || 0}
                        <span className="text-base font-normal text-muted-foreground ml-1">单</span>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
