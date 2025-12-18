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
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { Order } from "@/lib/features/orders"
import {
  getOrderStatusText,
  getOrderStatusVariant,
  getGirlName,
  getServiceTitle,
  formatCurrency
} from "@/lib/features/orders"
import { MapPin, Clock, User, Phone, Copy, Check, ArrowUp } from "lucide-react"
import { toast } from "sonner"
import { useState } from "react"
import { UpgradeServiceDialog } from "./UpgradeServiceDialog"

interface OrderMonitoringDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: Order | null
  onRefresh: () => void
}

export function OrderMonitoringDrawer({
  open,
  onOpenChange,
  order,
  onRefresh
}: OrderMonitoringDrawerProps) {
  const [copiedUserId, setCopiedUserId] = useState(false)
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false)

  if (!order) return null

  // 判断订单是否可以升级服务（未完成且未取消）
  const canUpgrade = order.status !== 'completed' && order.status !== 'cancelled'

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

  const handleCopyUserId = async () => {
    if (!order.user_id) return

    try {
      await navigator.clipboard.writeText(order.user_id)
      setCopiedUserId(true)
      toast.success("用户ID已复制")
      setTimeout(() => setCopiedUserId(false), 2000)
    } catch (error) {
      toast.error("复制失败")
    }
  }

  const contactName = (order.address_snapshot as any)?.contact?.n
  const contactPhone = (order.address_snapshot as any)?.contact?.p

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
            <Badge variant={getOrderStatusVariant(order.status)} className="text-base px-3 py-1">
              {getOrderStatusText(order.status)}
            </Badge>
          </div>

          <Separator />

          {/* 技师信息 */}
          <div>
            <h3 className="text-sm font-semibold mb-3">技师信息</h3>
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={order.girl?.avatar_url || undefined} />
                <AvatarFallback>{order.girl?.girl_number || '?'}</AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">{getGirlName(order.girl)}</div>
                <div className="text-sm text-muted-foreground">工号：#{order.girl?.girl_number}</div>
              </div>
            </div>
          </div>

          <Separator />

          {/* 客户信息 */}
          <div>
            <h3 className="text-sm font-semibold mb-3">客户信息</h3>
            <dl className="space-y-2.5 text-sm">
              {order.user_id && (
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <dt className="text-muted-foreground shrink-0">用户ID:</dt>
                  <dd className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-xs bg-muted px-2 py-1 rounded break-all">
                        {order.user_id}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 shrink-0"
                        onClick={handleCopyUserId}
                      >
                        {copiedUserId ? (
                          <Check className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </dd>
                </div>
              )}
              {contactName && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <dt className="text-muted-foreground">联系人:</dt>
                  <dd className="font-medium">{contactName}</dd>
                </div>
              )}
              {contactPhone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <dt className="text-muted-foreground">联系电话:</dt>
                  <dd className="font-medium">{contactPhone}</dd>
                </div>
              )}
            </dl>
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
                <dt className="text-muted-foreground">预约模式</dt>
                <dd className="font-medium">
                  {order.booking_mode === 'now' ? '越快越好' : '指定时间段'}
                </dd>
              </div>
            </dl>
          </div>

          <Separator />

          {/* 时间信息 */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              时间信息
            </h3>
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
              {order.estimated_arrival_at && (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">预计到达</dt>
                  <dd className="font-medium">{formatDateTime(order.estimated_arrival_at)}</dd>
                </div>
              )}
              {order.eta_minutes && (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">预计路程</dt>
                  <dd className="font-medium">{order.eta_minutes} 分钟</dd>
                </div>
              )}
              {order.service_started_at && (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">开始服务</dt>
                  <dd className="font-semibold text-primary">{formatDateTime(order.service_started_at)}</dd>
                </div>
              )}
              {order.completed_at && (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">完成时间</dt>
                  <dd className="font-medium">{formatDateTime(order.completed_at)}</dd>
                </div>
              )}
            </dl>
          </div>

          <Separator />

          {/* 费用信息 */}
          <div>
            <h3 className="text-sm font-semibold mb-3">费用明细</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">服务费</dt>
                <dd className="font-medium">{formatCurrency(order.service_fee || order.service_price)}</dd>
              </div>
              {order.travel_fee > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">路程费</dt>
                  <dd className="font-medium">{formatCurrency(order.travel_fee)}</dd>
                </div>
              )}
              {order.extra_fee > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">额外费用</dt>
                  <dd className="font-medium">{formatCurrency(order.extra_fee)}</dd>
                </div>
              )}
              {order.discount_amount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">优惠金额</dt>
                  <dd className="font-medium text-green-600">-{formatCurrency(order.discount_amount)}</dd>
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
          {(order.address_snapshot as any)?.addr && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  地点信息
                </h3>
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
                  <div>
                    <dt className="text-muted-foreground mb-1.5">详细地址</dt>
                    <dd className="font-medium break-words leading-relaxed">{(order.address_snapshot as any).addr}</dd>
                  </div>
                  {order.distance && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">距离</dt>
                      <dd className="font-medium">{order.distance.toFixed(2)} 公里</dd>
                    </div>
                  )}
                </dl>
              </div>
            </>
          )}

          {/* 操作按钮区域 */}
          <div className="flex flex-col gap-2 pt-4 sm:flex-row">
            <Button
              variant="outline"
              className="flex-1 order-2 sm:order-1"
              onClick={() => onOpenChange(false)}
            >
              关闭
            </Button>
            {canUpgrade && (
              <Button
                variant="secondary"
                className="flex-1 order-1 sm:order-2"
                onClick={() => setUpgradeDialogOpen(true)}
              >
                <ArrowUp className="mr-2 h-4 w-4" />
                升级服务
              </Button>
            )}
            <Button
              variant="default"
              className="flex-1 order-1 sm:order-3"
            >
              客服介入
            </Button>
          </div>
        </div>
      </SheetContent>

      {/* 升级服务对话框 */}
      <UpgradeServiceDialog
        open={upgradeDialogOpen}
        onOpenChange={setUpgradeDialogOpen}
        order={order}
        onSuccess={() => {
          onRefresh()
        }}
      />
    </Sheet>
  )
}
