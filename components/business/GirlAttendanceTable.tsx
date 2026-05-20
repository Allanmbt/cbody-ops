"use client"

import { ArrowUpDown, BarChart3 } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { GirlAttendanceStats } from "@/lib/features/girl-attendance"
import { getGirlAttendanceCopy } from "@/lib/features/girl-attendance/copy"
import { useLocale } from "@/lib/i18n/LocaleProvider"

interface GirlAttendanceTableProps {
  data: GirlAttendanceStats[]
  loading: boolean
  onSort: (field: string) => void
  onViewPerformance: (girl: GirlAttendanceStats) => void
  sortBy: string
  sortOrder: "asc" | "desc"
}

export function GirlAttendanceTable({
  data,
  loading,
  onSort,
  onViewPerformance,
  sortBy,
}: GirlAttendanceTableProps) {
  const { locale } = useLocale()
  const copy = getGirlAttendanceCopy(locale)

  const formatHours = (seconds: number) => (seconds / 3600).toFixed(1)

  const getPerformanceRatingConfig = (rating: string) => {
    const label = copy.table.ratingLabels[rating] || copy.table.ratingLabels.unknown

    switch (rating) {
      case "excellent":
        return {
          label,
          className: "bg-green-50 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300 dark:border-green-700",
        }
      case "good":
        return {
          label,
          className: "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-700",
        }
      case "average":
        return {
          label,
          className: "bg-yellow-50 text-yellow-700 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-700",
        }
      case "poor":
        return {
          label,
          className: "bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-700",
        }
      case "very_poor":
        return {
          label,
          className: "bg-red-50 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-700",
        }
      case "insufficient_data":
        return {
          label,
          className: "bg-gray-50 text-gray-700 border-gray-300 dark:bg-gray-950 dark:text-gray-300 dark:border-gray-700",
        }
      default:
        return {
          label,
          className: "bg-gray-50 text-gray-700 border-gray-300 dark:bg-gray-950 dark:text-gray-300 dark:border-gray-700",
        }
    }
  }

  const SortButton = ({ field, label }: { field: string; label: string }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 -ml-3"
      onClick={() => onSort(field)}
    >
      {label}
      <ArrowUpDown className={`ml-2 h-4 w-4 ${sortBy === field ? "text-primary" : "text-muted-foreground"}`} />
    </Button>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">{copy.table.loading}</div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">{copy.table.empty}</p>
      </div>
    )
  }

  return (
    <>
      <div className="hidden overflow-x-auto rounded-md border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">
                <SortButton field="girl_number" label={copy.table.technician} />
              </TableHead>
              <TableHead className="text-right">
                <SortButton field="online_seconds" label={copy.table.onlineHours} />
              </TableHead>
              <TableHead className="text-right">
                <SortButton field="order_count" label={copy.table.completedOrders} />
              </TableHead>
              <TableHead className="text-right">
                <SortButton field="order_duration_seconds" label={copy.table.orderHours} />
              </TableHead>
              <TableHead className="text-right">
                <SortButton field="booking_rate_percent" label={copy.table.bookingRate} />
              </TableHead>
              <TableHead className="text-right">
                <SortButton field="extension_rate" label={copy.table.extensionRate} />
              </TableHead>
              <TableHead className="text-center">{copy.table.performanceRating}</TableHead>
              <TableHead className="text-right">{copy.table.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((girl) => {
              const bookingRate = girl.booking_rate_percent
              const rateColor = bookingRate >= 50
                ? "text-green-600 dark:text-green-400"
                : bookingRate >= 30
                  ? "text-yellow-600 dark:text-yellow-400"
                  : "text-red-600 dark:text-red-400"
              const ratingConfig = getPerformanceRatingConfig(girl.performance_rating)

              return (
                <TableRow key={girl.girl_id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={girl.avatar_url || undefined} alt={girl.name} />
                        <AvatarFallback>{girl.name.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{girl.name}</div>
                        <div className="text-sm text-muted-foreground">#{girl.girl_number}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatHours(girl.online_seconds)}</TableCell>
                  <TableCell className="text-right font-mono">{girl.order_count}</TableCell>
                  <TableCell className="text-right font-mono">{formatHours(girl.order_duration_seconds)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className={`font-mono ${rateColor}`}>
                      {bookingRate.toFixed(1)}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className="font-mono text-blue-600 dark:text-blue-400">
                      {girl.extension_rate.toFixed(1)}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={ratingConfig.className}>
                      {ratingConfig.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onViewPerformance(girl)}
                    >
                      <BarChart3 className="mr-2 h-4 w-4" />
                      {copy.table.viewPerformance}
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-4 md:hidden">
        {data.map((girl) => {
          const bookingRate = girl.booking_rate_percent
          const rateColor = bookingRate >= 50
            ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
            : bookingRate >= 30
              ? "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800"
              : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800"
          const ratingConfig = getPerformanceRatingConfig(girl.performance_rating)

          return (
            <div key={girl.girl_id} className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center gap-3 border-b pb-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={girl.avatar_url || undefined} alt={girl.name} />
                  <AvatarFallback>{girl.name.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="font-medium">{girl.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {copy.table.jobNumber} #{girl.girl_number}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Badge variant="outline" className={`font-mono ${rateColor}`}>
                    {bookingRate.toFixed(1)}%
                  </Badge>
                  <Badge variant="outline" className={ratingConfig.className}>
                    {ratingConfig.label}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground">{copy.table.onlineHours}</div>
                  <div className="mt-1 font-mono font-medium">
                    {formatHours(girl.online_seconds)} {copy.table.hours}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">{copy.table.completedOrders}</div>
                  <div className="mt-1 font-mono font-medium">
                    {girl.order_count} {copy.table.orders}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">{copy.table.extensionRate}</div>
                  <div className="mt-1 font-mono font-medium">
                    {girl.extension_rate.toFixed(1)}%
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-muted-foreground">{copy.table.orderHours}</div>
                  <div className="mt-1 font-mono font-medium">
                    {formatHours(girl.order_duration_seconds)} {copy.table.hours}
                  </div>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => onViewPerformance(girl)}
              >
                <BarChart3 className="mr-2 h-4 w-4" />
                {copy.table.viewPerformance}
              </Button>
            </div>
          )
        })}
      </div>
    </>
  )
}
