"use client"

import { useState } from "react"
import { Eye, AlertCircle } from "lucide-react"
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
import { CancellationDrawer } from "./CancellationDrawer"
import type { Order } from "@/lib/features/orders"
import {
  getOrderStatusText,
  getOrderStatusVariant,
  getGirlName,
  getServiceTitle,
  formatCurrency,
  formatRelativeTime
} from "@/lib/features/orders"

interface OrderTableProps {
  orders: Order[]
  loading?: boolean
  onViewDetail: (order: Order) => void
}

/**
 * 获取客户显示名称（优先使用地址快照中的联系人姓名）
 */
function getCustomerDisplayName(order: Order): string {
  // 优先使用地址快照中的联系人姓名
  const contactName = (order.address_snapshot as any)?.contact?.n
  if (contactName) return contactName

  // 其次使用用户元数据中的用户名
  if (order.user?.raw_user_meta_data?.username) {
    return order.user.raw_user_meta_data.username
  }

  // 最后使用邮箱前缀
  if (order.user?.email) {
    return order.user.email.split('@')[0]
  }

  return '-'
}

export function OrderTable({
  orders,
  loading = false,
  onViewDetail
}: OrderTableProps) {
  const [cancellationDrawerOpen, setCancellationDrawerOpen] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [selectedOrderNumber, setSelectedOrderNumber] = useState<string>("")

  const handleViewCancellation = (order: Order) => {
    setSelectedOrderId(order.id)
    setSelectedOrderNumber(order.order_number)
    setCancellationDrawerOpen(true)
  }

  return (
    <>
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>订单号</TableHead>
            <TableHead>技师</TableHead>
            <TableHead>客户</TableHead>
            <TableHead>服务</TableHead>
            <TableHead className="text-right">金额</TableHead>
            <TableHead>订单状态</TableHead>
            <TableHead>下单时间</TableHead>
            <TableHead className="w-[80px]">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={8} className="h-32 text-center">
                <LoadingSpinner size="lg" />
              </TableCell>
            </TableRow>
          ) : orders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="h-32 text-center">
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                  <div className="text-sm">暂无订单记录</div>
                  <div className="text-xs">调整筛选条件以查看更多订单</div>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                    {order.order_number}
                  </code>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={order.girl?.avatar_url || undefined} alt={getGirlName(order.girl)} />
                      <AvatarFallback className="text-xs">
                        {order.girl?.girl_number || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm">{getGirlName(order.girl)}</span>
                      <span className="text-xs text-muted-foreground">#{order.girl?.girl_number}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm">{getCustomerDisplayName(order)}</span>
                    {order.user?.email && (
                      <span className="text-xs text-muted-foreground">{order.user.email}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <div>{getServiceTitle(order.service_name)}</div>
                    <div className="text-xs text-muted-foreground">
                      {order.service_duration} 分钟
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(order.total_amount)}
                </TableCell>
                <TableCell>
                  <Badge variant={getOrderStatusVariant(order.status)}>
                    {getOrderStatusText(order.status)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <div className="text-sm">{formatRelativeTime(order.created_at)}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(order.created_at).toLocaleString('zh-CN', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewDetail(order)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {order.status === 'cancelled' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewCancellation(order)}
                        className="text-destructive hover:text-destructive"
                      >
                        <AlertCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>

    <CancellationDrawer
      open={cancellationDrawerOpen}
      onOpenChange={setCancellationDrawerOpen}
      orderId={selectedOrderId}
      orderNumber={selectedOrderNumber}
    />
    </>
  )
}
