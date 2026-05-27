"use client"

import { useEffect, useState } from "react"
import { Calendar, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
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
import type { Order, OrderListParams, OrderStatus, PaginatedResponse } from "@/lib/features/orders"
import { getOrders } from "./actions"

const ACTIVE_ORDER_STATUSES: OrderStatus[] = ["confirmed", "en_route", "arrived", "in_service"]

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [filters, setFilters] = useState<OrderListParams>({
    page: 1,
    limit: 20,
    search: "",
    status: [],
    service_type: undefined,
    has_add_time: undefined,
    start_date: undefined,
    end_date: undefined,
    sort_by: "created_at",
    sort_order: "desc",
  })
  const [searchInput, setSearchInput] = useState("")
  const [timeRange, setTimeRange] = useState("all")
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [showDetailDrawer, setShowDetailDrawer] = useState(false)

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
          totalPages: data.totalPages,
        })
      } else {
        toast.error(result.error || "加载订单列表失败")
      }
    } catch (error) {
      console.error("加载订单列表失败:", error)
      toast.error("加载订单列表失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applyFilters = (nextFilters: OrderListParams) => {
    setFilters(nextFilters)
    loadOrders(nextFilters)
  }

  const handleSearch = () => {
    applyFilters({
      ...filters,
      search: searchInput.trim(),
      page: 1,
    })
  }

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      handleSearch()
    }
  }

  const handleServiceTypeFilter = (value: string) => {
    applyFilters({
      ...filters,
      service_type: value === "all" ? undefined : (value as "outcall" | "incall"),
      page: 1,
    })
  }

  const handleAddTimeFilter = (value: string) => {
    applyFilters({
      ...filters,
      has_add_time: value === "all" ? undefined : value === "yes",
      page: 1,
    })
  }

  const toggleStatus = (status: OrderStatus) => {
    const currentStatuses = filters.status || []
    const nextStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter((item) => item !== status)
      : [...currentStatuses, status]

    applyFilters({
      ...filters,
      status: nextStatuses,
      page: 1,
    })
  }

  const toggleActiveStatuses = () => {
    const currentStatuses = filters.status || []
    const hasAnyActive = ACTIVE_ORDER_STATUSES.some((status) => currentStatuses.includes(status))
    const nextStatuses = hasAnyActive
      ? currentStatuses.filter((status) => !ACTIVE_ORDER_STATUSES.includes(status))
      : [...currentStatuses.filter((status) => !ACTIVE_ORDER_STATUSES.includes(status)), ...ACTIVE_ORDER_STATUSES]

    applyFilters({
      ...filters,
      status: nextStatuses,
      page: 1,
    })
  }

  const handleTimeRangeFilter = (value: string) => {
    setTimeRange(value)
    let startDate: string | undefined
    let endDate: string | undefined

    const now = new Date()
    const thailandTime = new Date(now.getTime() + 7 * 60 * 60 * 1000)
    const year = thailandTime.getUTCFullYear()
    const month = thailandTime.getUTCMonth()
    const date = thailandTime.getUTCDate()
    const hours = thailandTime.getUTCHours()

    let todayStartThailand: Date
    if (hours < 6) {
      todayStartThailand = new Date(Date.UTC(year, month, date - 1, 6, 0, 0, 0))
    } else {
      todayStartThailand = new Date(Date.UTC(year, month, date, 6, 0, 0, 0))
    }

    const todayStart = new Date(todayStartThailand.getTime() - 7 * 60 * 60 * 1000)
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)

    switch (value) {
      case "today":
        startDate = todayStart.toISOString()
        break
      case "yesterday":
        startDate = yesterdayStart.toISOString()
        endDate = todayStart.toISOString()
        break
      case "week":
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        break
      case "month":
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        break
      default:
        startDate = undefined
        endDate = undefined
    }

    applyFilters({
      ...filters,
      start_date: startDate,
      end_date: endDate,
      page: 1,
    })
  }

  const handleResetFilters = () => {
    const nextFilters: OrderListParams = {
      page: 1,
      limit: 20,
      search: "",
      status: [],
      service_type: undefined,
      has_add_time: undefined,
      start_date: undefined,
      end_date: undefined,
      sort_by: "created_at",
      sort_order: "desc",
    }

    setSearchInput("")
    setTimeRange("all")
    applyFilters(nextFilters)
  }

  const handlePageChange = (newPage: number) => {
    applyFilters({
      ...filters,
      page: newPage,
    })
  }

  const handleViewDetail = (order: Order) => {
    setSelectedOrder(order)
    setShowDetailDrawer(true)
  }

  const handleRefresh = () => {
    loadOrders()
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:px-8 md:py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">订单管理</h1>
      </div>

      <OrderStatsCards />

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="flex-1">
                <Label htmlFor="order-search" className="sr-only">
                  搜索订单
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="order-search"
                      placeholder="搜索订单号、技师、联系人或电话"
                      value={searchInput}
                      onChange={(event) => setSearchInput(event.target.value)}
                      onKeyDown={handleSearchKeyDown}
                      className="pl-10"
                    />
                  </div>
                  <Button onClick={handleSearch}>搜索</Button>
                </div>
              </div>

              <div className="w-full md:w-40">
                <Select value={timeRange} onValueChange={handleTimeRangeFilter}>
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

              <div className="w-full md:w-36">
                <Select value={filters.service_type || "all"} onValueChange={handleServiceTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="订单类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部类型</SelectItem>
                    <SelectItem value="outcall">上门</SelectItem>
                    <SelectItem value="incall">到店</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button variant="outline" onClick={handleResetFilters}>
                重置
              </Button>
            </div>

            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <Label>状态筛选</Label>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="status-pending"
                      checked={filters.status?.includes("pending")}
                      onCheckedChange={() => toggleStatus("pending")}
                    />
                    <label htmlFor="status-pending" className="text-sm font-medium">
                      待确认
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="status-active"
                      checked={ACTIVE_ORDER_STATUSES.some((status) => filters.status?.includes(status))}
                      onCheckedChange={toggleActiveStatuses}
                    />
                    <label htmlFor="status-active" className="text-sm font-medium">
                      进行中
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="status-completed"
                      checked={filters.status?.includes("completed")}
                      onCheckedChange={() => toggleStatus("completed")}
                    />
                    <label htmlFor="status-completed" className="text-sm font-medium">
                      已完成
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="status-cancelled"
                      checked={filters.status?.includes("cancelled")}
                      onCheckedChange={() => toggleStatus("cancelled")}
                    />
                    <label htmlFor="status-cancelled" className="text-sm font-medium">
                      已取消
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-2 md:text-right">
                <Label>加钟筛选</Label>
                <RadioGroup
                  value={filters.has_add_time === true ? "yes" : filters.has_add_time === false ? "no" : "all"}
                  onValueChange={handleAddTimeFilter}
                  className="flex flex-wrap gap-4 md:justify-end"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="add-time-all" />
                    <Label htmlFor="add-time-all">全部</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="add-time-yes" />
                    <Label htmlFor="add-time-yes">有加钟</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="add-time-no" />
                    <Label htmlFor="add-time-no">无加钟</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>订单列表</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderTable orders={orders} loading={loading} onViewDetail={handleViewDetail} />

          {!loading && pagination.total > 0 && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                显示 {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} 条，共
                {pagination.total} 条
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
                <Button variant="outline" size="sm" disabled>
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

      <OrderDetailDrawer
        open={showDetailDrawer}
        onOpenChange={setShowDetailDrawer}
        order={selectedOrder}
        onRefresh={handleRefresh}
      />
    </div>
  )
}
