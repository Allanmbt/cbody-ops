"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LoadingSpinner } from "@/components/ui/loading"
import { Switch } from "@/components/ui/switch"
import { ChevronRight, DollarSign, Bell, Globe, MessageSquare, Trash2, Images } from "lucide-react"
import { toast } from "sonner"
import { getConfigsList } from "./actions"
import { saveIOSIncallConfig } from "./visit-actions"
import type { AppConfig } from "@/lib/features/configs"
import { IOS_INCALL_CONFIG } from "@/lib/features/configs/visit"
import { useCurrentAdmin } from "@/hooks/use-current-admin"

// 配置项卡片数据
interface ConfigCard {
  key: string
  title: string
  description: string
  icon: React.ReactNode
  href: string
  badge?: string
  namespace: string
  config_key: string
}

const configCards: ConfigCard[] = [
  {
    key: "slides",
    title: "首页幻灯片",
    description: "管理首页最多 3 张幻灯片图片及点击跳转",
    icon: <Images className="size-8" />,
    href: "/dashboard/configs/slides",
    badge: "已启用",
    namespace: "home",
    config_key: "slides",
  },
  {
    key: "fare",
    title: "车费计价配置",
    description: "管理订单车费计算规则、基础费用、距离分档定价和环境因素加价",
    icon: <DollarSign className="size-8" />,
    href: "/dashboard/configs/fare",
    badge: "已启用",
    namespace: "fare",
    config_key: "params.v1",
  },
  // 预留更多配置项
  {
    key: "bank-accounts",
    title: "平台收款银行卡配置",
    description: "管理平台收款银行卡信息，控制是否显示给客户和技师",
    icon: <DollarSign className="size-8" />,
    href: "/dashboard/configs/bank-accounts",
    badge: "已启用",
    namespace: "settlement",
    config_key: "bank_accounts",
  },
  {
    key: "chat-cleanup",
    title: "聊天记录清理",
    description: "管理和清理系统聊天记录，删除无效线程和超过90天的消息及图片",
    icon: <Trash2 className="size-8" />,
    href: "/dashboard/configs/chat-cleanup",
    badge: "超级管理员",
    namespace: "system",
    config_key: "chat_cleanup",
  },
  {
    key: "quick-replies",
    title: "快捷回复配置",
    description: "维护聊天快捷回复分类、三语内容、排序权重和启停状态",
    icon: <MessageSquare className="size-8" />,
    href: "/dashboard/configs/quick-replies",
    badge: "已启用",
    namespace: "chat",
    config_key: "quick_replies",
  },
  {
    key: "notification",
    title: "通知推送配置",
    description: "管理消息推送、邮件通知和短信服务配置",
    icon: <Bell className="size-8" />,
    href: "/dashboard/configs/notification",
    badge: "即将开放",
    namespace: "notification",
    config_key: "settings.v1",
  },
  {
    key: "i18n",
    title: "国际化配置",
    description: "管理多语言支持、货币汇率和地区显示设置",
    icon: <Globe className="size-8" />,
    href: "/dashboard/configs/i18n",
    badge: "即将开放",
    namespace: "i18n",
    config_key: "locale.v1",
  },
]

export default function ConfigsPage() {
  const { admin, loading: adminLoading } = useCurrentAdmin()
  const [configs, setConfigs] = useState<AppConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [iosIncallEnabled, setIOSIncallEnabled] = useState<boolean | null>(null)
  const [savingIOSIncall, setSavingIOSIncall] = useState(false)
  const canManageIOSIncall = admin?.role === "superadmin" || admin?.role === "admin"

  useEffect(() => {
    async function loadConfigs() {
      try {
        const result = await getConfigsList()
        if (result.ok && result.data) {
          setConfigs(result.data)
          const config = result.data.find((item) =>
            item.namespace === IOS_INCALL_CONFIG.namespace &&
            item.config_key === IOS_INCALL_CONFIG.config_key &&
            item.scope === IOS_INCALL_CONFIG.scope &&
            item.scope_id === IOS_INCALL_CONFIG.scope_id &&
            item.locale === IOS_INCALL_CONFIG.locale &&
            item.dtype === IOS_INCALL_CONFIG.dtype
          )
          setIOSIncallEnabled(config ? config.value_json?.enabled === true : true)
        } else {
          toast.error(result.error || "获取配置列表失败")
        }
      } catch (error) {
        console.error("加载配置失败:", error)
        toast.error("加载配置列表失败")
      } finally {
        setLoading(false)
      }
    }

    loadConfigs()
  }, [])

  async function handleIOSIncallChange(enabled: boolean) {
    setSavingIOSIncall(true)
    try {
      const result = await saveIOSIncallConfig(enabled)
      if (!result.ok) {
        toast.error(result.error || "保存 iOS Visit 配置失败")
        return
      }
      setIOSIncallEnabled(enabled)
      toast.success(enabled ? "iOS Visit 已开启" : "iOS Visit 已关闭")
    } catch {
      toast.error("网络错误，请稍后重试")
    } finally {
      setSavingIOSIncall(false)
    }
  }

  // 检查配置是否存在
  const isConfigActive = (namespace: string, config_key: string): boolean => {
    return configs.some(
      (c) => c.namespace === namespace && c.config_key === config_key && c.is_active
    )
  }

  // 过滤配置卡片（聊天清理仅超级管理员可见）
  const visibleCards = configCards.filter(card => {
    if (card.key === 'slides') {
      return admin?.role === 'superadmin' || admin?.role === 'admin'
    }
    if (card.key === 'chat-cleanup') {
      return admin?.role === 'superadmin'
    }
    return true
  })

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">配置管理</h1>
        <p className="text-muted-foreground mt-2">
          管理系统核心配置参数和业务规则
        </p>
      </div>

      {/* 配置项网格 */}
      {loading || adminLoading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
          {canManageIOSIncall && (
            <Card>
              <CardHeader>
                <CardTitle>
                  <label htmlFor="ios-incall">iOS 显示 Visit / Incall</label>
                </CardTitle>
                <CardDescription id="ios-incall-description">
                  控制 iOS 客户端的到店服务入口。Android 和网页端照常显示。
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <Switch
                  id="ios-incall"
                  aria-describedby="ios-incall-description"
                  checked={iosIncallEnabled ?? false}
                  disabled={iosIncallEnabled === null || savingIOSIncall}
                  onCheckedChange={handleIOSIncallChange}
                />
                <span className="text-sm text-muted-foreground" aria-live="polite">
                  {savingIOSIncall ? "保存中…" : iosIncallEnabled === null ? "配置读取失败" : iosIncallEnabled ? "开启" : "关闭"}
                </span>
              </CardContent>
            </Card>
          )}
          {visibleCards.map((card) => {
            const isActive = isConfigActive(card.namespace, card.config_key)
            const isDisabled = card.badge === "即将开放"

            return (
              <Card
                key={card.key}
                className={`group relative overflow-hidden transition-all hover:shadow-lg ${
                  isDisabled ? "opacity-60" : "cursor-pointer"
                }`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex size-14 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                        {card.icon}
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-xl">{card.title}</CardTitle>
                        <CardDescription className="mt-2">
                          {card.description}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      {card.badge && (
                        <Badge
                          variant={
                            card.badge === "已启用" ? "default" : "secondary"
                          }
                        >
                          {card.badge}
                        </Badge>
                      )}
                      {isActive && (
                        <Badge variant="outline" className="text-green-600">
                          已配置
                        </Badge>
                      )}
                    </div>
                    {!isDisabled ? (
                      <Link href={card.href}>
                        <Button variant="ghost" size="sm" className="gap-2">
                          进入配置
                          <ChevronRight className="size-4" />
                        </Button>
                      </Link>
                    ) : (
                      <Button variant="ghost" size="sm" disabled>
                        即将开放
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* 提示信息 */}
      <Card className="border-dashed">
        <CardContent className="py-6">
          <div className="flex items-start gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/20">
              <Globe className="size-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">配置说明</h3>
              <p className="text-sm text-muted-foreground mt-1">
                所有配置修改将实时生效，请谨慎操作。系统会自动记录所有配置变更的审计日志。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
