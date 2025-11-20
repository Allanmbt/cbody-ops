"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { LoadingSpinner } from "@/components/ui/loading"
import { toast } from "sonner"
import { Search, RefreshCw, MessageSquare, Lock, TrendingUp } from "lucide-react"
import {
    getChatStats,
    getChatThreads,
    type ChatStats,
    type ChatThreadFilters
} from "@/app/dashboard/operations/chats/actions"
import { ChatThreadTable } from "./ChatThreadTable"

export function ChatMonitoringPage() {
    const [stats, setStats] = useState<ChatStats | null>(null)
    const [loadingStats, setLoadingStats] = useState(true)
    const [threads, setThreads] = useState<any[]>([])
    const [loadingThreads, setLoadingThreads] = useState(true)
    const [total, setTotal] = useState(0)
    const isInitialMount = useRef(true)

    // 筛选条件
    const [filters, setFilters] = useState<ChatThreadFilters>({
        search: '',
        thread_type: 'all',
        only_active: true,  // 默认显示活跃会话
        has_order: false,
        page: 1,
        limit: 50
    })

    // 加载统计数据
    const loadStats = async () => {
        setLoadingStats(true)
        const result = await getChatStats()
        if (result.ok && result.data) {
            setStats(result.data)
        } else {
            toast.error(result.error || "加载统计数据失败")
        }
        setLoadingStats(false)
    }

    // 加载会话列表
    const loadThreads = async () => {
        setLoadingThreads(true)
        const result = await getChatThreads(filters)
        if (result.ok && result.data) {
            setThreads(result.data.threads)
            setTotal(result.data.total)
        } else {
            toast.error(result.error || "加载会话列表失败")
        }
        setLoadingThreads(false)
    }

    // 初始化加载
    useEffect(() => {
        loadStats()
        loadThreads()
        isInitialMount.current = false
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // 筛选条件变化时重新加载
    useEffect(() => {
        if (isInitialMount.current) {
            return
        }
        loadThreads()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.search, filters.thread_type, filters.only_active, filters.has_order, filters.page])

    // 刷新数据
    const handleRefresh = () => {
        loadStats()
        loadThreads()
        toast.success("已刷新数据")
    }

    // 重置筛选
    const handleReset = () => {
        setFilters({
            search: '',
            thread_type: 'all',
            only_active: true,
            has_order: false,
            page: 1,
            limit: 50
        })
    }

    return (
        <div className="flex flex-col gap-6 p-4 md:px-8 md:py-6">
            {/* 页面标题 */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold">会话监管</h1>
                    <p className="text-sm text-muted-foreground mt-1">聊天记录查看</p>
                </div>
                <Button onClick={handleRefresh} variant="outline" size="sm" className="w-fit">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    刷新
                </Button>
            </div>

            {/* 统计卡片 */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
                {/* 活跃会话 */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">活跃会话</CardTitle>
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {loadingStats ? "-" : stats?.active || 0}
                            <span className="text-base font-normal text-muted-foreground ml-1">个</span>
                        </div>
                    </CardContent>
                </Card>

                {/* 今日新增 */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">今日新增</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {loadingStats ? "-" : stats?.today_new || 0}
                            <span className="text-base font-normal text-muted-foreground ml-1">个</span>
                        </div>
                    </CardContent>
                </Card>

                {/* 已锁定会话 */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">已锁定会话</CardTitle>
                        <Lock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {loadingStats ? "-" : stats?.locked || 0}
                            <span className="text-base font-normal text-muted-foreground ml-1">个</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* 筛选区域 */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col gap-4">
                        {/* 第一行：搜索和类型 */}
                        <div className="flex flex-col gap-4 sm:flex-row">
                            <div className="flex-1">
                                <Label htmlFor="search" className="sr-only">搜索</Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        id="search"
                                        placeholder="搜索参与者"
                                        value={filters.search}
                                        onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
                                        className="pl-9"
                                    />
                                </div>
                            </div>
                            <Select
                                value={filters.thread_type}
                                onValueChange={(value) => setFilters({ ...filters, thread_type: value as any, page: 1 })}
                            >
                                <SelectTrigger className="w-full sm:w-[180px]">
                                    <SelectValue placeholder="会话类型" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">全部类型</SelectItem>
                                    <SelectItem value="c2g">客户↔技师</SelectItem>
                                    <SelectItem value="s2c">客服↔客户</SelectItem>
                                    <SelectItem value="s2g">客服↔技师</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* 第二行：筛选选项 */}
                        <div className="flex flex-wrap gap-3">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="only-active"
                                    checked={filters.only_active}
                                    onCheckedChange={(checked) => setFilters({ ...filters, only_active: !!checked, page: 1 })}
                                />
                                <label htmlFor="only-active" className="text-sm font-medium">
                                    仅活跃（24小时内）
                                </label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="has-order"
                                    checked={filters.has_order}
                                    onCheckedChange={(checked) => setFilters({ ...filters, has_order: !!checked, page: 1 })}
                                />
                                <label htmlFor="has-order" className="text-sm font-medium">
                                    有订单
                                </label>
                            </div>
                            <Button variant="outline" size="sm" onClick={handleReset} className="ml-auto">
                                重置
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 会话列表 */}
            <Card>
                <CardHeader>
                    <CardTitle>会话列表</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <ChatThreadTable
                        threads={threads}
                        loading={loadingThreads}
                        onRefresh={loadThreads}
                    />
                </CardContent>
            </Card>

            {/* 分页 */}
            {total > 0 && (
                <div className="flex items-center justify-between px-2">
                    <div className="text-sm text-muted-foreground">
                        显示 {((filters.page || 1) - 1) * (filters.limit || 50) + 1} - {Math.min((filters.page || 1) * (filters.limit || 50), total)} 条，共 {total} 条
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setFilters({ ...filters, page: Math.max(1, (filters.page || 1) - 1) })}
                            disabled={(filters.page || 1) === 1}
                        >
                            上一页
                        </Button>
                        <div className="text-sm">第 {filters.page || 1} 页</div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setFilters({ ...filters, page: (filters.page || 1) + 1 })}
                            disabled={(filters.page || 1) * (filters.limit || 50) >= total}
                        >
                            下一页
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
