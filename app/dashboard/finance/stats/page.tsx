"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LoadingSpinner } from "@/components/ui/loading"
import { TrendingUp, DollarSign, CreditCard, ArrowUpRight } from "lucide-react"
import { getFinanceStats, type FinanceStats } from "./actions"
import { toast } from "sonner"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts"

// 自定义图例渲染器（支持暗黑模式）
const renderCustomLegend = (props: any) => {
  const { payload } = props
  return (
    <div className="flex justify-center gap-4 flex-wrap mt-2">
      {payload?.map((entry: any, index: number) => (
        <div key={`legend-${index}`} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-sm text-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function FinanceStatsPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<FinanceStats | null>(null)

  const loadStats = async () => {
    setLoading(true)
    const result = await getFinanceStats()
    if (result.ok) {
      setStats(result.data)
    } else {
      toast.error(result.error || "加载统计数据失败")
    }
    setLoading(false)
  }

  useEffect(() => {
    loadStats()
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <LoadingSpinner />
        <p className="text-sm text-muted-foreground mt-4">加载统计数据...</p>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">暂无统计数据</p>
      </div>
    )
  }

  // 准备饼图数据 - 使用优雅的灰蓝色系
  const settlementPieData = stats ? [
    { name: '已核验', value: stats.settlements.total_verified, color: '#64748b' },  // slate-500
    { name: '待核验', value: stats.settlements.total_pending, color: '#cbd5e1' }   // slate-300
  ] : []

  // 准备结账/提现/欠款/押金 4 项数据
  const financialData = stats ? [
    {
      name: '已结款',
      amount: stats.transactions.total_settlement,
      count: stats.transactions.settlement_count,
      color: '#475569',  // slate-600
      symbol: '฿',
      desc: '技师已结款总额（THB）'
    },
    {
      name: '已提现',
      amount: stats.transactions.total_withdrawal,
      count: stats.transactions.withdrawal_count,
      color: '#94a3b8',  // slate-400
      symbol: '¥',
      desc: '技师已提现总额（RMB）'
    },
    {
      name: '当前总欠款',
      amount: stats.transactions.total_debt,
      count: null,
      color: '#f59e0b',  // amber-500
      symbol: '฿',
      desc: '技师当前总欠款（THB）'
    },
    {
      name: '总押金',
      amount: stats.transactions.total_deposit,
      count: null,
      color: '#10b981',  // emerald-500
      symbol: '฿',
      desc: '技师已付押金总额（THB）'
    }
  ] : []

  // 合并结账与提现数据（双轴图表）
  const settlementWithdrawalData = stats ? stats.transactions.monthly_settlement_chart.map((item, index) => ({
    month: item.month,
    settlement: item.amount,
    withdrawal: stats.transactions.monthly_withdrawal_chart[index]?.amount || 0
  })) : []

  // 合并利润与支出数据（双轴图表）
  const profitExpenseData = stats ? stats.profit.monthly_chart.map((item, index) => ({
    month: item.month,
    profit: item.amount,
    expense: stats.expense.monthly_chart[index]?.amount || 0
  })) : []


  return (
    <div className="flex flex-col gap-6 p-4 md:px-8 md:py-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">财务统计</h1>
          <p className="text-sm text-muted-foreground mt-1">平台核心财务数据统计与分析</p>
        </div>
      </div>

      {/* 核心指标卡片 - 4列 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总销售额</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ฿{stats.revenue.total_sales.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">已完成订单总额（THB）</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总利润</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ฿{stats.profit.total_profit.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">平台应得抽成（THB）</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总支出</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ¥{stats.expense.total_expense.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">平台代收总额（RMB）</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">利润率</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.revenue.total_sales > 0
                ? ((stats.profit.total_profit / stats.revenue.total_sales) * 100).toFixed(2)
                : '0.00'}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">利润 / 销售额</p>
          </CardContent>
        </Card>
      </div>

      {/* 第一行：核验状态饼图 + 结账提现对比 - 移动端1列，桌面端2列 */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* 订单核验状态分布 - 饼图 */}
        <Card>
          <CardHeader>
            <CardTitle>订单核验状态分布</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={settlementPieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(props) => {
                    const { cx, cy, midAngle, outerRadius, name, percent } = props
                    const RADIAN = Math.PI / 180
                    const radius = outerRadius + 25
                    const x = cx + radius * Math.cos(-midAngle * RADIAN)
                    const y = cy + radius * Math.sin(-midAngle * RADIAN)
                    return (
                      <text
                        x={x}
                        y={y}
                        fill="hsl(var(--foreground))"
                        textAnchor={x > cx ? 'start' : 'end'}
                        dominantBaseline="central"
                        fontSize={12}
                      >
                        {`${name} ${(percent * 100).toFixed(0)}%`}
                      </text>
                    )
                  }}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {settlementPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [`${value} 笔`, '数量']}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--popover-foreground))'
                  }}
                  labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                  itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                />
                <Legend content={renderCustomLegend} />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="text-center">
                <div className="text-sm text-muted-foreground">已核验</div>
                <div className="text-lg font-bold">{stats.settlements.total_verified}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground">待核验</div>
                <div className="text-lg font-bold">{stats.settlements.total_pending}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground">已拒绝</div>
                <div className="text-lg font-bold">{stats.settlements.total_rejected}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 结账/提现/欠款/押金统计 - 2×2 网格卡片 */}
        <Card>
          <CardHeader>
            <CardTitle>技师财务状态</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {financialData.map((item, index) => (
                <div key={index} className="flex items-start gap-3 p-4 border rounded-lg">
                  <div className="w-3 h-3 rounded-full mt-1" style={{ backgroundColor: item.color }}></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">{item.name}</p>
                    <p className="text-xl font-bold truncate">
                      {item.symbol}{item.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </p>
                    {item.count !== null && (
                      <p className="text-xs text-muted-foreground mt-1">{item.count} 笔</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 第二行：结账与提现对比、利润与支出对比 - 移动端1列，桌面端2列 */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* 结账（THB）vs 提现（RMB）双轴对比 */}
        <Card>
          <CardHeader>
            <CardTitle>月度结账与提现对比</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={settlementWithdrawalData}>
                <defs>
                  <linearGradient id="colorSettlement" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#475569" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#475569" stopOpacity={0.05}/>
                  </linearGradient>
                  <linearGradient id="colorWithdrawal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.3} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => value.substring(5)}
                  stroke="hsl(var(--border))"
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => `฿${(value / 1000).toFixed(0)}k`}
                  stroke="hsl(var(--border))"
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => `¥${(value / 1000).toFixed(0)}k`}
                  stroke="hsl(var(--border))"
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'settlement') return [`฿${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, '结账（THB）']
                    if (name === 'withdrawal') return [`¥${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, '提现（RMB）']
                    return [value, name]
                  }}
                  labelFormatter={(label) => `月份: ${label}`}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--popover-foreground))'
                  }}
                  labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                  itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                />
                <Legend content={renderCustomLegend} />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="settlement"
                  stroke="#475569"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorSettlement)"
                  name="结账（THB）"
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="withdrawal"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorWithdrawal)"
                  name="提现（RMB）"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 利润（THB）vs 支出（RMB）双轴对比 */}
        <Card>
          <CardHeader>
            <CardTitle>月度利润与支出对比</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={profitExpenseData}>
                <defs>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.05}/>
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.3} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => value.substring(5)}
                  stroke="hsl(var(--border))"
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => `฿${(value / 1000).toFixed(0)}k`}
                  stroke="hsl(var(--border))"
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => `¥${(value / 1000).toFixed(0)}k`}
                  stroke="hsl(var(--border))"
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'profit') return [`฿${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, '利润（THB）']
                    if (name === 'expense') return [`¥${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, '支出（RMB）']
                    return [value, name]
                  }}
                  labelFormatter={(label) => `月份: ${label}`}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--popover-foreground))'
                  }}
                  labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                  itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                />
                <Legend content={renderCustomLegend} />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="profit"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorProfit)"
                  name="利润（THB）"
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="expense"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorExpense)"
                  name="支出（RMB）"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 第三行：月度销售额柱形图 - 全宽 */}
      <Card>
        <CardHeader>
          <CardTitle>月度销售额走势（THB）</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.revenue.monthly_chart}>
              <defs>
                <linearGradient id="colorRevenueBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.3}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.3} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(value) => value.substring(5)}
                stroke="hsl(var(--border))"
              />
              <YAxis
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(value) => `฿${(value / 1000).toFixed(0)}k`}
                stroke="hsl(var(--border))"
              />
              <Tooltip
                formatter={(value: number) => [`฿${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, '销售额']}
                labelFormatter={(label) => `月份: ${label}`}
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--popover-foreground))'
                }}
                labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
              />
              <Bar dataKey="amount" fill="url(#colorRevenueBar)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
