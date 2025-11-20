"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, CheckCircle, TrendingUp, ShoppingCart } from "lucide-react"
import { getAdminServiceStats, type AdminServiceStats } from "@/app/dashboard/services/actions"

export function ServiceStatsCards() {
    const [stats, setStats] = useState<AdminServiceStats | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function loadStats() {
            setLoading(true)
            const result = await getAdminServiceStats()
            if (result.ok && result.data) {
                setStats(result.data)
            }
            setLoading(false)
        }
        loadStats()
    }, [])

    return (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium">总服务数</CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {loading ? "-" : stats?.total_count || 0}
                        <span className="text-base font-normal text-muted-foreground ml-1">个</span>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium">上架服务</CardTitle>
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {loading ? "-" : stats?.active_count || 0}
                        <span className="text-base font-normal text-muted-foreground ml-1">个</span>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium">本月新增</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {loading ? "-" : stats?.this_month_count || 0}
                        <span className="text-base font-normal text-muted-foreground ml-1">个</span>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium">总销量</CardTitle>
                    <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {loading ? "-" : (stats?.total_sales || 0).toLocaleString()}
                        <span className="text-base font-normal text-muted-foreground ml-1">单</span>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
