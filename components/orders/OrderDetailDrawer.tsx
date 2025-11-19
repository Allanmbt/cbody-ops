"use client"

import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import type { Order } from "@/lib/features/orders"
import {
  getOrderStatusText,
  getOrderStatusVariant,
  getGirlName,
  getServiceTitle,
  formatCurrency
} from "@/lib/features/orders"

interface OrderDetailDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: Order | null
}

export function OrderDetailDrawer({
  open,
  onOpenChange,
  order
}: OrderDetailDrawerProps) {
  if (!order) return null

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const travelFee = Number(order.travel_fee ?? 0)
  const extraFee = Number(order.extra_fee ?? 0)
  const discountAmount = Number(order.discount_amount ?? 0)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto w-full sm:max-w-2xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-xl">订单详情</SheetTitle>
          <SheetDescription className="text-base">
            订单号: <code className="bg-muted px-2 py-0.5 rounded text-sm">{order.order_number}</code>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-6 px-4 pb-6 sm:mt-6 sm:space-y-8 sm:px-6">
          {/* 订单状态 */}
          <div>
            <h3 className="text-sm font-semibold mb-3">订单状态</h3>
            <Badge variant={getOrderStatusVariant(order.status)}>
              {getOrderStatusText(order.status)}
            </Badge>
          </div>

          <Separator />

          {/* 服务信息 */}
          <div>
            <h3 className="text-sm font-semibold mb-3">服务信息</h3>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">服务项目</dt>
                <dd className="font-medium">{getServiceTitle(order.service_name)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">服务时长</dt>
                <dd className="font-medium">{order.service_duration} 分钟</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">技师</dt>
                <dd className="font-medium">
                  #{order.girl?.girl_number} {getGirlName(order.girl)}
                </dd>
              </div>
            </dl>
          </div>

          <Separator />

          {/* 客户信息 */}
          <div>
            <h3 className="text-sm font-semibold mb-3">客户信息</h3>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">联系人</dt>
                <dd className="font-medium">{(order.address_snapshot as any)?.contact?.n || order.user?.raw_user_meta_data?.username || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">联系电话</dt>
                <dd className="font-medium">{(order.address_snapshot as any)?.contact?.p || order.user?.raw_user_meta_data?.phone || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">邮箱</dt>
                <dd className="font-medium break-all">{order.user?.email || '-'}</dd>
              </div>
            </dl>
          </div>

          <Separator />

          {/* 时间信息 */}
          <div>
            <h3 className="text-sm font-semibold mb-3">时间信息</h3>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">下单时间</dt>
                <dd className="font-medium">{formatDateTime(order.created_at)}</dd>
              </div>
              {order.scheduled_start_at && (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">预约时间</dt>
                  <dd className="font-medium">{formatDateTime(order.scheduled_start_at)}</dd>
                </div>
              )}
              {order.service_started_at && (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">开始服务</dt>
                  <dd className="font-semibold text-primary">{formatDateTime(order.service_started_at)}</dd>
                </div>
              )}
              {order.estimated_arrival_at && (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">预计到达</dt>
                  <dd className="font-medium">{formatDateTime(order.estimated_arrival_at)}</dd>
                </div>
              )}
              {order.completed_at && (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">完成时间</dt>
                  <dd className="font-medium">{formatDateTime(order.completed_at)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">更新时间</dt>
                <dd className="font-medium">{formatDateTime(order.updated_at)}</dd>
              </div>
            </dl>
          </div>

          <Separator />

          {/* 费用明细 */}
          <div>
            <h3 className="text-sm font-semibold mb-3">费用明细</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">服务费</dt>
                <dd className="font-medium">{formatCurrency(order.service_fee || order.service_price)}</dd>
              </div>
              {travelFee > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">路程费</dt>
                  <dd className="font-medium">{formatCurrency(travelFee)}</dd>
                </div>
              )}
              {extraFee > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">额外费用</dt>
                  <dd className="font-medium">{formatCurrency(extraFee)}</dd>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">优惠金额</dt>
                  <dd className="font-medium text-green-600">-{formatCurrency(discountAmount)}</dd>
                </div>
              )}
              <Separator className="my-2" />
              <div className="flex justify-between">
                <dt className="font-semibold text-base">订单总额</dt>
                <dd className="font-bold text-lg text-primary">{formatCurrency(order.total_amount)}</dd>
              </div>
            </dl>
          </div>

          {/* 地点信息 */}
          {order.address_snapshot && Object.keys(order.address_snapshot).length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold mb-3">地点信息</h3>
                <dl className="space-y-2.5 text-sm">
                  {(order.address_snapshot as any).name && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground shrink-0">地点名称</dt>
                      <dd className="font-medium text-right break-words">{(order.address_snapshot as any).name}</dd>
                    </div>
                  )}
                  {(order.address_snapshot as any).type && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">地点类型</dt>
                      <dd className="font-medium capitalize">{(order.address_snapshot as any).type.replace('_', ' ')}</dd>
                    </div>
                  )}
                  {(order.address_snapshot as any).addr && (
                    <div>
                      <dt className="text-muted-foreground mb-1.5">详细地址</dt>
                      <dd className="font-medium break-words leading-relaxed">{(order.address_snapshot as any).addr}</dd>
                    </div>
                  )}
                  {(order.address_snapshot as any).note && (
                    <div>
                      <dt className="text-muted-foreground mb-1.5">地址备注</dt>
                      <dd className="font-medium text-muted-foreground break-words leading-relaxed">{(order.address_snapshot as any).note}</dd>
                    </div>
                  )}
                  {order.distance && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">距离</dt>
                      <dd className="font-medium">{order.distance.toFixed(2)} 公里</dd>
                    </div>
                  )}
                  {(order.address_snapshot as any).lat && (order.address_snapshot as any).lng && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground shrink-0">坐标</dt>
                      <dd className="font-medium text-xs break-all text-right">
                        {(order.address_snapshot as any).lat.toFixed(6)}, {(order.address_snapshot as any).lng.toFixed(6)}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
