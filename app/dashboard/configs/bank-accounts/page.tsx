"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { LoadingSpinner } from "@/components/ui/loading"
import { ArrowLeft, CreditCard, Check, X, ZoomIn } from "lucide-react"
import { toast } from "sonner"
import { getBankAccountsConfig, updateBankAccountsConfig } from "../actions"
import type { BankAccount, BankAccountsConfig } from "@/lib/features/configs"
import { useLocale } from "@/lib/i18n/LocaleProvider"
import { t } from "@/lib/i18n"

export default function BankAccountsConfigPage() {
  const router = useRouter()
  const { t: translations } = useLocale()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [configId, setConfigId] = useState<string>("")
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [selectedQR, setSelectedQR] = useState<{ url: string; name: string } | null>(null)

  // 加载配置
  useEffect(() => {
    async function loadConfig() {
      try {
        const result = await getBankAccountsConfig()
        if (result.ok && result.data) {
          setConfigId(result.data.id)
          const config = result.data.value_json as BankAccountsConfig
          setAccounts(config.accounts || [])
        } else {
          toast.error(result.error || t(translations, 'configs.bankAccounts.errorLoad'))
        }
      } catch (error) {
        console.error("[BankAccounts] 加载配置失败:", error)
        toast.error(t(translations, 'configs.bankAccounts.errorLoad'))
      } finally {
        setLoading(false)
      }
    }

    loadConfig()
  }, [translations])

  // 切换银行卡激活状态
  const handleToggleActive = async (accountId: string, currentActive: boolean) => {
    const newAccounts = accounts.map((acc) =>
      acc.id === accountId ? { ...acc, is_active: !currentActive } : acc
    )

    setSaving(true)
    try {
      const result = await updateBankAccountsConfig(configId, { accounts: newAccounts })
      if (result.ok) {
        setAccounts(newAccounts)
        toast.success(
          !currentActive
            ? t(translations, 'configs.bankAccounts.successActivated')
            : t(translations, 'configs.bankAccounts.successDeactivated')
        )
      } else {
        toast.error(result.error || t(translations, 'configs.bankAccounts.errorUpdate'))
      }
    } catch (error) {
      console.error("[BankAccounts] 更新失败:", error)
      toast.error(t(translations, 'configs.bankAccounts.errorUpdate'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {/* 页面标题 */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-bold">
            {t(translations, 'configs.bankAccounts.title')}
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            {t(translations, 'configs.bankAccounts.description')}
          </p>
        </div>
      </div>

      {/* 银行卡列表 */}
      <div className="grid gap-3 md:gap-4">
        {accounts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              {t(translations, 'configs.bankAccounts.noData')}
            </CardContent>
          </Card>
        ) : (
          accounts
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((account) => (
              <Card
                key={account.id}
                className={`transition-opacity ${!account.is_active ? "opacity-50" : ""}`}
              >
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-center gap-3 md:gap-4">
                    {/* 二维码头像（可点击放大） */}
                    <button
                      onClick={() => setSelectedQR({ url: account.qr_code_url, name: account.bank_name })}
                      className="relative size-14 md:size-16 shrink-0 rounded-lg border-2 border-border overflow-hidden bg-muted hover:border-primary transition-colors group"
                    >
                      {account.qr_code_url ? (
                        <>
                          <img
                            src={account.qr_code_url}
                            alt={`${account.bank_name} QR Code`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <ZoomIn className="size-5 text-white" />
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <CreditCard className="size-6 text-muted-foreground" />
                        </div>
                      )}
                    </button>

                    {/* 银行信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold text-base md:text-lg truncate">
                          {account.bank_name}
                        </h3>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {account.code}
                        </Badge>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs md:text-sm text-muted-foreground truncate">
                          {account.account_holder}
                        </p>
                        <p className="text-xs md:text-sm font-mono text-muted-foreground">
                          {account.account_number}
                        </p>
                      </div>
                    </div>

                    {/* 状态与开关 */}
                    <div className="flex flex-col md:flex-row items-end md:items-center gap-2 md:gap-3 shrink-0">
                      {account.is_active ? (
                        <Badge variant="default" className="gap-1 text-xs">
                          <Check className="size-3" />
                          <span className="hidden md:inline">
                            {t(translations, 'configs.bankAccounts.activated')}
                          </span>
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <X className="size-3" />
                          <span className="hidden md:inline">
                            {t(translations, 'configs.bankAccounts.deactivated')}
                          </span>
                        </Badge>
                      )}
                      <Switch
                        checked={account.is_active}
                        onCheckedChange={() => handleToggleActive(account.id, account.is_active)}
                        disabled={saving}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
        )}
      </div>

      {/* 说明信息 */}
      <Card className="border-dashed bg-muted/50">
        <CardContent className="p-4 md:p-6">
          <div className="flex gap-3 md:gap-4">
            <div className="flex size-8 md:size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CreditCard className="size-4 md:size-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm md:text-base font-semibold mb-2">
                {t(translations, 'configs.bankAccounts.configNotice')}
              </h3>
              <ul className="text-xs md:text-sm text-muted-foreground space-y-1">
                <li>• {t(translations, 'configs.bankAccounts.clickToZoom')}</li>
                <li>• {t(translations, 'configs.bankAccounts.activatedMsg')}</li>
                <li>• {t(translations, 'configs.bankAccounts.keepOneActive')}</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 二维码放大对话框 */}
      <Dialog open={!!selectedQR} onOpenChange={() => setSelectedQR(null)}>
        <DialogContent className="max-w-md">
          {selectedQR && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="text-center">{selectedQR.name}</DialogTitle>
              </DialogHeader>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  {t(translations, 'configs.bankAccounts.qrCodeTitle')}
                </p>
              </div>
              <div className="relative w-full aspect-square rounded-lg border bg-muted overflow-hidden">
                <img
                  src={selectedQR.url}
                  alt={`${selectedQR.name} QR Code`}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
