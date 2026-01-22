"use client"

import { useState, useEffect } from "react"
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
import { Search, RefreshCw, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import { getOrderStats, getMonitoringOrders, type OrderStats, type MonitoringOrderFilters } from "@/app/dashboard/operations/orders/actions"
import { MonitoringOrderTable } from "./MonitoringOrderTable"
import type { OrderStatus } from "@/lib/features/orders"

// ✅ 优化：接收服务端传来的初始数据
interface OrderMonitoringPageProps {
  initialStats: OrderStats | null
  initialOrders: any[]
  initialTotal: number
}

export function OrderMonitoringPage({ initialStats, initialOrders, initialTotal }: OrderMonitoringPageProps) {
  const [stats, setStats] = useState<OrderStats | null>(initialStats)
  const [loadingStats, setLoadingStats] = useState(false)
  const [orders, setOrders] = useState<any[]>(initialOrders)
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [total, setTotal] = useState(initialTotal)

  // 筛选条件
  const [filters, setFilters] = useState<MonitoringOrderFilters>({
    search: '',
    status: [],
    time_range: 'today',
    only_abnormal: false,
    page: 1,
    limit: 50
  })

  // 搜索输入框的临时值（未提交）
  const [searchInput, setSearchInput] = useState('')

  // 加载统计数据
  const loadStats = async () => {
    setLoadingStats(true)
    const result = await getOrderStats()
    if (result.ok) {
      setStats(result.data)
    } else {
      toast.error(result.error || "加载统计数据失败")
    }
    setLoadingStats(false)
  }

  // 加载订单列表
  const loadOrders = async () => {
    setLoadingOrders(true)
    const result = await getMonitoringOrders(filters)
    if (result.ok && result.data) {
      setOrders(result.data.orders)
      setTotal(result.data.total)
    } else {
      toast.error(result.error || "加载订单列表失败")
    }
    setLoadingOrders(false)
  }

  // ✅ 优化：移除初始化加载，数据已由服务端传入
  // 仅在筛选条件变化时重新加载
  useEffect(() => {
    // 跳过首次渲染（已有初始数据）
    if (filters.page === 1 && filters.time_range === 'today' && !filters.search && (!filters.status || filters.status.length === 0)) {
      return
    }
    loadOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  // ✅ 优化：刷新数据
  const handleRefresh = async () => {
    await Promise.all([loadStats(), loadOrders()])
    toast.success("已刷新数据")
  }

  // 重置筛选
  const handleReset = () => {
    setSearchInput('')
    setFilters({
      search: '',
      status: [],
      time_range: 'today',
      only_abnormal: false,
      page: 1,
      limit: 50
    })
  }

  // 处理搜索按钮点击
  const handleSearch = () => {
    const trimmedSearch = searchInput.trim()
    
    // 允许空搜索，直接更新筛选条件
    setFilters({ ...filters, search: trimmedSearch, page: 1 })
  }

  // 处理回车键搜索
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  // 状态筛选切换
  const toggleStatus = (status: OrderStatus) => {
    const currentStatuses = filters.status || []
    const newStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter(s => s !== status)
      : [...currentStatuses, status]
    setFilters({ ...filters, status: newStatuses, page: 1 })
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:px-8 md:py-6">
      {/* 页面标题 */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">订单监控</h1>
          <p className="text-sm text-muted-foreground mt-1">实时监控进行中的订单，快速发现异常</p>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm" className="w-fit">
          <RefreshCw className="mr-2 h-4 w-4" />
          刷新
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {/* 待确认 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">待确认</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingStats ? "-" : stats?.pending || 0}
              <span className="text-base font-normal text-muted-foreground ml-1">单</span>
            </div>
            {stats && stats.pending_overtime > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <Badge variant="destructive" className="text-xs">
                  {stats.pending_overtime}单超时
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 进行中 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">进行中</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingStats ? "-" : stats?.active || 0}
              <span className="text-base font-normal text-muted-foreground ml-1">单</span>
            </div>
            {stats && stats.active_abnormal > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <Badge variant="destructive" className="text-xs">
                  {stats.active_abnormal}单异常
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 今日完成 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">今日完成</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingStats ? "-" : stats?.today_completed || 0}
              <span className="text-base font-normal text-muted-foreground ml-1">单</span>
            </div>
          </CardContent>
        </Card>

        {/* 今日取消 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">今日取消</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingStats ? "-" : stats?.today_cancelled || 0}
              <span className="text-base font-normal text-muted-foreground ml-1">单</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 筛选区域 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            {/* 第一行：搜索和时间范围 */}
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex-1 flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="search" className="sr-only">搜索</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="搜索订单号/技师/客户"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      onKeyDown={handleSearchKeyDown}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Button onClick={handleSearch} variant="default" size="default">
                  搜索
                </Button>
              </div>
              <Select
                value={filters.time_range}
                onValueChange={(value: any) => setFilters({ ...filters, time_range: value, page: 1 })}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="时间范围" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">今日（6:00起）</SelectItem>
                  <SelectItem value="yesterday">昨日</SelectItem>
                  <SelectItem value="3days">近3天</SelectItem>
                  <SelectItem value="7days">近7天</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 第二行：状态筛选 */}
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="status-pending"
                  checked={filters.status?.includes('pending')}
                  onCheckedChange={() => toggleStatus('pending')}
                />
                <label htmlFor="status-pending" className="text-sm font-medium">待确认</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="status-confirmed"
                  checked={filters.status?.includes('confirmed') || filters.status?.includes('en_route') || filters.status?.includes('arrived') || filters.status?.includes('in_service')}
                  onCheckedChange={() => {
                    const hasAnyActive = filters.status?.some(s => ['confirmed', 'en_route', 'arrived', 'in_service'].includes(s))
                    const newStatuses = hasAnyActive
                      ? (filters.status || []).filter(s => !['confirmed', 'en_route', 'arrived', 'in_service'].includes(s))
                      : [...(filters.status || []), 'confirmed', 'en_route', 'arrived', 'in_service']
                    setFilters({ ...filters, status: newStatuses as OrderStatus[], page: 1 })
                  }}
                />
                <label htmlFor="status-confirmed" className="text-sm font-medium">进行中</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="status-completed"
                  checked={filters.status?.includes('completed')}
                  onCheckedChange={() => toggleStatus('completed')}
                />
                <label htmlFor="status-completed" className="text-sm font-medium">已完成</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="status-cancelled"
                  checked={filters.status?.includes('cancelled')}
                  onCheckedChange={() => toggleStatus('cancelled')}
                />
                <label htmlFor="status-cancelled" className="text-sm font-medium">已取消</label>
              </div>
              <div className="flex items-center space-x-2 ml-auto">
                <Checkbox
                  id="only-abnormal"
                  checked={filters.only_abnormal}
                  onCheckedChange={(checked) => setFilters({ ...filters, only_abnormal: !!checked, page: 1 })}
                />
                <label htmlFor="only-abnormal" className="text-sm font-medium">仅异常订单</label>
              </div>
              <Button variant="outline" size="sm" onClick={handleReset}>
                重置
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 订单列表 */}
      <Card>
        <CardHeader>
          <CardTitle>订单列表</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <MonitoringOrderTable
            orders={orders}
            loading={loadingOrders}
            onRefresh={loadOrders}
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
