"use client"

import { ExternalLink, Store } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatCurrency } from "@/lib/features/orders"

interface AddTimeSummaryLike {
  count: number
  duration_minutes: number
  commission_thb: number
}

interface TimeExtensionLike {
  id: string
  duration_minutes: number
  commission_thb_snapshot: number
  reported_at: string
  base_service_duration_before: number
  service_duration_after: number
  settlement_status: string
  notes?: string | null
}

interface LocationSnapshotLike {
  name?: string
  address?: string
  addr?: string
  lat?: number
  lng?: number
  place_id?: string
}

export function isIncallOrder(serviceType?: string | null) {
  return serviceType === "incall"
}

export function OrderTypeIcon({ serviceType }: { serviceType?: string | null }) {
  if (!isIncallOrder(serviceType)) return null

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300"
          aria-label="到店订单"
        >
          <Store className="h-3 w-3" />
        </span>
      </TooltipTrigger>
      <TooltipContent>到店订单</TooltipContent>
    </Tooltip>
  )
}

export function OrderTypeBadge({ serviceType }: { serviceType?: string | null }) {
  if (isIncallOrder(serviceType)) {
    return (
      <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300">
        <Store className="h-3 w-3" />
        到店
      </Badge>
    )
  }

  return <Badge variant="outline">上门</Badge>
}

export function hasAddTime(summary?: AddTimeSummaryLike | null) {
  return Number(summary?.count || 0) > 0
}

export function AddTimeSummaryText({ summary, compact = false }: { summary?: AddTimeSummaryLike | null; compact?: boolean }) {
  if (!hasAddTime(summary)) return null

  const text = compact
    ? `+${summary!.duration_minutes} 分钟 / ${formatCurrency(summary!.commission_thb)}`
    : `加钟 ${summary!.count} 次 / ${summary!.duration_minutes} 分钟 / ${formatCurrency(summary!.commission_thb)}`

  return (
    <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
      {text}
    </span>
  )
}

export function AddTimeDetailsList({ items }: { items?: TimeExtensionLike[] | null }) {
  const rows = (items || []).filter((item) => item.settlement_status !== "rejected")
  if (rows.length === 0) {
    return <div className="rounded-md border p-3 text-sm text-muted-foreground">暂无加钟记录</div>
  }

  return (
    <div className="space-y-2">
      {rows.map((item) => (
        <div key={item.id} className="rounded-md border p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-medium">
              +{item.duration_minutes} 分钟
              <span className="ml-2 text-muted-foreground">
                {formatCurrency(item.commission_thb_snapshot)}
              </span>
            </div>
            <Badge variant="outline">
              {item.settlement_status === "settled" ? "已结算" : "已报备"}
            </Badge>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {new Date(item.reported_at).toLocaleString("zh-CN", {
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
            <span className="mx-1">·</span>
            {item.base_service_duration_before} → {item.service_duration_after} 分钟
          </div>
          {item.notes && <div className="mt-2 text-xs text-muted-foreground">备注：{item.notes}</div>}
        </div>
      ))}
    </div>
  )
}

export function getMapUrl(location?: LocationSnapshotLike | null) {
  if (!location) return null
  if (location.place_id) {
    return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(location.place_id)}`
  }
  if (typeof location.lat === "number" && typeof location.lng === "number") {
    return `https://www.google.com/maps?q=${location.lat},${location.lng}`
  }
  return null
}

export function MapLinkButton({ location }: { location?: LocationSnapshotLike | null }) {
  const url = getMapUrl(location)
  if (!url) return null

  return (
    <Button variant="outline" size="sm" asChild>
      <a href={url} target="_blank" rel="noreferrer">
        <ExternalLink className="mr-2 h-3.5 w-3.5" />
        地图
      </a>
    </Button>
  )
}
