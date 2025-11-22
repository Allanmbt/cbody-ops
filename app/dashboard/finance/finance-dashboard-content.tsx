"use client"

/**
 * 财务管理总览页面
 * 展示核心财务指标和待处理事项
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
    AlertCircle,
    TrendingDown,
    TrendingUp,
    Users,
    Clock,
    Receipt,
    ArrowRight,
    Wallet,
} from "lucide-react"
import { getFinanceStats, getRecentPendingItems } from "@/lib/features/finance/actions"
import type { FinanceStats } from "@/lib/features/finance"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"

export function FinanceDashboardContent() {
    const [stats, setStats] = useState<FinanceStats | null>(null)
    const [pendingItems, setPendingItems] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function loadData() {
            try {
                const [statsResult, pendingResult] = await Promise.all([
                    getFinanceStats(),
                    getRecentPendingItems(10),
                ])

                if (!statsResult.ok) {
                    toast.error(statsResult.error || "获取统计数据失败")
                    return
                }

                if (!pendingResult.ok) {
                    toast.error(pendingResult.error || "获取待处理事项失败")
                    return
                }

                setStats(statsResult.data!)
                setPendingItems(pendingResult.data!)
            } catch (error) {
                console.error('[FinanceDashboard] 加载数据失败:', error)
                toast.error("加载数据失败")
            } finally {
                setLoading(false)
            }
        }

        loadData()
    }, [])

    if (loading) {
        return <FinanceDashboardSkeleton />
    }

    if (!stats) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="size-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">加载数据失败</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-6">
            {/* 页面标题 */}
            <div>
                <h1 className="text-3xl font-bold">财务总览</h1>
                <p className="text-muted-foreground mt-1">
                    快速掌握平台财务状况和待处理事项
                </p>
            </div>

            {/* 核心指标卡片 */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatsCard
                    title="待审核申请"
                    value={stats.pending_transactions_count}
                    icon={Clock}
                    variant="warning"
                    href="/dashboard/finance/transactions?status=pending"
                />
                <StatsCard
                    title="待结算订单"
                    value={stats.pending_settlements_count}
                    icon={Receipt}
                    variant="warning"
                    href="/dashboard/finance/settlements?status=pending"
                />
                <StatsCard
                    title="技师欠款总额"
                    value={formatCurrency(stats.total_therapist_debt)}
                    subtitle={`${stats.negative_balance_count} 位技师`}
                    icon={TrendingDown}
                    variant="danger"
                    href="/dashboard/finance/accounts?balance_status=negative"
                />
                <StatsCard
                    title="平台欠款总额"
                    value={formatCurrency(stats.total_platform_debt)}
                    subtitle={`${stats.positive_balance_count} 位技师`}
                    icon={TrendingUp}
                    variant="success"
                    href="/dashboard/finance/accounts?balance_status=positive"
                />
            </div>

            {/* 快捷入口 */}
            <Card>
                <CardHeader>
                    <CardTitle>快捷入口</CardTitle>
                    <CardDescription>快速访问常用功能</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                        <QuickLinkButton
                            href="/dashboard/finance/transactions?status=pending"
                            label="待审核申请"
                            count={stats.pending_transactions_count}
                        />
                        <QuickLinkButton
                            href="/dashboard/finance/settlements?status=pending"
                            label="待结算订单"
                            count={stats.pending_settlements_count}
                        />
                        <QuickLinkButton
                            href="/dashboard/finance/accounts?balance_status=negative"
                            label="负余额技师"
                            count={stats.negative_balance_count}
                        />
                        <QuickLinkButton
                            href="/dashboard/finance/accounts"
                            label="所有技师账户"
                            count={stats.total_therapists}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* 最近待处理事项 */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>最近待处理事项</CardTitle>
                            <CardDescription>最新的待审核申请和待结算订单</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {pendingItems && (pendingItems.pendingTransactions.length > 0 || pendingItems.pendingSettlements.length > 0) ? (
                        <div className="space-y-4">
                            {/* 待审核申请 */}
                            {pendingItems.pendingTransactions.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-medium mb-3">待审核申请</h3>
                                    <div className="space-y-2">
                                        {pendingItems.pendingTransactions.slice(0, 5).map((item: any) => (
                                            <PendingTransactionItem key={item.id} item={item} />
                                        ))}
                                    </div>
                                    {pendingItems.pendingTransactions.length > 5 && (
                                        <Link href="/dashboard/finance/transactions?status=pending">
                                            <Button variant="ghost" size="sm" className="w-full mt-2">
                                                查看全部 {pendingItems.pendingTransactions.length} 条申请
                                                <ArrowRight className="ml-2 size-4" />
                                            </Button>
                                        </Link>
                                    )}
                                </div>
                            )}

                            {/* 待结算订单 */}
                            {pendingItems.pendingSettlements.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-medium mb-3">待结算订单</h3>
                                    <div className="space-y-2">
                                        {pendingItems.pendingSettlements.slice(0, 5).map((item: any) => (
                                            <PendingSettlementItem key={item.id} item={item} />
                                        ))}
                                    </div>
                                    {pendingItems.pendingSettlements.length > 5 && (
                                        <Link href="/dashboard/finance/settlements?status=pending">
                                            <Button variant="ghost" size="sm" className="w-full mt-2">
                                                查看全部 {pendingItems.pendingSettlements.length} 条订单
                                                <ArrowRight className="ml-2 size-4" />
                                            </Button>
                                        </Link>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                            <Wallet className="size-12 mb-2" />
                            <p>暂无待处理事项</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

// ==================== 子组件 ====================

interface StatsCardProps {
    title: string
    value: string | number
    subtitle?: string
    icon: React.ElementType
    variant?: 'default' | 'warning' | 'danger' | 'success'
    href?: string
}

function StatsCard({ title, value, subtitle, icon: Icon, variant = 'default', href }: StatsCardProps) {
    const variantStyles = {
        default: 'text-foreground',
        warning: 'text-orange-600 dark:text-orange-400',
        danger: 'text-red-600 dark:text-red-400',
        success: 'text-green-600 dark:text-green-400',
    }

    const content = (
        <Card className={href ? 'cursor-pointer hover:bg-accent/50 transition-colors' : ''}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className={`text-2xl font-bold ${variantStyles[variant]}`}>
                    {value}
                </div>
                {subtitle && (
                    <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
                )}
            </CardContent>
        </Card>
    )

    return href ? <Link href={href}>{content}</Link> : content
}

interface QuickLinkButtonProps {
    href: string
    label: string
    count: number
}

function QuickLinkButton({ href, label, count }: QuickLinkButtonProps) {
    return (
        <Link href={href}>
            <Button variant="outline" className="w-full justify-between h-auto py-3">
                <span className="text-sm">{label}</span>
                <Badge variant="secondary">{count}</Badge>
            </Button>
        </Link>
    )
}

function PendingTransactionItem({ item }: { item: any }) {
    const typeLabels = {
        deposit: '定金',
        payment: '结账',
        withdrawal: '提现',
        adjustment: '调整',
    }

    return (
        <Link href={`/dashboard/finance/transactions/${item.id}`}>
            <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Badge variant="outline">{typeLabels[item.transaction_type as keyof typeof typeLabels]}</Badge>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                            {item.girls?.name} (#{item.girls?.girl_number})
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {formatCurrency(item.amount)}
                        </p>
                    </div>
                </div>
                <ArrowRight className="size-4 text-muted-foreground flex-shrink-0" />
            </div>
        </Link>
    )
}

function PendingSettlementItem({ item }: { item: any }) {
    return (
        <Link href={`/dashboard/finance/settlements/${item.id}`}>
            <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Badge variant="outline">{item.orders?.order_number}</Badge>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                            {item.girls?.name} (#{item.girls?.girl_number})
                        </p>
                        <p className="text-xs text-muted-foreground">
                            结算金额: {formatCurrency(item.settlement_amount)}
                        </p>
                    </div>
                </div>
                <ArrowRight className="size-4 text-muted-foreground flex-shrink-0" />
            </div>
        </Link>
    )
}

function FinanceDashboardSkeleton() {
    return (
        <div className="flex flex-col gap-6">
            <div>
                <Skeleton className="h-9 w-32" />
                <Skeleton className="h-5 w-64 mt-1" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <Card key={i}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="size-4 rounded" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-8 w-20" />
                            <Skeleton className="h-3 w-16 mt-1" />
                        </CardContent>
                    </Card>
                ))}
            </div>
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-4 w-32 mt-1" />
                </CardHeader>
                <CardContent>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                        {[...Array(4)].map((_, i) => (
                            <Skeleton key={i} className="h-12" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
