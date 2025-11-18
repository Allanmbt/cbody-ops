"use client"

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Bell,
  ChartBarStacked,
  ChevronRight,
  LayoutDashboard,
  LineChart,
  Settings,
  Sparkle,
  Users,
  Workflow,
  Shield,
  Briefcase,
  UserCheck,
  Image,
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
import { signOut, isSuperAdmin } from "@/lib/auth"
import { getSupabaseClient } from "@/lib/supabase"
import type { AdminProfile, AdminRole } from "@/lib/types/admin"
import type { LucideIcon } from "lucide-react"
import { toast } from "sonner"
import { PageLoading } from "@/components/ui/loading"

type SidebarNavChild = {
  key: string
  title: string
  href: string
  isActive?: boolean
  badge?: string
  requiredRole?: AdminRole[]
}

type SidebarNavItem = {
  key: string
  title: string
  icon: LucideIcon
  href?: string
  badge?: string
  isActive?: boolean
  children?: SidebarNavChild[]
  requiredRole?: AdminRole[]
}

const sidebarGroups: {
  label: string
  items: SidebarNavItem[]
}[] = [
    {
      label: "系统管理",
      items: [
        {
          key: "dashboard",
          title: "仪表盘",
          icon: LayoutDashboard,
          href: "/dashboard",
        },
        {
          key: "management",
          title: "管理员管理",
          icon: Shield,
          href: "/dashboard/management",
          requiredRole: ['superadmin'],
        },
      ],
    },
    {
      label: "业务管理",
      items: [
        {
          key: "girls-management",
          title: "技师管理",
          icon: Users,
          href: "/dashboard/girls",
          requiredRole: ['superadmin', 'admin', 'support'],
        },
        {
          key: "media-management",
          title: "媒体管理",
          icon: Image,
          href: "/dashboard/media",
          requiredRole: ['superadmin', 'admin'],
        },
        {
          key: "services-management",
          title: "服务管理",
          icon: Briefcase,
          href: "/dashboard/services",
          requiredRole: ['superadmin', 'admin'],
        },
        {
          key: "users-management",
          title: "用户管理",
          icon: UserCheck,
          href: "/dashboard/users",
          requiredRole: ['superadmin', 'admin'],
        },
        {
          key: "orders-management",
          title: "订单管理",
          icon: Workflow,
          href: "/dashboard/orders",
          requiredRole: ['superadmin', 'admin', 'finance', 'support'],
        },
      ],
    },
    {
      label: "数据分析",
      items: [
        {
          key: "reports",
          title: "财务报表",
          icon: ChartBarStacked,
          href: "/dashboard/reports",
          requiredRole: ['superadmin', 'finance'],
        },
        {
          key: "analytics",
          title: "数据洞察",
          icon: LineChart,
          href: "/dashboard/analytics",
          requiredRole: ['superadmin', 'admin'],
        },
      ],
    },
    {
      label: "系统设置",
      items: [
        {
          key: "configs",
          title: "配置管理",
          icon: Settings,
          href: "/dashboard/configs",
          requiredRole: ['superadmin', 'admin'],
        },
      ],
    },
  ]

function getRoleDisplayName(role: AdminRole): string {
  switch (role) {
    case 'superadmin':
      return '超级管理员'
    case 'admin':
      return '管理员'
    case 'finance':
      return '财务'
    case 'support':
      return '客服'
    default:
      return '未知角色'
  }
}

function getBreadcrumbFromPath(pathname: string): Array<{ label: string; href?: string }> {
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length === 1) {
    return [{ label: "概览" }]
  }

  const breadcrumbs: Array<{ label: string; href?: string }> = []

  if (segments[1] === 'management') {
    breadcrumbs.push({ label: "管理员管理" })
  } else if (segments[1] === 'girls') {
    breadcrumbs.push({ label: "技师管理" })
  } else if (segments[1] === 'media') {
    breadcrumbs.push({ label: "媒体管理" })
  } else if (segments[1] === 'services') {
    breadcrumbs.push({ label: "服务管理" })
  } else if (segments[1] === 'users') {
    breadcrumbs.push({ label: "用户管理" })
  } else if (segments[1] === 'orders') {
    breadcrumbs.push({ label: "订单管理" })
  } else if (segments[1] === 'reports') {
    breadcrumbs.push({ label: "财务报表" })
  } else if (segments[1] === 'analytics') {
    breadcrumbs.push({ label: "数据洞察" })
  } else if (segments[1] === 'configs') {
    breadcrumbs.push({ label: "配置管理" })
    if (segments[2] === 'fare') {
      breadcrumbs.push({ label: "车费计价配置", href: "/dashboard/configs/fare" })
    }
  }

  return breadcrumbs
}

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkAuth() {
      try {
        const supabase = getSupabaseClient()

        // 获取当前 session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError || !session?.user) {
          router.push('/login')
          return
        }

        // 查询管理员信息（使用 RLS，自动验证当前用户）
        const { data: adminData, error: profileError } = await supabase
          .from('admin_profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()

        if (profileError || !adminData) {
          await supabase.auth.signOut()
          router.push('/login')
          return
        }

        const profile = adminData as AdminProfile

        if (!profile.is_active) {
          await supabase.auth.signOut()
          toast.error("您的账号已被禁用")
          router.push('/login')
          return
        }

        setAdminProfile(profile)
      } catch (error) {
        console.error('[Dashboard] 权限验证失败:', error)
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [router])

  const handleSignOut = async () => {
    try {
      await signOut()
      toast.success("已安全退出")
      router.push('/login')
    } catch (error) {
      toast.error("退出登录失败")
      console.error('[Dashboard] 退出登录失败:', error)
    }
  }

  const hasAccess = (requiredRoles?: AdminRole[]) => {
    if (!adminProfile || !requiredRoles) return true
    return requiredRoles.includes(adminProfile.role)
  }

  const filteredSidebarGroups = sidebarGroups.map(group => ({
    ...group,
    items: group.items.filter(item => hasAccess(item.requiredRole))
  })).filter(group => group.items.length > 0)

  const initialExpanded = React.useMemo(() => {
    return filteredSidebarGroups
      .flatMap((group) => group.items)
      .filter((item) =>
        item.children?.some((child) => child.href === pathname) ||
        item.href === pathname ||
        item.children?.some((child) => child.isActive) ||
        item.isActive
      )
      .map((item) => item.key)
  }, [filteredSidebarGroups, pathname])

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

  const breadcrumb = getBreadcrumbFromPath(pathname)

  if (loading) {
    return <PageLoading text="正在验证用户身份..." />
  }

  if (!adminProfile) {
    return null
  }

  return (
    <SidebarProvider>
      <Sidebar variant="floating" collapsible="icon">
        <SidebarHeader>
          <DashboardBranding />
        </SidebarHeader>
        <SidebarContent>
          {filteredSidebarGroups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const hasChildren = item.children && item.children.length > 0
                    const isExpanded = expandedMenus.includes(item.key)
                    const isActive = item.href === pathname ||
                      item.children?.some((child) => child.href === pathname) ||
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
                                {item.children?.filter(child => hasAccess(child.requiredRole)).map((child) => (
                                  <SidebarMenuSubItem key={child.key}>
                                    <SidebarMenuSubButton
                                      href={child.href}
                                      isActive={child.href === pathname}
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
                            <Link href={item.href} className="flex w-full items-center gap-2">
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
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="flex flex-col">
        <header className="border-border/60 bg-background/75 sticky top-0 left-0 right-0 z-20 flex h-16 shrink-0 items-center gap-4 border-b px-4 backdrop-blur-sm md:px-8 min-w-0">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="md:hidden" />
            <Separator orientation="vertical" className="h-6" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/dashboard">
                      仪表盘
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {breadcrumb?.map((item, index) => (
                  <React.Fragment key={index}>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      {item.href ? (
                        <BreadcrumbLink asChild>
                          <Link href={item.href}>
                            {item.label}
                          </Link>
                        </BreadcrumbLink>
                      ) : (
                        <BreadcrumbPage>{item.label}</BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                  </React.Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="ml-auto flex items-center gap-2 min-w-0 flex-shrink-0">
            <Button variant="ghost" size="icon">
              <Bell className="size-4" />
            </Button>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 h-10 px-2 py-1 relative shrink-0">
                  <Avatar className="size-8 flex-shrink-0">
                    <AvatarImage src="" alt="用户头像" />
                    <AvatarFallback>{adminProfile.display_name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:flex flex-col text-left min-w-0">
                    <span className="text-sm font-medium truncate max-w-32">{adminProfile.display_name}</span>
                    <span className="text-xs text-muted-foreground truncate">
                      {getRoleDisplayName(adminProfile.role)}
                    </span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 z-[100] min-w-0"
                sideOffset={8}
                alignOffset={0}
                avoidCollisions={true}
                collisionPadding={16}
                side="bottom"
              >
                <DropdownMenuLabel className="px-3 py-2">快速操作</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isSuperAdmin(adminProfile.role) && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/management" className="px-3 py-2">管理员管理</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/profile" className="px-3 py-2">个人中心</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-red-600 px-3 py-2">
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-6 p-4 md:px-8 md:py-6 overflow-x-auto min-w-0">
          {children}
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
        <span className="text-xs text-muted-foreground">Management</span>
      </div>
    </div>
  )
}