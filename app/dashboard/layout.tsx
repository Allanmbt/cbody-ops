"use client"

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"
import NProgress from "nprogress"
import "nprogress/nprogress.css"
import {
  ChevronRight,
  LayoutDashboard,
  Settings,
  Sparkle,
  Users,
  Workflow,
  Shield,
  Briefcase,
  UserCheck,
  Image,
  Activity,
  UserCog,
  MessageSquare,
  AlertTriangle,
  Star,
  Moon,
  Sun,
  Wallet,
  Receipt,
  CreditCard,
  ArrowUpDown,
  Menu,
  BarChart3,
  ClipboardList,
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
import { useSidebar } from "@/components/ui/sidebar"
import { useTheme } from "next-themes"
import { LocaleProvider, useLocale } from "@/lib/i18n/LocaleProvider"
import { LocaleSwitcher } from "@/components/LocaleSwitcher"
import { t } from "@/lib/i18n"

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

// 生成侧边栏菜单配置（支持多语言）
function getSidebarGroups(translations: any): {
  label: string
  items: SidebarNavItem[]
}[] {
  return [
    {
      label: t(translations, 'nav.groups.system'),
      items: [
        {
          key: "dashboard",
          title: t(translations, 'nav.items.dashboard'),
          icon: LayoutDashboard,
          href: "/dashboard",
        },
        {
          key: "management",
          title: t(translations, 'nav.items.management'),
          icon: Shield,
          href: "/dashboard/management",
          requiredRole: ['superadmin'],
        },
      ],
    },
    {
      label: t(translations, 'nav.groups.aloha'),
      items: [
        {
          key: "aloha",
          title: t(translations, 'nav.items.alohaManagement'),
          icon: Sparkle,
          href: "/dashboard/aloha",
          requiredRole: ['support'],
        },
      ],
    },
    {
      label: t(translations, 'nav.groups.cbody'),
      items: [
        {
          key: "cbody",
          title: t(translations, 'nav.items.cbodyManagement'),
          icon: UserCog,
          href: "/dashboard/cbody",
          requiredRole: ['support'],
        },
      ],
    },
    {
      label: t(translations, 'nav.groups.operations'),
      items: [
        {
          key: "operations-orders",
          title: t(translations, 'nav.items.ordersMonitor'),
          icon: Activity,
          href: "/dashboard/operations/orders",
          requiredRole: ['superadmin', 'admin', 'support'],
        },
        {
          key: "operations-therapists",
          title: t(translations, 'nav.items.therapistsStatus'),
          icon: UserCog,
          href: "/dashboard/operations/therapists",
          requiredRole: ['superadmin', 'admin', 'support'],
        },
        {
          key: "operations-chats",
          title: t(translations, 'nav.items.chatsMonitor'),
          icon: MessageSquare,
          href: "/dashboard/operations/chats",
          requiredRole: ['superadmin', 'admin', 'support'],
        },
        {
          key: "operations-reports",
          title: t(translations, 'nav.items.reportsHandle'),
          icon: AlertTriangle,
          href: "/dashboard/operations/reports",
          requiredRole: ['superadmin', 'admin', 'support'],
        },
        {
          key: "operations-reviews",
          title: t(translations, 'nav.items.reviewsAudit'),
          icon: Star,
          href: "/dashboard/operations/reviews",
          requiredRole: ['superadmin', 'admin', 'support'],
        },
      ],
    },
    {
      label: t(translations, 'nav.groups.business'),
      items: [
        {
          key: "girls-management",
          title: t(translations, 'nav.items.girlsManagement'),
          icon: Users,
          href: "/dashboard/girls",
          requiredRole: ['superadmin', 'admin', 'support'],
        },
        {
          key: "media-management",
          title: t(translations, 'nav.items.mediaManagement'),
          icon: Image,
          href: "/dashboard/media",
          requiredRole: ['superadmin', 'admin'],
        },
        {
          key: "services-management",
          title: t(translations, 'nav.items.servicesManagement'),
          icon: Briefcase,
          href: "/dashboard/services",
          requiredRole: ['superadmin', 'admin'],
        },
        {
          key: "users-management",
          title: t(translations, 'nav.items.usersManagement'),
          icon: UserCheck,
          href: "/dashboard/users",
          requiredRole: ['superadmin', 'admin'],
        },
        {
          key: "orders-management",
          title: t(translations, 'nav.items.ordersManagement'),
          icon: Workflow,
          href: "/dashboard/orders",
          requiredRole: ['superadmin', 'admin', 'finance', 'support'],
        },
        {
          key: "girl-attendance",
          title: t(translations, 'nav.items.girlAttendance'),
          icon: ClipboardList,
          href: "/dashboard/business/girl-attendance",
          requiredRole: ['superadmin', 'admin'],
        },
      ],
    },
    {
      label: t(translations, 'nav.groups.finance'),
      items: [
        {
          key: "finance-settlements",
          title: t(translations, 'nav.items.settlementsVerify'),
          icon: Receipt,
          href: "/dashboard/finance/settlements",
          requiredRole: ['superadmin', 'admin', 'finance'],
        },
        {
          key: "finance-accounts",
          title: t(translations, 'nav.items.accountsManagement'),
          icon: Users,
          href: "/dashboard/finance/accounts",
          requiredRole: ['superadmin', 'admin', 'finance'],
        },
        {
          key: "finance-transactions",
          title: t(translations, 'nav.items.transactionsManagement'),
          icon: ArrowUpDown,
          href: "/dashboard/finance/transactions",
          requiredRole: ['superadmin', 'admin', 'finance'],
        },
        {
          key: "finance-stats",
          title: t(translations, 'nav.items.financeStats'),
          icon: BarChart3,
          href: "/dashboard/finance/stats",
          requiredRole: ['superadmin', 'admin', 'finance'],
        },
      ],
    },
    {
      label: t(translations, 'nav.groups.settings'),
      items: [
        {
          key: "configs",
          title: t(translations, 'nav.items.configsManagement'),
          icon: Settings,
          href: "/dashboard/configs",
          requiredRole: ['superadmin', 'admin'],
        },
      ],
    },
  ]
}

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

function getBreadcrumbFromPath(pathname: string, translations: any): Array<{ label: string; href?: string }> {
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length === 1) {
    return [{ label: t(translations, 'nav.breadcrumbs.overview') }]
  }

  const breadcrumbs: Array<{ label: string; href?: string }> = []

  if (segments[1] === 'management') {
    breadcrumbs.push({ label: t(translations, 'nav.breadcrumbs.management') })
  } else if (segments[1] === 'aloha') {
    breadcrumbs.push({ label: t(translations, 'nav.breadcrumbs.aloha') })
  } else if (segments[1] === 'cbody') {
    breadcrumbs.push({ label: t(translations, 'nav.breadcrumbs.cbody') })
  } else if (segments[1] === 'operations') {
    breadcrumbs.push({ label: t(translations, 'nav.breadcrumbs.operations') })
    if (segments[2] === 'orders') {
      breadcrumbs.push({ label: t(translations, 'nav.breadcrumbs.ordersMonitor'), href: "/dashboard/operations/orders" })
    } else if (segments[2] === 'therapists') {
      breadcrumbs.push({ label: t(translations, 'nav.breadcrumbs.therapistsStatus'), href: "/dashboard/operations/therapists" })
    } else if (segments[2] === 'chats') {
      breadcrumbs.push({ label: t(translations, 'nav.breadcrumbs.chatsMonitor'), href: "/dashboard/operations/chats" })
    } else if (segments[2] === 'reports') {
      breadcrumbs.push({ label: t(translations, 'nav.breadcrumbs.reportsHandle'), href: "/dashboard/operations/reports" })
    } else if (segments[2] === 'reviews') {
      breadcrumbs.push({ label: t(translations, 'nav.breadcrumbs.reviewsAudit'), href: "/dashboard/operations/reviews" })
    }
  } else if (segments[1] === 'girls') {
    breadcrumbs.push({ label: t(translations, 'nav.breadcrumbs.girlsManagement') })
  } else if (segments[1] === 'media') {
    breadcrumbs.push({ label: t(translations, 'nav.breadcrumbs.mediaManagement') })
  } else if (segments[1] === 'services') {
    breadcrumbs.push({ label: t(translations, 'nav.breadcrumbs.servicesManagement') })
  } else if (segments[1] === 'users') {
    breadcrumbs.push({ label: t(translations, 'nav.breadcrumbs.usersManagement') })
  } else if (segments[1] === 'orders') {
    breadcrumbs.push({ label: t(translations, 'nav.breadcrumbs.ordersManagement') })
  } else if (segments[1] === 'business') {
    breadcrumbs.push({ label: t(translations, 'nav.breadcrumbs.business') })
    if (segments[2] === 'girl-attendance') {
      breadcrumbs.push({ label: t(translations, 'nav.breadcrumbs.girlAttendance') })
    }
  } else if (segments[1] === 'finance') {
    breadcrumbs.push({ label: t(translations, 'nav.breadcrumbs.finance'), href: "/dashboard/finance" })
    if (segments[2] === 'stats') {
      breadcrumbs.push({ label: t(translations, 'nav.breadcrumbs.financeStats') })
    } else if (segments[2] === 'accounts') {
      breadcrumbs.push({ label: t(translations, 'nav.breadcrumbs.accountsManagement'), href: "/dashboard/finance/accounts" })
      if (segments[3]) {
        breadcrumbs.push({ label: t(translations, 'nav.breadcrumbs.accountDetail') })
      }
    } else if (segments[2] === 'settlements') {
      breadcrumbs.push({ label: t(translations, 'nav.breadcrumbs.settlementsVerify') })
    } else if (segments[2] === 'transactions') {
      breadcrumbs.push({ label: t(translations, 'nav.breadcrumbs.transactionsManagement') })
    }
  } else if (segments[1] === 'configs') {
    breadcrumbs.push({ label: t(translations, 'nav.breadcrumbs.configsManagement') })
    if (segments[2] === 'fare') {
      breadcrumbs.push({ label: t(translations, 'nav.breadcrumbs.fareConfig'), href: "/dashboard/configs/fare" })
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

  // ✅ 优化：路由切换时显示加载条
  useEffect(() => {
    // 配置 NProgress
    NProgress.configure({
      showSpinner: false,
      trickleSpeed: 200,
      minimum: 0.08
    })

    // 监听所有链接点击
    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('a')
      if (link && link.href && link.href.startsWith(window.location.origin)) {
        NProgress.start()
      }
    }

    document.addEventListener('click', handleLinkClick)

    // 路由切换完成
    NProgress.done()

    return () => {
      document.removeEventListener('click', handleLinkClick)
      NProgress.done()
    }
  }, [pathname])

  // ✅ 优化：预加载常用页面，提升切换速度
  useEffect(() => {
    // 预加载最常访问的页面
    router.prefetch('/dashboard/operations/orders')
    router.prefetch('/dashboard/operations/therapists')
    router.prefetch('/dashboard/management')
    router.prefetch('/dashboard/girls')
    router.prefetch('/dashboard/operations/reviews')
  }, [router])

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

  if (loading) {
    return <PageLoading text="正在验证用户身份..." />
  }

  if (!adminProfile) {
    return null
  }

  return (
    <LocaleProvider>
      <DashboardLayoutWithLocale
        pathname={pathname}
        adminProfile={adminProfile}
        handleSignOut={handleSignOut}
      >
        {children}
      </DashboardLayoutWithLocale>
    </LocaleProvider>
  )
}

// 包含多语言支持的布局组件
function DashboardLayoutWithLocale({
  pathname,
  adminProfile,
  handleSignOut,
  children
}: {
  pathname: string
  adminProfile: AdminProfile
  handleSignOut: () => void
  children: React.ReactNode
}) {
  const { t: translations } = useLocale()

  const hasAccess = (requiredRoles?: AdminRole[]) => {
    if (!adminProfile || !requiredRoles) return true

    // 特殊处理：display_name 为 AlohaAdmin 的 support 角色只能访问 aloha 菜单
    if (adminProfile.display_name === 'AlohaAdmin' && adminProfile.role === 'support') {
      return false
    }

    // 特殊处理：display_name 为 cbodyAdmin 的 support 角色只能访问 cbody 菜单
    if (adminProfile.display_name === 'cbodyAdmin' && adminProfile.role === 'support') {
      return false
    }

    // 特殊处理：客服mumu只能访问运营管理的三个功能
    if (adminProfile.display_name === 'mumu' && adminProfile.role === 'support') {
      return false
    }

    return requiredRoles.includes(adminProfile.role)
  }

  const sidebarGroups = getSidebarGroups(translations)

  const filteredSidebarGroups = sidebarGroups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      // AlohaAdmin 特殊处理：只显示 aloha 菜单项
      if (adminProfile?.display_name === 'AlohaAdmin' && adminProfile.role === 'support') {
        return item.key === 'aloha'
      }
      // cbodyAdmin 特殊处理：只显示 cbody 菜单项
      if (adminProfile?.display_name === 'cbodyAdmin' && adminProfile.role === 'support') {
        return item.key === 'cbody'
      }
      // 客服mumu特殊处理：只显示运营管理的订单监控、技师状态、会话监管
      if (adminProfile?.display_name === 'mumu' && adminProfile.role === 'support') {
        return ['operations-orders', 'operations-therapists', 'operations-chats'].includes(item.key)
      }
      // 其他管理员隐藏 aloha 和 cbody 菜单项
      if (item.key === 'aloha' || item.key === 'cbody') {
        return false
      }
      return hasAccess(item.requiredRole)
    })
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

  const breadcrumb = getBreadcrumbFromPath(pathname, translations)

  return (
    <SidebarProvider>
      <DashboardLayoutContent
        filteredSidebarGroups={filteredSidebarGroups}
        expandedMenus={expandedMenus}
        handleToggle={handleToggle}
        pathname={pathname}
        breadcrumb={breadcrumb}
        adminProfile={adminProfile}
        handleSignOut={handleSignOut}
        translations={translations}
      >
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  )
}

interface DashboardLayoutContentProps {
  filteredSidebarGroups: ReturnType<typeof getSidebarGroups>
  expandedMenus: string[]
  handleToggle: (key: string, open: boolean) => void
  pathname: string
  breadcrumb: Array<{ label: string; href?: string }>
  adminProfile: AdminProfile
  handleSignOut: () => void
  translations: any
  children: React.ReactNode
}

function DashboardLayoutContent({
  filteredSidebarGroups,
  expandedMenus,
  handleToggle,
  pathname,
  breadcrumb,
  adminProfile,
  handleSignOut,
  translations,
  children
}: DashboardLayoutContentProps) {
  const { setOpenMobile } = useSidebar()
  const { theme, setTheme } = useTheme()

  // ✅ 优化：移动端路由切换时自动关闭侧边栏
  useEffect(() => {
    setOpenMobile(false)
  }, [pathname, setOpenMobile])

  const hasAccess = (requiredRoles?: AdminRole[]) => {
    if (!adminProfile || !requiredRoles) return true

    // 特殊处理：display_name 为 AlohaAdmin 的 support 角色只能访问 aloha 菜单
    if (adminProfile.display_name === 'AlohaAdmin' && adminProfile.role === 'support') {
      return false
    }

    // 特殊处理：display_name 为 cbodyAdmin 的 support 角色只能访问 cbody 菜单
    if (adminProfile.display_name === 'cbodyAdmin' && adminProfile.role === 'support') {
      return false
    }

    // 特殊处理：客服mumu只能访问运营管理的三个功能
    if (adminProfile.display_name === 'mumu' && adminProfile.role === 'support') {
      return false
    }

    return requiredRoles.includes(adminProfile.role)
  }

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <>
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
            <SidebarTrigger className="md:hidden">
              <Menu className="h-5 w-5" />
            </SidebarTrigger>
            <Separator orientation="vertical" className="h-6" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/dashboard">
                      {t(translations, 'nav.items.dashboard')}
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
            <LocaleSwitcher />
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
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
    </>
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