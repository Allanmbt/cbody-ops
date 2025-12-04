"use client"

import { useState, useEffect } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Circle, MapPin, Clock, AlertTriangle, Ban, CheckCircle } from "lucide-react"
import { toast } from "sonner"
import {
  getTherapistWorkStats,
  setTherapistCooldown,
  cancelTherapistCooldown,
  updateTherapistStatus,
  type TherapistWorkStats
} from "@/app/dashboard/operations/therapists/actions"
import { GoogleMapsLocation } from "./GoogleMapsLocation"

interface TherapistMonitoringDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  therapist: any | null
  onRefresh: () => void
}

export function TherapistMonitoringDrawer({
  open,
  onOpenChange,
  therapist,
  onRefresh
}: TherapistMonitoringDrawerProps) {
  const [workStats, setWorkStats] = useState<TherapistWorkStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [cooldownDialogOpen, setCooldownDialogOpen] = useState(false)
  const [selectedCooldownHours, setSelectedCooldownHours] = useState<number>(24)
  const [settingCooldown, setSettingCooldown] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  useEffect(() => {
    if (open && therapist) {
      loadWorkStats()
    }
  }, [open, therapist])

  const loadWorkStats = async () => {
    if (!therapist) return

    setLoadingStats(true)
    const result = await getTherapistWorkStats(therapist.id)
    if (result.ok && result.data) {
      setWorkStats(result.data)
    } else {
      toast.error(result.error || "加载在线时长失败")
    }
    setLoadingStats(false)
  }

  const handleSetCooldown = async () => {
    if (!therapist) return

    setSettingCooldown(true)
    const result = await setTherapistCooldown(therapist.id, selectedCooldownHours)
    if (result.ok) {
      toast.success(`已设置冷却 ${selectedCooldownHours} 小时`)
      setCooldownDialogOpen(false)
      onRefresh()
      onOpenChange(false)
    } else {
      toast.error(result.error || "设置冷却失败")
    }
    setSettingCooldown(false)
  }

  const handleCancelCooldown = async () => {
    if (!therapist) return

    const result = await cancelTherapistCooldown(therapist.id)
    if (result.ok) {
      toast.success("已取消冷却")
      onRefresh()
    } else {
      toast.error(result.error || "取消冷却失败")
    }
  }

  const handleUpdateStatus = async (newStatus: 'available' | 'busy' | 'offline') => {
    if (!therapist) return

    setUpdatingStatus(true)
    const result = await updateTherapistStatus(therapist.id, newStatus)
    if (result.ok) {
      toast.success(`状态已更新为${newStatus === 'available' ? '在线' : newStatus === 'busy' ? '忙碌' : '离线'}`)
      onRefresh()
    } else {
      toast.error(result.error || "更新状态失败")
    }
    setUpdatingStatus(false)
  }

  if (!therapist) return null

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

  const getCityName = (city: any): string => {
    if (!city) return '-'
    // city.name 是 JSONB，包含 zh 字段
    if (city.name && typeof city.name === 'object' && city.name.zh) {
      return city.name.zh
    }
    return city.code || '-'
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return (
          <Badge variant="outline" className="border-green-500 text-green-600 gap-1 text-base px-3 py-1">
            <Circle className="h-3 w-3 fill-green-500" />
            在线
          </Badge>
        )
      case 'busy':
        return (
          <Badge variant="outline" className="border-orange-500 text-orange-600 gap-1 text-base px-3 py-1">
            <Circle className="h-3 w-3 fill-orange-500" />
            忙碌
          </Badge>
        )
      case 'offline':
        return (
          <Badge variant="outline" className="border-gray-400 text-gray-600 gap-1 text-base px-3 py-1">
            <Circle className="h-3 w-3 fill-gray-400" />
            离线
          </Badge>
        )
      default:
        return <Badge>{status}</Badge>
    }
  }

  const hasCooldown = therapist.cooldown_until_at && new Date(therapist.cooldown_until_at) > new Date()

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="overflow-y-auto w-full sm:max-w-2xl">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-xl">技师详情</SheetTitle>
            <SheetDescription className="text-base">
              工号：#{therapist.girl_number}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-6 px-4 pb-6 sm:mt-6 sm:space-y-8 sm:px-6">
            {/* 基本信息 */}
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={therapist.avatar_url || undefined} />
                <AvatarFallback>{therapist.girl_number}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="text-xl font-semibold">{therapist.name}</div>
                <div className="text-sm text-muted-foreground">@{therapist.username}</div>
                <div className="mt-2 flex items-center gap-2">
                  {getStatusBadge(therapist.status)}
                  {hasCooldown && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      冷却中
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* 状态信息 */}
            <div>
              <h3 className="text-sm font-semibold mb-3">状态信息</h3>
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between items-center">
                  <dt className="text-muted-foreground">当前状态</dt>
                  <dd>
                    <Select
                      value={therapist.status}
                      onValueChange={handleUpdateStatus}
                      disabled={updatingStatus}
                    >
                      <SelectTrigger className="w-[140px] h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">
                          <div className="flex items-center gap-2">
                            <Circle className="h-3 w-3 fill-green-500 text-green-500" />
                            在线
                          </div>
                        </SelectItem>
                        <SelectItem value="busy">
                          <div className="flex items-center gap-2">
                            <Circle className="h-3 w-3 fill-orange-500 text-orange-500" />
                            忙碌
                          </div>
                        </SelectItem>
                        <SelectItem value="offline">
                          <div className="flex items-center gap-2">
                            <Circle className="h-3 w-3 fill-gray-400 text-gray-400" />
                            离线
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">城市</dt>
                  <dd className="font-medium">{getCityName(therapist.city)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">最后上线时间</dt>
                  <dd className="font-medium">{formatDateTime(therapist.last_online_at)}</dd>
                </div>
                {hasCooldown && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">冷却截止时间</dt>
                    <dd className="font-medium text-destructive">{formatDateTime(therapist.cooldown_until_at)}</dd>
                  </div>
                )}
              </dl>
            </div>

            <Separator />

            {/* 当前位置 */}
            {therapist.current_lat && therapist.current_lng && (
              <>
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    当前位置
                  </h3>
                  <GoogleMapsLocation
                    lat={therapist.current_lat}
                    lng={therapist.current_lng}
                  />
                  <div className="mt-2 text-xs text-muted-foreground">
                    坐标: {therapist.current_lat.toFixed(6)}, {therapist.current_lng.toFixed(6)}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* 在线时长统计 */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                在线时长统计
              </h3>
              {loadingStats ? (
                <div className="text-sm text-muted-foreground">加载中...</div>
              ) : workStats ? (
                <dl className="space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">今日在线</dt>
                    <dd className="font-medium">{workStats.today_hours} 小时</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">最近7日在线</dt>
                    <dd className="font-medium">{workStats.week_hours} 小时</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">最近30日在线</dt>
                    <dd className="font-medium">{workStats.month_hours} 小时</dd>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between">
                    <dt className="font-semibold">总在线时长</dt>
                    <dd className="font-semibold text-lg text-primary">{workStats.total_hours} 小时</dd>
                  </div>
                </dl>
              ) : (
                <div className="text-sm text-muted-foreground">暂无数据</div>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                关闭
              </Button>
              {hasCooldown ? (
                <Button variant="default" className="flex-1" onClick={handleCancelCooldown}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  取消冷却
                </Button>
              ) : (
                <Button variant="destructive" className="flex-1" onClick={() => setCooldownDialogOpen(true)}>
                  <Ban className="mr-2 h-4 w-4" />
                  设置冷却
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* 冷却设置对话框 */}
      <AlertDialog open={cooldownDialogOpen} onOpenChange={setCooldownDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>设置技师冷却</AlertDialogTitle>
            <AlertDialogDescription>
              将强制技师下线，并在指定时间内不允许上线
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label className="text-sm font-medium mb-2 block">冷却时长</Label>
            <Select
              value={selectedCooldownHours.toString()}
              onValueChange={(value) => setSelectedCooldownHours(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 小时</SelectItem>
                <SelectItem value="12">12 小时</SelectItem>
                <SelectItem value="24">24 小时</SelectItem>
                <SelectItem value="48">48 小时（2天）</SelectItem>
                <SelectItem value="72">72 小时（3天）</SelectItem>
                <SelectItem value="168">168 小时（7天）</SelectItem>
                <SelectItem value="360">360 小时（15天）</SelectItem>
                <SelectItem value="720">720 小时（30天）</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={settingCooldown}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleSetCooldown} disabled={settingCooldown}>
              {settingCooldown ? "设置中..." : "确认设置"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// Label 组件引入
function Label({ className, children, ...props }: any) {
  return <label className={className} {...props}>{children}</label>
}
