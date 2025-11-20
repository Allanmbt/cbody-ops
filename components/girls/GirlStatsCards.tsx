"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, CheckCircle, Clock, Wifi } from "lucide-react"
import { getAdminGirlStats, type AdminGirlStats } from "@/app/dashboard/girls/actions"

export function GirlStatsCards() {
    const [stats, setStats] = useState<AdminGirlStats | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function loadStats() {
            setLoading(true)
            const result = await getAdminGirlStats()
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
                    <CardTitle className="text-sm font-medium">总技师数</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {loading ? "-" : stats?.total || 0}
                        <span className="text-base font-normal text-muted-foreground ml-1">位</span>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium">已认证</CardTitle>
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {loading ? "-" : stats?.verified || 0}
                        <span className="text-base font-normal text-muted-foreground ml-1">位</span>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium">待审核</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {loading ? "-" : stats?.pending || 0}
                        <span className="text-base font-normal text-muted-foreground ml-1">位</span>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium">在线技师</CardTitle>
                    <Wifi className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {loading ? "-" : stats?.online || 0}
                        <span className="text-base font-normal text-muted-foreground ml-1">位</span>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
