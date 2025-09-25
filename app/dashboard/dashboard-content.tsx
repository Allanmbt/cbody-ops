"use client"

import * as React from "react"
import {
  ActivitySquare,
  Bell,
  Mail,
  ChevronRight,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import type { LucideIcon } from "lucide-react"

const summaryMetrics: {
  key: string
  label: string
  value: string
  change: string
  trend: "positive" | "negative"
}[] = [
  {
    key: "revenue",
    label: "今日营收",
    value: "¥126,800",
    change: "+18.6%",
    trend: "positive",
  },
  {
    key: "orders",
    label: "今日订单",
    value: "42",
    change: "+12.1%",
    trend: "positive",
  },
  {
    key: "girls",
    label: "在线技师",
    value: "28",
    change: "+3",
    trend: "positive",
  },
  {
    key: "alerts",
    label: "待处理事项",
    value: "5",
    change: "+1",
    trend: "negative",
  },
]

const engagementChartData = [
  { month: "4月", orders: 248, revenue: 187000 },
  { month: "5月", orders: 286, revenue: 214000 },
  { month: "6月", orders: 305, revenue: 229000 },
  { month: "7月", orders: 332, revenue: 240500 },
  { month: "8月", orders: 361, revenue: 254000 },
  { month: "9月", orders: 389, revenue: 268500 },
]

const engagementChartConfig = {
  orders: {
    label: "订单数量",
    color: "hsl(var(--chart-1))",
  },
  revenue: {
    label: "营收金额",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

const activityFeed = [
  {
    key: "alert",
    icon: Bell,
    title: "新订单提醒",
    description: "技师小美接到新的按摩服务订单，预约时间今晚8点。",
    time: "5 分钟前",
  },
  {
    key: "mail",
    icon: Mail,
    title: "客户反馈收到",
    description: "客户对服务给予5星好评，并留下感谢留言。",
    time: "1 小时前",
  },
  {
    key: "ops",
    icon: ActivitySquare,
    title: "系统状态更新",
    description: "支付系统升级完成，所有功能运行正常。",
    time: "昨日下午",
  },
]

export function DashboardContent() {
  return (
    <>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryMetrics.map((metric) => (
          <Card key={metric.key} className="border-border/60">
            <CardHeader className="space-y-1 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium">
                  {metric.label}
                </CardTitle>
                {metric.key === "alerts" ? (
                  <Badge variant="outline" className="text-xs">
                    实时
                  </Badge>
                ) : null}
              </div>
              <CardDescription>CBODY 管理后台</CardDescription>
            </CardHeader>
            <CardContent className="flex items-end justify-between gap-2">
              <span className="text-3xl font-semibold tracking-tight">
                {metric.value}
              </span>
              <span
                className={cn(
                  "text-sm font-medium",
                  metric.trend === "positive"
                    ? "text-emerald-500 dark:text-emerald-400"
                    : "text-rose-500"
                )}
              >
                {metric.change}
              </span>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="border-border/60 xl:col-span-2">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>业务数据趋势</CardTitle>
              <CardDescription>实时监控订单量和营收变化</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">近 6 个月</Badge>
              <Badge variant="outline" className="hidden sm:inline-flex">
                实时更新
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={engagementChartConfig} className="h-[280px]">
              <AreaChart data={engagementChartData}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="dot" />}
                />
                <Area
                  dataKey="orders"
                  type="monotone"
                  stroke="var(--color-orders)"
                  fill="var(--color-orders)"
                  fillOpacity={0.2}
                />
                <Area
                  dataKey="revenue"
                  type="monotone"
                  stroke="var(--color-revenue)"
                  fill="var(--color-revenue)"
                  fillOpacity={0.16}
                />
                <ChartLegend
                  verticalAlign="bottom"
                  content={<ChartLegendContent />}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>实时动态</CardTitle>
            <CardDescription>系统消息和业务提醒</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[280px]">
              <div className="flex flex-col gap-4 pr-4">
                {activityFeed.map((activity) => (
                  <div
                    key={activity.key}
                    className="flex items-start gap-3 rounded-xl border border-border/60 p-4"
                  >
                    <div className="rounded-full bg-primary/10 p-2 text-primary">
                      <activity.icon className="size-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {activity.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {activity.description}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {activity.time}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </section>
    </>
  )
}