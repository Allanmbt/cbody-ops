"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  ReceiptText,
  RotateCcw,
  Search,
  Store,
} from "lucide-react"

import { getPrivateIncallOrderStats } from "@/app/dashboard/business/private/actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type {
  PrivateIncallLocation,
  PrivateOrderPeriodMode,
  PrivateOrderStatsQuery,
  PrivateOrderStatsResult,
} from "@/lib/features/private"

const PAGE_SIZE = 20
const ALL_LOCATIONS = "__all__"
const currencyFormatter = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 2,
})
const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

interface FilterDraft {
  periodMode: PrivateOrderPeriodMode
  periodValue: string
  locationKey: string | null
}

function currentFinancePeriod(): { month: string; year: string } {
  const shifted = new Date(Date.now() - 6 * 60 * 60 * 1000)
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(shifted)
  const year = parts.find((item) => item.type === "year")?.value || String(new Date().getFullYear())
  const month = parts.find((item) => item.type === "month")?.value || "01"
  return { month: `${year}-${month}`, year }
}

function formatCurrency(value: number): string {
  return currencyFormatter.format(value)
}

function formatDateTime(value: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : dateTimeFormatter.format(date)
}

function formatMonth(value: string): string {
  const [year, month] = value.split("-")
  return year && month ? `${year}年${month}月` : value
}

function formatRate(value: number): string {
  return `${(value * 100).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}%`
}

function serviceTitle(value: Record<string, string>): string {
  return value.zh || value.en || value.th || "未命名服务"
}

export function PrivateOrderStatsPanel({ locations }: { locations: PrivateIncallLocation[] }) {
  const defaults = useMemo(currentFinancePeriod, [])
  const [draft, setDraft] = useState<FilterDraft>({
    periodMode: "month",
    periodValue: defaults.month,
    locationKey: null,
  })
  const [query, setQuery] = useState<PrivateOrderStatsQuery>({
    period_mode: "month",
    period_value: defaults.month,
    location_key: null,
    page: 1,
    page_size: PAGE_SIZE,
  })
  const [data, setData] = useState<PrivateOrderStatsResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const locationOptions = useMemo(() => {
    const options = new Map<string, string>()
    for (const location of locations) {
      options.set(location.id, `${location.name}${location.is_active ? "" : "（已停用）"}`)
    }
    for (const location of data?.location_options || []) {
      if (!options.has(location.location_key)) {
        options.set(location.location_key, location.location_name)
      }
    }
    return [...options].map(([location_key, location_name]) => ({ location_key, location_name }))
  }, [data?.location_options, locations])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    getPrivateIncallOrderStats(query).then((result) => {
      if (cancelled) return
      if (result.ok) {
        setData(result.data)
      } else {
        setData(null)
        setError(result.error)
      }
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [query, reloadKey])

  const submitFilters = (event: FormEvent) => {
    event.preventDefault()
    if (!draft.periodValue) return
    setQuery({
      period_mode: draft.periodMode,
      period_value: draft.periodValue,
      location_key: draft.locationKey,
      page: 1,
      page_size: PAGE_SIZE,
    })
  }

  const resetFilters = () => {
    const next: FilterDraft = {
      periodMode: "month",
      periodValue: defaults.month,
      locationKey: null,
    }
    setDraft(next)
    setQuery({
      period_mode: next.periodMode,
      period_value: next.periodValue,
      location_key: null,
      page: 1,
      page_size: PAGE_SIZE,
    })
  }

  const changePage = (page: number) => {
    setQuery((current) => ({ ...current, page }))
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <form className="grid gap-3 md:grid-cols-[150px_190px_minmax(220px,1fr)_auto]" onSubmit={submitFilters}>
            <Select
              value={draft.periodMode}
              onValueChange={(value: PrivateOrderPeriodMode) => setDraft((current) => ({
                ...current,
                periodMode: value,
                periodValue: value === "month" ? defaults.month : defaults.year,
              }))}
              disabled={loading}
            >
              <SelectTrigger aria-label="统计周期"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="month">按月统计</SelectItem>
                <SelectItem value="year">按年统计</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type={draft.periodMode === "month" ? "month" : "number"}
              min={draft.periodMode === "year" ? 2000 : undefined}
              max={draft.periodMode === "year" ? 2100 : undefined}
              value={draft.periodValue}
              onChange={(event) => setDraft((current) => ({ ...current, periodValue: event.target.value }))}
              aria-label={draft.periodMode === "month" ? "选择月份" : "输入年份"}
              required
              disabled={loading}
            />

            <Select
              value={draft.locationKey || ALL_LOCATIONS}
              onValueChange={(value) => setDraft((current) => ({
                ...current,
                locationKey: value === ALL_LOCATIONS ? null : value,
              }))}
              disabled={loading}
            >
              <SelectTrigger aria-label="选择门店"><SelectValue placeholder="全部门店" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_LOCATIONS}>全部门店</SelectItem>
                {locationOptions.map((location) => (
                  <SelectItem key={location.location_key} value={location.location_key}>
                    {location.location_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Button type="submit" disabled={loading} className="flex-1 md:flex-none">
                <Search className="mr-2 h-4 w-4" />查询
              </Button>
              <Button type="button" variant="outline" onClick={resetFilters} disabled={loading} aria-label="重置筛选">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            仅统计已完成且已核验的 Incall 订单；财务月按泰国时间每月 1 日 06:00 切分。
          </p>
        </CardContent>
      </Card>

      {loading && !data && (
        <Card><CardContent className="py-14 text-center text-sm text-muted-foreground">正在加载订单统计…</CardContent></Card>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>订单统计加载失败</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={() => setReloadKey((value) => value + 1)}>重试</Button>
          </AlertDescription>
        </Alert>
      )}

      {data && (
        <div className={loading ? "pointer-events-none space-y-4 opacity-60" : "space-y-4"} aria-busy={loading}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard title="总单数" value={`${data.summary.order_count.toLocaleString()} 单`} icon={<ReceiptText className="h-4 w-4 text-muted-foreground" />} />
            <SummaryCard title="销售额" value={formatCurrency(data.summary.sales_amount)} icon={<CircleDollarSign className="h-4 w-4 text-muted-foreground" />} />
            <SummaryCard title="加钟利润" value={formatCurrency(data.summary.add_time_profit)} description={`${data.summary.add_time_count} 次 · ${data.summary.add_time_duration_minutes} 分钟`} icon={<Clock3 className="h-4 w-4 text-amber-600" />} />
            <SummaryCard title="平台毛收益" value={formatCurrency(data.summary.platform_gross_profit)} description={`已包含加钟 ${formatCurrency(data.summary.add_time_profit)}`} icon={<Store className="h-4 w-4 text-muted-foreground" />} />
          </div>

          {query.period_mode === "year" && <MonthlyStatsTable data={data} />}
          <LocationStatsTable data={data} />
          <OrderDetailsTable data={data} onPageChange={changePage} />
        </div>
      )}
    </div>
  )
}

function SummaryCard({ title, value, description, icon }: { title: string; value: string; description?: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>{icon}
      </CardHeader>
      <CardContent><div className="text-2xl font-bold tabular-nums">{value}</div>{description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}</CardContent>
    </Card>
  )
}

function MonthlyStatsTable({ data }: { data: PrivateOrderStatsResult }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">年度月度明细</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>月份</TableHead><TableHead className="text-right">订单</TableHead><TableHead className="text-right">销售额</TableHead><TableHead className="text-right">加钟利润</TableHead><TableHead className="text-right">平台毛收益</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.months.map((item) => <TableRow key={item.month}><TableCell className="font-medium">{formatMonth(item.month)}</TableCell><TableCell className="text-right tabular-nums">{item.order_count}</TableCell><TableCell className="text-right tabular-nums">{formatCurrency(item.sales_amount)}</TableCell><TableCell className="text-right tabular-nums text-amber-700 dark:text-amber-300">{formatCurrency(item.add_time_profit)}</TableCell><TableCell className="text-right tabular-nums">{formatCurrency(item.platform_gross_profit)}</TableCell></TableRow>)}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function LocationStatsTable({ data }: { data: PrivateOrderStatsResult }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">门店数据</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>门店/场所</TableHead><TableHead className="text-right">订单</TableHead><TableHead className="text-right">销售额</TableHead><TableHead className="text-right">加钟利润</TableHead><TableHead className="text-right">平台毛收益</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.locations.map((item) => <TableRow key={item.location_key}><TableCell className="font-medium">{item.location_name}</TableCell><TableCell className="text-right tabular-nums">{item.order_count}</TableCell><TableCell className="text-right tabular-nums">{formatCurrency(item.sales_amount)}</TableCell><TableCell className="text-right tabular-nums text-amber-700 dark:text-amber-300">{formatCurrency(item.add_time_profit)}</TableCell><TableCell className="text-right tabular-nums">{formatCurrency(item.platform_gross_profit)}</TableCell></TableRow>)}
            {data.locations.length === 0 && <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">当前期间暂无符合条件的订单</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function OrderDetailsTable({ data, onPageChange }: { data: PrivateOrderStatsResult; onPageChange: (page: number) => void }) {
  const { pagination } = data
  const start = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.page_size + 1
  const end = Math.min(pagination.page * pagination.page_size, pagination.total)

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">订单明细</CardTitle>
        <Badge variant="outline">共 {pagination.total.toLocaleString()} 单</Badge>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>完成时间/订单</TableHead><TableHead>门店/技师</TableHead><TableHead>服务</TableHead><TableHead className="text-right">销售额</TableHead><TableHead className="text-right">服务提成</TableHead><TableHead className="text-right">加钟利润</TableHead><TableHead className="text-right">平台总收益</TableHead><TableHead>核验时间</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="min-w-40"><div>{formatDateTime(order.completed_at)}</div><div className="text-xs text-muted-foreground">{order.order_number}</div></TableCell>
                  <TableCell className="min-w-40"><div className="font-medium">{order.location_name}</div><div className="text-xs text-muted-foreground">#{order.girl_number} · {order.girl_name}</div></TableCell>
                  <TableCell className="min-w-40"><div>{serviceTitle(order.service_name)}</div><div className="text-xs text-muted-foreground">{order.service_duration} 分钟</div>{order.add_time_count > 0 && <Badge variant="outline" className="mt-1 border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">加钟 {order.add_time_count} 次 · {order.add_time_duration_minutes} 分钟</Badge>}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatCurrency(order.total_amount)}</TableCell>
                  <TableCell className="min-w-28 text-right text-xs"><div>{formatRate(order.service_commission_rate)}</div><div className="text-muted-foreground">{formatCurrency(order.platform_should_get)}</div></TableCell>
                  <TableCell className="min-w-28 text-right font-medium tabular-nums text-amber-700 dark:text-amber-300">{order.add_time_count > 0 ? formatCurrency(order.add_time_commission_thb) : "—"}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatCurrency(order.total_platform_profit)}</TableCell>
                  <TableCell className="min-w-36 text-muted-foreground">{formatDateTime(order.settled_at)}</TableCell>
                </TableRow>
              ))}
              {data.orders.length === 0 && <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">暂无订单明细</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="text-muted-foreground">显示 {start}–{end} 条，共 {pagination.total} 条</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => onPageChange(pagination.page - 1)}><ChevronLeft className="h-4 w-4" />上一页</Button>
            <span>第 {pagination.page} 页</span>
            <Button variant="outline" size="sm" disabled={pagination.total_pages === 0 || pagination.page >= pagination.total_pages} onClick={() => onPageChange(pagination.page + 1)}>下一页<ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
