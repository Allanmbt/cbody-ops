"use client"

import * as React from "react"
import Link from "next/link"
import {
  ActivitySquare,
  Bell,
  Briefcase,
  ChartBarStacked,
  ChevronRight,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  LineChart,
  Mail,
  Settings,
  Sparkle,
  Users,
  Workflow,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import type { LucideIcon } from "lucide-react"

type SidebarNavChild = {
  key: string
  title: string
  href: string
  isActive?: boolean
  badge?: string
}

type SidebarNavItem = {
  key: string
  title: string
  icon: LucideIcon
  href?: string
  badge?: string
  isActive?: boolean
  children?: SidebarNavChild[]
}

const sidebarGroups: {
  label: string
  items: SidebarNavItem[]
}[] = [
  {
    label: "业务工作台",
    items: [
      {
        key: "workspace-overview",
        title: "场景驾驶舱",
        icon: LayoutDashboard,
        isActive: true,
        children: [
          {
            key: "workspace-history",
            title: "历史记录",
            href: "#history",
          },
          {
            key: "workspace-favorites",
            title: "收藏夹",
            href: "#favorites",
            isActive: true,
          },
          {
            key: "workspace-settings",
            title: "偏好设置",
            href: "#preferences",
          },
        ],
      },
      {
        key: "workspace-pipelines",
        title: "流程编排",
        icon: Workflow,
        href: "#pipelines",
        badge: "3",
      },
      {
        key: "workspace-clients",
        title: "客户旅程",
        icon: Users,
        href: "#clients",
      },
    ],
  },
  {
    label: "智能服务",
    items: [
      {
        key: "insight-center",
        title: "洞察中心",
        icon: LineChart,
        href: "#insights",
      },
      {
        key: "sales-playbook",
        title: "销售锦囊",
        icon: Briefcase,
        href: "#playbook",
        badge: "Beta",
      },
      {
        key: "operation-automation",
        title: "运营自动化",
        icon: Sparkle,
        href: "#automation",
      },
    ],
  },
  {
    label: "支撑中心",
    items: [
      {
        key: "reports",
        title: "报表中心",
        icon: ChartBarStacked,
        href: "#reports",
      },
      {
        key: "knowledge",
        title: "知识库",
        icon: FileText,
        href: "#knowledge",
      },
      {
        key: "support",
        title: "服务支持",
        icon: LifeBuoy,
        href: "#support",
      },
    ],
  },
]

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
    key: "conversion",
    label: "新客转化",
    value: "42.3%",
    change: "+3.1%",
    trend: "positive",
  },
  {
    key: "tickets",
    label: "待处理工单",
    value: "32",
    change: "-8.4%",
    trend: "positive",
  },
  {
    key: "alerts",
    label: "风险提醒",
    value: "5",
    change: "+1",
    trend: "negative",
  },
]

const engagementChartData = [
  { month: "4月", active: 2480, returning: 1870 },
  { month: "5月", active: 2860, returning: 2140 },
  { month: "6月", active: 3050, returning: 2290 },
  { month: "7月", active: 3320, returning: 2405 },
  { month: "8月", active: 3615, returning: 2540 },
  { month: "9月", active: 3890, returning: 2685 },
]

const engagementChartConfig = {
  active: {
    label: "活跃用户",
    color: "hsl(var(--chart-1))",
  },
  returning: {
    label: "回访用户",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

const teamProgress = [
  {
    key: "launch-campaign",
    name: "品牌焕新营销",
    owner: "市场增长组",
    completion: 78,
    eta: "预计 3 天内上线",
  },
  {
    key: "vip-onboarding",
    name: "VIP 客户旅程",
    owner: "数字运营组",
    completion: 56,
    eta: "已完成关键节点",
  },
  {
    key: "automations",
    name: "自动化流程治理",
    owner: "产品体验组",
    completion: 42,
    eta: "待审批三条规则",
  },
]

const activityFeed = [
  {
    key: "alert",
    icon: Bell,
    title: "高价值客户回访窗口开启",
    description: "系统建议在 24 小时内安排专属顾问跟进。",
    time: "5 分钟前",
  },
  {
    key: "mail",
    icon: Mail,
    title: "季度满意度调查完成",
    description: "收集到 823 份问卷，满意度提升 9%。",
    time: "1 小时前",
  },
  {
    key: "ops",
    icon: ActivitySquare,
    title: "AI 运营助手推送两条优化建议",
    description: "登陆页转化组件建议 A/B 测试新方案。",
    time: "昨日下午",
  },
]

export default function HomePage() {
  const initialExpanded = React.useMemo(() => {
    return sidebarGroups
      .flatMap((group) => group.items)
      .filter((item) =>
        item.children?.some((child) => child.isActive) || item.isActive
      )
      .map((item) => item.key)
  }, [])

  const [expandedMenus, setExpandedMenus] = React.useState<string[]>(
    initialExpanded
  )

  const handleToggle = React.useCallback((key: string, open: boolean) => {
    setExpandedMenus((prev) => {
      if (open) {
        return prev.includes(key) ? prev : [...prev, key]
      }
      return prev.filter((item) => item !== key)
    })
  }, [])

  return (
    <SidebarProvider>
      <Sidebar variant="floating" collapsible="icon">
        <SidebarHeader>
          <DashboardBranding />
        </SidebarHeader>
        <SidebarContent>
          {sidebarGroups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const hasChildren = item.children && item.children.length > 0
                    const isExpanded = expandedMenus.includes(item.key)
                    const isActive =
                      item.isActive ||
                      item.children?.some((child) => child.isActive) ||
                      false

                    if (hasChildren) {
                      return (
                        <Collapsible
                          key={item.key}
                          open={isExpanded}
                          onOpenChange={(open) => handleToggle(item.key, open)}
                        >
                          <SidebarMenuItem>
                            <CollapsibleTrigger asChild>
                              <SidebarMenuButton isActive={isActive}>
                                <item.icon className="size-4" />
                                <span>{item.title}</span>
                                <ChevronRight
                                  className={cn(
                                    "ml-auto size-4 transition-transform",
                                    isExpanded && "rotate-90"
                                  )}
                                />
                              </SidebarMenuButton>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <SidebarMenuSub>
                                {item.children?.map((child) => (
                                  <SidebarMenuSubItem key={child.key}>
                                    <SidebarMenuSubButton
                                      href={child.href}
                                      isActive={child.isActive}
                                    >
                                      <span>{child.title}</span>
                                      {child.badge ? (
                                        <Badge
                                          variant="secondary"
                                          className="ml-auto"
                                        >
                                          {child.badge}
                                        </Badge>
                                      ) : null}
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                ))}
                              </SidebarMenuSub>
                            </CollapsibleContent>
                          </SidebarMenuItem>
                        </Collapsible>
                      )
                    }

                    return (
                      <SidebarMenuItem key={item.key}>
                        <SidebarMenuButton asChild={!!item.href}>
                          {item.href ? (
                            <Link href={item.href}>
                              <item.icon className="size-4" />
                              <span>{item.title}</span>
                            </Link>
                          ) : (
                            <>
                              <item.icon className="size-4" />
                              <span>{item.title}</span>
                            </>
                          )}
                        </SidebarMenuButton>
                        {item.badge ? (
                          <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
                        ) : null}
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarSeparator />
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton>
                    <Avatar className="size-8">
                      <AvatarImage src="https://i.pravatar.cc/120?img=5" alt="用户头像" />
                      <AvatarFallback>CB</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col text-left">
                      <span className="text-sm font-medium">Allan｜CBODY</span>
                      <span className="text-xs text-muted-foreground">
                        ops@cbody.io
                      </span>
                    </div>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>快速操作</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="#profile">个人中心</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="#preferences">主题设置</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive">
                    登出账号
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="border-border/60 bg-background/75 sticky top-0 z-10 flex h-16 shrink-0 items-center gap-4 border-b px-4 backdrop-blur-sm md:px-8">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="md:hidden" />
            <Separator orientation="vertical" className="h-6" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="#">控制台</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>智能营运主页</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon">
              <Bell className="size-4" />
            </Button>
            <Button variant="outline" className="hidden sm:inline-flex">
              快速导出报告
            </Button>
            <Button>新建增长计划</Button>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-6 p-4 md:px-8 md:py-6">
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
                  <CardDescription>移动端 + Web 全渠道</CardDescription>
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
                  <CardTitle>核心增长指标</CardTitle>
                  <CardDescription>实时监控用户活跃与回访趋势</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">近 6 个月</Badge>
                  <Badge variant="outline" className="hidden sm:inline-flex">
                    日志自动校准
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
                      dataKey="active"
                      type="monotone"
                      stroke="var(--color-active)"
                      fill="var(--color-active)"
                      fillOpacity={0.2}
                    />
                    <Area
                      dataKey="returning"
                      type="monotone"
                      stroke="var(--color-returning)"
                      fill="var(--color-returning)"
                      fillOpacity={0.16}
                    />
                    <ChartLegend
                      verticalAlign="bottom"
                      content={<ChartLegendContent />}
                    />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
              <CardFooter className="flex flex-col gap-3 border-t border-border/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xs">
                    AI 推荐
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    建议重点关注 8 月回访用户增幅，适合发起复购激励。
                  </span>
                </div>
                <Button variant="ghost" className="gap-2">
                  查看流失预警
                  <ChevronRight className="size-4" />
                </Button>
              </CardFooter>
            </Card>

            <Card className="border-border/60">
              <CardHeader>
                <CardTitle>团队执行进度</CardTitle>
                <CardDescription>跨团队协同项目实时追踪</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {teamProgress.map((item) => (
                  <div key={item.key} className="rounded-lg border border-border/60 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.owner}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {item.eta}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <Progress value={item.completion} className="h-1.5" />
                      <span className="text-xs text-muted-foreground">
                        {item.completion}%
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full">
                  查看全部项目
                </Button>
              </CardFooter>
            </Card>
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="border-border/60 lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>实时动态</CardTitle>
                  <CardDescription>系统消息、客户触点与 AI 建议</CardDescription>
                </div>
                <Badge variant="outline">同步至移动端</Badge>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[260px]">
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

            <Card className="border-border/60">
              <CardHeader>
                <CardTitle>重点关注</CardTitle>
                <CardDescription>用数据驱动下一步决策</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="rounded-xl bg-muted/40 p-4">
                  <p className="text-sm font-medium">流量投放 ROI</p>
                  <p className="mt-1 text-2xl font-semibold">3.42</p>
                  <p className="text-xs text-muted-foreground">
                    相比上周提升 12%，建议提升社交渠道预算权重。
                  </p>
                </div>
                <div className="rounded-xl bg-muted/40 p-4">
                  <p className="text-sm font-medium">重点客户唤醒</p>
                  <p className="mt-1 text-2xl font-semibold">86%</p>
                  <p className="text-xs text-muted-foreground">
                    智能客服将在今晚批量推送唤醒短信，记得复核文案。
                  </p>
                </div>
                <Button variant="ghost" className="justify-start gap-2">
                  <Settings className="size-4" />
                  自定义指标看板
                </Button>
              </CardContent>
            </Card>
          </section>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function DashboardBranding() {
  return (
    <div className="flex items-center gap-3 px-4 py-6">
      <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
        <Sparkle className="size-5" />
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-semibold">CBODY Ops</span>
        <span className="text-xs text-muted-foreground">Enterprise</span>
      </div>
    </div>
  )
}
