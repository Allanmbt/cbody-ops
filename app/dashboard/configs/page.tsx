"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LoadingSpinner } from "@/components/ui/loading"
import { ChevronRight, DollarSign, Map, Bell, Globe } from "lucide-react"
import { toast } from "sonner"
import { getConfigsList } from "./actions"
import type { AppConfig } from "@/lib/features/configs"

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
  const [configs, setConfigs] = useState<AppConfig[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadConfigs() {
      try {
        const result = await getConfigsList()
        if (result.ok && result.data) {
          setConfigs(result.data)
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

  // 检查配置是否存在
  const isConfigActive = (namespace: string, config_key: string): boolean => {
    return configs.some(
      (c) => c.namespace === namespace && c.config_key === config_key && c.is_active
    )
  }

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
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
          {configCards.map((card) => {
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
