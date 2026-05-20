"use client"

import { useEffect, useState } from "react"
import { AlertCircle, BarChart3, Clock, Heart, Repeat, Timer, TrendingUp } from "lucide-react"
import { toast } from "sonner"

import { getGirlPerformanceSnapshot } from "@/app/dashboard/business/girl-attendance/actions"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { LoadingSpinner } from "@/components/ui/loading"
import { Progress } from "@/components/ui/progress"
import type { GirlAttendanceStats, GirlPerformanceSnapshot } from "@/lib/features/girl-attendance"
import { getGirlAttendanceCopy } from "@/lib/features/girl-attendance/copy"
import { useLocale } from "@/lib/i18n/LocaleProvider"

interface GirlPerformanceDialogProps {
  girl: GirlAttendanceStats | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GirlPerformanceDialog({ girl, open, onOpenChange }: GirlPerformanceDialogProps) {
  const { locale } = useLocale()
  const copy = getGirlAttendanceCopy(locale)
  const [snapshot, setSnapshot] = useState<GirlPerformanceSnapshot | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !girl) return

    let ignore = false

    const loadSnapshot = async () => {
      setLoading(true)
      setSnapshot(null)

      try {
        const result = await getGirlPerformanceSnapshot(girl.girl_id)

        if (ignore) return

        if (result.ok) {
          setSnapshot(result.data)
        } else {
          toast.error(result.error || copy.dialog.loadError)
        }
      } catch (error) {
        if (!ignore) {
          console.error(copy.dialog.loadError, error)
          toast.error(copy.dialog.loadError)
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    loadSnapshot()

    return () => {
      ignore = true
    }
  }, [copy.dialog.loadError, girl, open])

  const levelConfig: Record<GirlPerformanceSnapshot["performance_level"], { label: string; className: string }> = {
    Excellent: {
      label: copy.dialog.levelLabels.Excellent,
      className: "border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-300",
    },
    Strong: {
      label: copy.dialog.levelLabels.Strong,
      className: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300",
    },
    Fair: {
      label: copy.dialog.levelLabels.Fair,
      className: "border-yellow-300 bg-yellow-50 text-yellow-700 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
    },
    "Needs Attention": {
      label: copy.dialog.levelLabels["Needs Attention"],
      className: "border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-300",
    },
  }

  const formatPercent = (value: number) => `${value.toFixed(1)}%`

  const formatMinutes = (value: number) => {
    if (value <= 0) return `0 ${copy.dialog.minute}`

    const hours = Math.floor(value / 60)
    const minutes = value % 60

    if (hours > 0 && minutes > 0) {
      return `${hours} ${copy.dialog.hour} ${minutes} ${copy.dialog.minutes}`
    }

    if (hours > 0) {
      return `${hours} ${copy.dialog.hours}`
    }

    return `${minutes} ${copy.dialog.minutes}`
  }

  const formatGeneratedAt = (value: string) => {
    if (!value) return copy.dialog.noDate

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return copy.dialog.noDate

    return date.toLocaleString(locale === "th" ? "th-TH" : "zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const metrics = !snapshot ? [] : [
    {
      icon: TrendingUp,
      label: copy.dialog.metrics.bookingEfficiency.label,
      value: formatPercent(snapshot.booking_efficiency_rate),
      note: copy.dialog.metrics.bookingEfficiency.note,
      tone: "text-green-600 dark:text-green-400",
    },
    {
      icon: Timer,
      label: copy.dialog.metrics.extensionRate.label,
      value: formatPercent(snapshot.extension_rate),
      note: copy.dialog.metrics.extensionRate.note,
      tone: "text-blue-600 dark:text-blue-400",
    },
    {
      icon: Clock,
      label: copy.dialog.metrics.extraTimeTotal.label,
      value: formatMinutes(snapshot.extra_time_total_minutes),
      note: copy.dialog.metrics.extraTimeTotal.note,
      tone: "text-muted-foreground",
    },
    {
      icon: AlertCircle,
      label: copy.dialog.metrics.arrivedCancellation.label,
      value: formatPercent(snapshot.arrived_cancellation_rate),
      note: copy.dialog.metrics.arrivedCancellation.note,
      tone: "text-red-600 dark:text-red-400",
    },
    {
      icon: Repeat,
      label: copy.dialog.metrics.repeatClient.label,
      value: formatPercent(snapshot.repeat_client_rate),
      note: copy.dialog.metrics.repeatClient.note,
      tone: "text-green-600 dark:text-green-400",
    },
    {
      icon: Heart,
      label: copy.dialog.metrics.favoriteGrowth.label,
      value: snapshot.favorite_growth_count > 0 ? `+${snapshot.favorite_growth_count}` : `${snapshot.favorite_growth_count}`,
      note: copy.dialog.metrics.favoriteGrowth.note,
      tone: snapshot.favorite_growth_count >= 0 ? "text-muted-foreground" : "text-red-600 dark:text-red-400",
    },
  ]

  const level = snapshot ? levelConfig[snapshot.performance_level] : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {copy.dialog.title}
          </DialogTitle>
          <DialogDescription>
            {girl ? copy.dialog.description(girl.name, girl.girl_number) : copy.dialog.fallbackDescription}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : !snapshot ? (
          <div className="rounded-md border py-10 text-center text-sm text-muted-foreground">
            {copy.dialog.empty}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-lg border p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">{copy.dialog.performanceIndex}</div>
                  <div className="mt-1 flex items-end gap-3">
                    <span className="text-4xl font-bold leading-none">{snapshot.performance_index}</span>
                    {level && (
                      <Badge variant="outline" className={level.className}>
                        {level.label}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground md:text-right">
                  <div>{copy.dialog.windowDays(snapshot.window_days)}</div>
                  <div>{copy.dialog.generatedAt}: {formatGeneratedAt(snapshot.generated_at)}</div>
                </div>
              </div>
              <Progress value={snapshot.performance_index} className="mt-4" />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {metrics.map((metric) => {
                const Icon = metric.icon

                return (
                  <div key={metric.label} className="rounded-md border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm text-muted-foreground">{metric.label}</div>
                        <div className={`mt-1 text-xl font-semibold ${metric.tone}`}>{metric.value}</div>
                      </div>
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">{metric.note}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
