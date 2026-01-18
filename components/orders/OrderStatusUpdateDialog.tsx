"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { LoadingSpinner } from "@/components/ui/loading"
import { AlertTriangle, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { updateOrderStatus } from "@/app/dashboard/orders/actions"
import type { Order, OrderStatus } from "@/lib/features/orders"
import { getOrderStatusText } from "@/lib/features/orders"

interface OrderStatusUpdateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: Order | null
  onSuccess?: () => void
}

// 状态流转规则
const statusFlow: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['en_route', 'cancelled'],
  en_route: ['arrived', 'cancelled'],
  arrived: ['in_service', 'cancelled'],
  in_service: ['completed', 'cancelled'],
  completed: [],
  cancelled: []
}

export function OrderStatusUpdateDialog({
  open,
  onOpenChange,
  order,
  onSuccess
}: OrderStatusUpdateDialogProps) {
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | ''>('')
  const [updating, setUpdating] = useState(false)

  if (!order) return null

  const currentStatus = order.status as OrderStatus
  const allowedStatuses = statusFlow[currentStatus] || []

  // 不允许修改已完成和已取消的订单
  const canUpdate = currentStatus !== 'completed' && currentStatus !== 'cancelled'

  const handleUpdate = async () => {
    if (!selectedStatus) {
      toast.error('请选择新状态')
      return
    }

    if (!confirm(`确定要将订单状态从"${getOrderStatusText(currentStatus)}"修改为"${getOrderStatusText(selectedStatus)}"吗？`)) {
      return
    }

    setUpdating(true)
    try {
      const result = await updateOrderStatus(order.id, selectedStatus)
      if (result.ok) {
        toast.success('订单状态更新成功')
        onOpenChange(false)
        setSelectedStatus('')
        if (onSuccess) {
          onSuccess()
        }
      } else {
        toast.error(result.error || '更新订单状态失败')
      }
    } catch (error) {
      console.error('更新订单状态失败:', error)
      toast.error('更新订单状态失败')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>修改订单状态</DialogTitle>
          <DialogDescription>
            订单号: <code className="bg-muted px-2 py-0.5 rounded text-sm">{order.order_number}</code>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 当前状态 */}
          <div className="space-y-2">
            <Label>当前状态</Label>
            <div className="p-3 border rounded-md bg-muted/50">
              <span className="font-medium">{getOrderStatusText(currentStatus)}</span>
            </div>
          </div>

          {/* 新状态选择 */}
          {canUpdate && allowedStatuses.length > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="new-status">新状态</Label>
              <Select
                value={selectedStatus}
                onValueChange={(value) => setSelectedStatus(value as OrderStatus)}
              >
                <SelectTrigger id="new-status">
                  <SelectValue placeholder="请选择新状态" />
                </SelectTrigger>
                <SelectContent>
                  {allowedStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {getOrderStatusText(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {currentStatus === 'completed' && '已完成的订单不能修改状态'}
                {currentStatus === 'cancelled' && '已取消的订单不能修改状态'}
                {currentStatus !== 'completed' && currentStatus !== 'cancelled' && allowedStatuses.length === 0 && '当前状态无可用的下一步状态'}
              </AlertDescription>
            </Alert>
          )}

          {/* 状态流转说明 */}
          {canUpdate && allowedStatuses.length > 0 && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <div className="text-sm">
                  <strong>状态流转规则：</strong>
                  <ul className="mt-2 space-y-1 list-disc list-inside">
                    <li>已确认 → 在路上 → 已到达 → 服务中</li>
                    <li>除已完成和已取消外，其他状态都可以改为已取消</li>
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false)
              setSelectedStatus('')
            }}
            disabled={updating}
          >
            取消
          </Button>
          {canUpdate && allowedStatuses.length > 0 && (
            <Button
              onClick={handleUpdate}
              disabled={!selectedStatus || updating}
            >
              {updating ? (
                <>
                  <LoadingSpinner className="mr-2" />
                  更新中...
                </>
              ) : (
                '确认更新'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
