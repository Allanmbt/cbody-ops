"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { LoadingSpinner } from "@/components/ui/loading"
import { Eye, AlertTriangle } from "lucide-react"
import type { Order, OrderStatus } from "@/lib/features/orders"
import {
  getOrderStatusText,
  getOrderStatusVariant,
  getGirlName,
  getServiceTitle,
  formatCurrency,
  formatRelativeTime
} from "@/lib/features/orders"
import { OrderMonitoringDrawer } from "./OrderMonitoringDrawer"

interface MonitoringOrderTableProps {
  orders: Order[]
  loading?: boolean
  onRefresh: () => void
}

/**
 * 获取客户显示名称
 */
function getCustomerName(order: Order): string {
  const contactName = (order.address_snapshot as any)?.contact?.n
  if (contactName) return contactName

  if (order.user?.raw_user_meta_data?.username) {
    return order.user.raw_user_meta_data.username
  }

  if (order.user?.email) {
    return order.user.email.split('@')[0]
  }

  return '-'
}

/**
 * 获取客户电话后4位
 */
function getCustomerPhoneLast4(order: Order): string {
  const phone = (order.address_snapshot as any)?.contact?.p
  if (phone && phone.length >= 4) {
    return `***${phone.slice(-4)}`
  }
  return ''
}

/**
 * 检测订单是否异常
 */
function detectAbnormal(order: Order): { isAbnormal: boolean; reason?: string } {
  const now = Date.now()
  const createdAt = new Date(order.created_at).getTime()

  // 待确认超时（超过10分钟）
  if (order.status === 'pending') {
    const minutesPassed = (now - createdAt) / (60 * 1000)
    if (minutesPassed > 10) {
      return { isAbnormal: true, reason: `确认超时 ${Math.floor(minutesPassed)} 分钟` }
    }
  }

  // 在路上超时（超过预计到达时间30分钟）
  if (order.status === 'en_route' && order.estimated_arrival_at) {
    const estimatedTime = new Date(order.estimated_arrival_at).getTime()
    const minutesLate = (now - estimatedTime) / (60 * 1000)
    if (minutesLate > 30) {
      return { isAbnormal: true, reason: `到达延迟 ${Math.floor(minutesLate)} 分钟` }
    }
  }

  // 服务超时（超过预期服务时长30分钟）
  if (order.status === 'in_service' && order.service_started_at) {
    const serviceStartTime = new Date(order.service_started_at).getTime()
    const expectedDuration = order.service_duration * 60 * 1000 // 转为毫秒
    const actualDuration = now - serviceStartTime
    const minutesOver = (actualDuration - expectedDuration) / (60 * 1000)
    if (minutesOver > 30) {
      return { isAbnormal: true, reason: `服务超时 ${Math.floor(minutesOver)} 分钟` }
    }
  }

  return { isAbnormal: false }
}

/**
 * 获取进度信息
 */
function getProgressInfo(order: Order): string {
  const { isAbnormal, reason } = detectAbnormal(order)

  switch (order.status) {
    case 'pending':
      if (isAbnormal) {
        return `⚠️ ${reason}`
      }
      return '等待确认'

    case 'confirmed':
      return '技师已确认'

    case 'en_route':
      if (order.estimated_arrival_at) {
        const eta = formatRelativeTime(order.estimated_arrival_at)
        if (isAbnormal) {
          return `⚠️ ${reason}`
        }
        return `预计到达 ${eta}`
      }
      return '在路上'

    case 'arrived':
      return '已到达现场'

    case 'in_service':
      if (order.service_started_at) {
        const startTime = new Date(order.service_started_at).getTime()
        const now = Date.now()
        const minutesPassed = Math.floor((now - startTime) / (60 * 1000))
        const totalMinutes = order.service_duration

        if (isAbnormal) {
          return `⚠️ ${reason}`
        }

        return `已服务 ${minutesPassed}/${totalMinutes} 分钟`
      }
      return '服务中'

    case 'completed':
      return '已完成'

    case 'cancelled':
      return '已取消'

    default:
      return '-'
  }
}

export function MonitoringOrderTable({
  orders,
  loading = false,
  onRefresh
}: MonitoringOrderTableProps) {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const handleViewDetail = (order: Order) => {
    setSelectedOrder(order)
    setDrawerOpen(true)
  }

  return (
    <>
      <div className="rounded-md border-t">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">订单号</TableHead>
              <TableHead className="w-[100px]">状态</TableHead>
              <TableHead className="w-[150px]">技师</TableHead>
              <TableHead className="w-[120px]">客户</TableHead>
              <TableHead className="w-[150px]">服务</TableHead>
              <TableHead className="w-[80px] text-right">金额</TableHead>
              <TableHead className="w-[100px]">下单时间</TableHead>
              <TableHead className="w-[180px]">进度信息</TableHead>
              <TableHead className="w-[100px] text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center">
                  <LoadingSpinner />
                </TableCell>
              </TableRow>
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-muted-foreground">暂无订单记录</p>
                    <p className="text-sm text-muted-foreground">调整筛选条件以查看更多订单</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => {
                const { isAbnormal } = detectAbnormal(order)

                return (
                  <TableRow key={order.id} className={isAbnormal ? 'bg-destructive/5' : ''}>
                    {/* 订单号 */}
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {order.order_number}
                      </code>
                      {isAbnormal && (
                        <AlertTriangle className="inline-block ml-1 h-3 w-3 text-destructive" />
                      )}
                    </TableCell>

                    {/* 状态 */}
                    <TableCell>
                      <Badge variant={getOrderStatusVariant(order.status)}>
                        {getOrderStatusText(order.status)}
                      </Badge>
                    </TableCell>

                    {/* 技师 */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={order.girl?.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {order.girl?.girl_number || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs">
                          #{order.girl?.girl_number} {getGirlName(order.girl)}
                        </span>
                      </div>
                    </TableCell>

                    {/* 客户 */}
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm">{getCustomerName(order)}</span>
                        {getCustomerPhoneLast4(order) && (
                          <span className="text-xs text-muted-foreground">
                            {getCustomerPhoneLast4(order)}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* 服务 */}
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm">{getServiceTitle(order.service_name)}</span>
                        <span className="text-xs text-muted-foreground">
                          {order.service_duration} 分钟
                        </span>
                      </div>
                    </TableCell>

                    {/* 金额 */}
                    <TableCell className="text-right font-medium">
                      {formatCurrency(order.total_amount)}
                    </TableCell>

                    {/* 下单时间 */}
                    <TableCell>
                      <span className="text-sm">{formatRelativeTime(order.created_at)}</span>
                    </TableCell>

                    {/* 进度信息 */}
                    <TableCell>
                      <span className={`text-sm ${isAbnormal ? 'text-destructive font-medium' : ''}`}>
                        {getProgressInfo(order)}
                      </span>
                    </TableCell>

                    {/* 操作 */}
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetail(order)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          详情
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* 订单详情抽屉 */}
      <OrderMonitoringDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        order={selectedOrder}
        onRefresh={onRefresh}
      />
    </>
  )
}
