"use client"

import { useState } from "react"
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
import { ArrowUpDown } from "lucide-react"
import type { GirlAttendanceStats } from "@/lib/features/girl-attendance"

interface GirlAttendanceTableProps {
  data: GirlAttendanceStats[]
  loading: boolean
  onSort: (field: string) => void
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

export function GirlAttendanceTable({
  data,
  loading,
  onSort,
  sortBy,
  sortOrder
}: GirlAttendanceTableProps) {
  // 格式化秒数为小时（保留1位小数）
  const formatHours = (seconds: number) => {
    return (seconds / 3600).toFixed(1)
  }

  // 获取绩效评级的显示配置
  const getPerformanceRatingConfig = (rating: string) => {
    switch (rating) {
      case 'excellent':
        return {
          label: '优质',
          className: 'bg-green-50 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300 dark:border-green-700'
        }
      case 'good':
        return {
          label: '较好',
          className: 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-700'
        }
      case 'average':
        return {
          label: '一般',
          className: 'bg-yellow-50 text-yellow-700 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-700'
        }
      case 'poor':
        return {
          label: '较差',
          className: 'bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-700'
        }
      case 'very_poor':
        return {
          label: '很差',
          className: 'bg-red-50 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-700'
        }
      case 'insufficient_data':
        return {
          label: '数据不足',
          className: 'bg-gray-50 text-gray-700 border-gray-300 dark:bg-gray-950 dark:text-gray-300 dark:border-gray-700'
        }
      default:
        return {
          label: '未知',
          className: 'bg-gray-50 text-gray-700 border-gray-300 dark:bg-gray-950 dark:text-gray-300 dark:border-gray-700'
        }
    }
  }

  // 渲染排序按钮
  const SortButton = ({ field, label }: { field: string; label: string }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 -ml-3"
      onClick={() => onSort(field)}
    >
      {label}
      <ArrowUpDown className={`ml-2 h-4 w-4 ${sortBy === field ? 'text-primary' : 'text-muted-foreground'}`} />
    </Button>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">暂无数据</p>
      </div>
    )
  }

  return (
    <>
      {/* 桌面端表格 */}
      <div className="hidden md:block rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">
                <SortButton field="girl_number" label="技师" />
              </TableHead>
              <TableHead className="text-right">
                <SortButton field="online_seconds" label="在线时长 (h)" />
              </TableHead>
              <TableHead className="text-right">
                <SortButton field="order_count" label="完成订单" />
              </TableHead>
              <TableHead className="text-right">
                <SortButton field="order_duration_seconds" label="订单时长 (h)" />
              </TableHead>
              <TableHead className="text-right">
                <SortButton field="booking_rate_percent" label="预订率" />
              </TableHead>
              <TableHead className="text-center">绩效评级</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((girl) => {
              const bookingRate = girl.booking_rate_percent
              const rateColor = bookingRate >= 50 ? 'text-green-600 dark:text-green-400'
                              : bookingRate >= 30 ? 'text-yellow-600 dark:text-yellow-400'
                              : 'text-red-600 dark:text-red-400'

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
                  <TableCell className="text-right font-mono">
                    {formatHours(girl.online_seconds)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {girl.order_count}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatHours(girl.order_duration_seconds)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant="outline"
                      className={`font-mono ${rateColor}`}
                    >
                      {bookingRate.toFixed(1)}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={ratingConfig.className}>
                      {ratingConfig.label}
                    </Badge>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* 移动端卡片列表 */}
      <div className="md:hidden space-y-4">
        {data.map((girl) => {
          const bookingRate = girl.booking_rate_percent
          const rateColor = bookingRate >= 50 ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800'
                          : bookingRate >= 30 ? 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800'
                          : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800'

          const ratingConfig = getPerformanceRatingConfig(girl.performance_rating)

          return (
            <div key={girl.girl_id} className="border rounded-lg p-4 space-y-3">
              {/* 技师信息 */}
              <div className="flex items-center gap-3 pb-3 border-b">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={girl.avatar_url || undefined} alt={girl.name} />
                  <AvatarFallback>{girl.name.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="font-medium">{girl.name}</div>
                  <div className="text-sm text-muted-foreground">工号 #{girl.girl_number}</div>
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

              {/* 统计数据 */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground">在线时长</div>
                  <div className="font-mono font-medium mt-1">
                    {formatHours(girl.online_seconds)} 小时
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">完成订单</div>
                  <div className="font-mono font-medium mt-1">
                    {girl.order_count} 单
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-muted-foreground">订单时长</div>
                  <div className="font-mono font-medium mt-1">
                    {formatHours(girl.order_duration_seconds)} 小时
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
