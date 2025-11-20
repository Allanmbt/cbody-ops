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
import { Eye, Circle, MapPin, Clock, AlertTriangle } from "lucide-react"
import { formatRelativeTime } from "@/lib/features/orders"
import { TherapistMonitoringDrawer } from "./TherapistMonitoringDrawer"

interface MonitoringTherapistTableProps {
  therapists: any[]
  loading?: boolean
  onRefresh: () => void
}

/**
 * 获取状态显示
 */
function getStatusBadge(status: string) {
  switch (status) {
    case 'available':
      return (
        <Badge variant="outline" className="border-green-500 text-green-600 gap-1">
          <Circle className="h-2 w-2 fill-green-500" />
          在线
        </Badge>
      )
    case 'busy':
      return (
        <Badge variant="outline" className="border-orange-500 text-orange-600 gap-1">
          <Circle className="h-2 w-2 fill-orange-500" />
          忙碌
        </Badge>
      )
    case 'offline':
      return (
        <Badge variant="outline" className="border-gray-400 text-gray-600 gap-1">
          <Circle className="h-2 w-2 fill-gray-400" />
          离线
        </Badge>
      )
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

/**
 * 获取城市显示名称
 */
function getCityName(city: any): string {
  if (!city) return '-'
  // city.name 是 JSONB，包含 zh 字段
  if (city.name && typeof city.name === 'object' && city.name.zh) {
    return city.name.zh
  }
  return city.code || '-'
}

/**
 * 获取订单状态文本
 */
function getOrderStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    confirmed: '已确认',
    en_route: '在路上',
    arrived: '已到达',
    in_service: '服务中'
  }
  return statusMap[status] || status
}

/**
 * 检测是否有冷却
 */
function hasCooldown(therapist: any): boolean {
  if (!therapist.cooldown_until_at) return false
  return new Date(therapist.cooldown_until_at) > new Date()
}

function formatNextAvailableTime(nextTime?: string | null): string {
  if (!nextTime) return '-'

  const target = new Date(nextTime)
  if (isNaN(target.getTime())) return '-'

  const now = new Date()
  const diffMs = target.getTime() - now.getTime()

  const timeText = target.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })

  if (diffMs <= 0) {
    return `${timeText}（已可用）`
  }

  const minutes = Math.round(diffMs / 60000)

  if (minutes < 60) {
    return `${timeText}（${minutes}分钟后）`
  }

  const hours = Math.floor(minutes / 60)
  return `${timeText}（${hours}小时后）`
}

export function MonitoringTherapistTable({
  therapists,
  loading = false,
  onRefresh
}: MonitoringTherapistTableProps) {
  const [selectedTherapist, setSelectedTherapist] = useState<any | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const handleViewDetail = (therapist: any) => {
    setSelectedTherapist(therapist)
    setDrawerOpen(true)
  }

  return (
    <>
      <div className="rounded-md border-t">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px]">技师</TableHead>
              <TableHead className="w-[80px]">状态</TableHead>
              <TableHead className="w-[80px]">城市</TableHead>
              <TableHead className="w-[140px]">当前订单</TableHead>
              <TableHead className="w-[130px]">下次可用</TableHead>
              <TableHead className="w-[100px]">最后上线</TableHead>
              <TableHead className="w-[100px] text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <LoadingSpinner />
                </TableCell>
              </TableRow>
            ) : therapists.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-muted-foreground">暂无技师记录</p>
                    <p className="text-sm text-muted-foreground">调整筛选条件以查看更多技师</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              therapists.map((therapist) => {
                const isCooldown = hasCooldown(therapist)

                return (
                  <TableRow key={therapist.id} className={isCooldown ? 'bg-destructive/5' : ''}>
                    {/* 技师 */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={therapist.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {therapist.girl_number}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{therapist.name}</span>
                          <span className="text-xs text-muted-foreground">#{therapist.girl_number}</span>
                        </div>
                      </div>
                    </TableCell>

                    {/* 状态 */}
                    <TableCell>
                      {getStatusBadge(therapist.status)}
                      {isCooldown && (
                        <div className="mt-1">
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="h-2 w-2 mr-1" />
                            冷却中
                          </Badge>
                        </div>
                      )}
                    </TableCell>

                    {/* 城市 */}
                    <TableCell>
                      <span className="text-sm">{getCityName(therapist.city)}</span>
                    </TableCell>

                    {/* 当前订单 */}
                    <TableCell>
                      {therapist.current_order ? (
                        <div className="flex flex-col gap-0.5">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {therapist.current_order.order_number}
                          </code>
                          <span className="text-xs text-muted-foreground">
                            {getOrderStatusText(therapist.current_order.status)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    {/* 下次可用 */}
                    <TableCell>
                      {therapist.next_available_time ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span>{formatNextAvailableTime(therapist.next_available_time)}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    {/* 最后上线时间 */}
                    <TableCell>
                      {therapist.last_online_at ? (
                        <span className="text-sm">{formatRelativeTime(therapist.last_online_at)}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    {/* 操作 */}
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetail(therapist)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        详情
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* 技师详情抽屉 */}
      <TherapistMonitoringDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        therapist={selectedTherapist}
        onRefresh={onRefresh}
      />
    </>
  )
}
