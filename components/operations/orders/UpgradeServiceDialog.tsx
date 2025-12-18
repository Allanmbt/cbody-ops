"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { LoadingSpinner } from "@/components/ui/loading"
import { toast } from "sonner"
import { ArrowUp, Clock, DollarSign } from "lucide-react"
import { getUpgradableServices, upgradeOrderService } from "@/app/dashboard/operations/orders/actions"
import type { Order } from "@/lib/features/orders"
import { formatCurrency, getServiceTitle } from "@/lib/features/orders"

interface UpgradeServiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: Order | null
  onSuccess: () => void
}

export function UpgradeServiceDialog({
  open,
  onOpenChange,
  order,
  onSuccess
}: UpgradeServiceDialogProps) {
  const [loading, setLoading] = useState(false)
  const [upgrading, setUpgrading] = useState(false)
  const [services, setServices] = useState<any[]>([])
  const [selectedServiceDurationId, setSelectedServiceDurationId] = useState<number | null>(null)

  // 加载可升级服务列表
  useEffect(() => {
    if (open && order) {
      loadUpgradableServices()
    } else {
      // 重置状态
      setServices([])
      setSelectedServiceDurationId(null)
    }
  }, [open, order])

  const loadUpgradableServices = async () => {
    if (!order) return

    setLoading(true)
    const result = await getUpgradableServices(order.id)

    if (result.ok) {
      setServices(result.data)
      // 默认选中第一个
      if (result.data.length > 0) {
        setSelectedServiceDurationId(result.data[0].service_duration_id)
      }
    } else {
      toast.error(result.error || "获取可升级服务失败")
      onOpenChange(false)
    }
    setLoading(false)
  }

  const handleUpgrade = async () => {
    if (!order || !selectedServiceDurationId) {
      toast.error("请选择要升级的服务")
      return
    }

    setUpgrading(true)
    const result = await upgradeOrderService(order.id, selectedServiceDurationId)

    if (result.ok) {
      toast.success(`升级成功！订单金额已更新为 ${formatCurrency(result.data.new_total)}`)
      onSuccess()
      onOpenChange(false)
    } else {
      toast.error(result.error || "升级服务失败")
    }
    setUpgrading(false)
  }

  if (!order) return null

  const selectedService = services.find(s => s.service_duration_id === selectedServiceDurationId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUp className="h-5 w-5" />
            升级服务
          </DialogTitle>
          <DialogDescription>
            为订单 <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{order.order_number}</code> 选择要升级的服务
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : services.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            暂无可升级的服务选项
          </div>
        ) : (
          <div className="space-y-4">
            {/* 当前服务信息 */}
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <div className="text-sm font-medium">当前服务</div>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-sm">{getServiceTitle(order.service_name)}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {order.service_duration} 分钟
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">{formatCurrency(order.service_price)}</div>
                  <div className="text-xs text-muted-foreground">服务费</div>
                </div>
              </div>
            </div>

            {/* 可升级服务列表 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">选择升级后的服务</Label>
              <RadioGroup
                value={selectedServiceDurationId?.toString()}
                onValueChange={(value) => setSelectedServiceDurationId(Number(value))}
              >
                {services.map((service) => {
                  const priceDiff = service.price - order.service_price
                  const durationDiff = service.duration_minutes - order.service_duration
                  const isSameService = service.service_id === order.service_id
                  const serviceName = getServiceTitle(service.service_name)

                  return (
                    <div
                      key={service.service_duration_id}
                      className="flex items-center space-x-3 border rounded-lg p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => setSelectedServiceDurationId(service.service_duration_id)}
                    >
                      <RadioGroupItem
                        value={service.service_duration_id.toString()}
                        id={`service-${service.service_duration_id}`}
                      />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <Label
                            htmlFor={`service-${service.service_duration_id}`}
                            className="text-sm font-medium cursor-pointer flex items-center gap-2"
                          >
                            {!isSameService && (
                              <Badge variant="secondary" className="text-xs">
                                {serviceName}
                              </Badge>
                            )}
                            {service.duration_minutes} 分钟
                          </Label>
                          <div className="text-sm font-medium">
                            {formatCurrency(service.price)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {!isSameService && (
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                              更换服务
                            </Badge>
                          )}
                          {durationDiff > 0 && (
                            <Badge variant="outline" className="text-xs">
                              +{durationDiff}分钟
                            </Badge>
                          )}
                          {durationDiff < 0 && (
                            <Badge variant="outline" className="text-xs text-orange-600">
                              {durationDiff}分钟
                            </Badge>
                          )}
                          {priceDiff > 0 && (
                            <Badge variant="outline" className="text-xs">
                              +{formatCurrency(priceDiff)}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </RadioGroup>
            </div>

            {/* 升级后总金额预览 */}
            {selectedService && (
              <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-sm font-medium">升级后订单总金额</div>
                    <div className="text-xs text-muted-foreground">
                      原价 {formatCurrency(order.total_amount)} + 差价 {formatCurrency(selectedService.price - order.service_price)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">
                      {formatCurrency(order.total_amount + (selectedService.price - order.service_price))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={upgrading}
            className="w-full sm:w-auto"
          >
            取消
          </Button>
          <Button
            onClick={handleUpgrade}
            disabled={loading || upgrading || !selectedServiceDurationId}
            className="w-full sm:w-auto"
          >
            {upgrading ? (
              <>
                <LoadingSpinner className="mr-2 h-4 w-4" />
                升级中...
              </>
            ) : (
              <>
                <ArrowUp className="mr-2 h-4 w-4" />
                确认升级
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
