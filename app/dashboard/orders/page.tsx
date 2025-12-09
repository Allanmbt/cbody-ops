"use client"

import { useState, useEffect } from "react"
import { Search, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { OrderTable } from "@/components/orders/OrderTable"
import { OrderDetailDrawer } from "@/components/orders/OrderDetailDrawer"
import { OrderStatsCards } from "@/components/orders/OrderStatsCards"
import type { Order, OrderListParams, PaginatedResponse, OrderStatus } from "@/lib/features/orders"
import { getOrders } from "./actions"

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })

  // 筛选状态
  const [filters, setFilters] = useState<OrderListParams>({
    page: 1,
    limit: 20,
    search: '',
    status: undefined,
    start_date: undefined,
    end_date: undefined,
    sort_by: 'created_at',
    sort_order: 'desc'
  })

  // 详情对话框状态
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [showDetailDrawer, setShowDetailDrawer] = useState(false)

  // 加载订单列表
  const loadOrders = async (params?: OrderListParams) => {
    setLoading(true)
    try {
      const queryParams = params || filters
      const result = await getOrders(queryParams)
      if (result.ok && result.data) {
        const data = result.data as PaginatedResponse<Order>
        setOrders(data.data)
        setPagination({
          page: data.page,
          limit: data.limit,
          total: data.total,
          totalPages: data.totalPages
        })
      } else {
        toast.error(result.error || '加载订单列表失败')
      }
    } catch (error) {
      console.error('加载订单失败:', error)
      toast.error('加载订单列表失败')
    } finally {
      setLoading(false)
    }
  }

  // 初始化数据
  useEffect(() => {
    loadOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 搜索处理
  const handleSearch = (value: string) => {
    const newFilters = { ...filters, search: value, page: 1 }
    setFilters(newFilters)
    loadOrders(newFilters)
  }

  // 订单状态筛选
  const handleStatusFilter = (value: string) => {
    const newFilters = {
      ...filters,
      status: value === 'all' ? undefined : (value as OrderStatus),
      page: 1
    }
    setFilters(newFilters)
    loadOrders(newFilters)
  }

  // 时间范围筛选（泰国时区，6点为起点）
  const handleTimeRangeFilter = (value: string) => {
    let start_date: string | undefined
    let end_date: string | undefined

    // 🔧 使用泰国时区(Asia/Bangkok, UTC+7),以早晨6点为分界点
    const nowBKK = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))

    // 计算"今天"的时间范围:今天6:00 到 明天6:00(泰国时区)
    const todayStart = new Date(nowBKK)
    todayStart.setHours(6, 0, 0, 0)

    const yesterdayStart = new Date(todayStart)
    yesterdayStart.setDate(yesterdayStart.getDate() - 1)

    // 如果当前时间小于今天6点,说明还在"昨天"
    if (nowBKK.getHours() < 6) {
      todayStart.setDate(todayStart.getDate() - 1)
      yesterdayStart.setDate(yesterdayStart.getDate() - 1)
    }

    switch (value) {
      case 'today':
        // 今日:从今天6点开始
        start_date = todayStart.toISOString()
        break
      case 'yesterday':
        // 昨日:昨天6点到今天6点
        start_date = yesterdayStart.toISOString()
        end_date = todayStart.toISOString()
        break
      case 'week':
        start_date = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        break
      case 'month':
        start_date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        break
      case 'all':
      default:
        start_date = undefined
        end_date = undefined
    }

    const newFilters = { ...filters, start_date, end_date, page: 1 }
    setFilters(newFilters)
    loadOrders(newFilters)
  }

  // 重置筛选
  const handleResetFilters = () => {
    const newFilters: OrderListParams = {
      page: 1,
      limit: 20,
      search: '',
      status: undefined,
      start_date: undefined,
      end_date: undefined,
      sort_by: 'created_at',
      sort_order: 'desc'
    }
    setFilters(newFilters)
    loadOrders(newFilters)
  }

  // 分页处理
  const handlePageChange = (newPage: number) => {
    const newFilters = { ...filters, page: newPage }
    setFilters(newFilters)
    loadOrders(newFilters)
  }

  // 查看详情
  const handleViewDetail = (order: Order) => {
    setSelectedOrder(order)
    setShowDetailDrawer(true)
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:px-8 md:py-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">订单管理</h1>
      </div>

      {/* 统计卡片 */}
      <OrderStatsCards />

      {/* 筛选区域 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            {/* 第一行：搜索和快捷筛选 */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              {/* 搜索 */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="搜索订单号或技师..."
                    value={filters.search || ''}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* 时间范围 */}
              <div className="w-full md:w-40">
                <Select defaultValue="all" onValueChange={handleTimeRangeFilter}>
                  <SelectTrigger>
                    <Calendar className="mr-2 h-4 w-4" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部时间</SelectItem>
                    <SelectItem value="today">今日（6:00起）</SelectItem>
                    <SelectItem value="yesterday">昨日</SelectItem>
                    <SelectItem value="week">近7天</SelectItem>
                    <SelectItem value="month">近30天</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 订单状态 */}
              <div className="w-full md:w-40">
                <Select defaultValue="all" onValueChange={handleStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="订单状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="pending">待确认</SelectItem>
                    <SelectItem value="confirmed">已确认</SelectItem>
                    <SelectItem value="in_service">服务中</SelectItem>
                    <SelectItem value="completed">已完成</SelectItem>
                    <SelectItem value="cancelled">已取消</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 重置按钮 */}
              <Button variant="outline" onClick={handleResetFilters}>
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
        <CardContent>
          <OrderTable
            orders={orders}
            loading={loading}
            onViewDetail={handleViewDetail}
          />

          {/* 分页 - 统一规范 */}
          {!loading && pagination.total > 0 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                显示 {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} 条，共 {pagination.total} 条
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                >
                  第 {pagination.page} 页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 订单详情抽屉 */}
      <OrderDetailDrawer
        open={showDetailDrawer}
        onOpenChange={setShowDetailDrawer}
        order={selectedOrder}
      />
    </div>
  )
}
