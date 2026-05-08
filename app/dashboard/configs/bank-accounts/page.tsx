"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, Check, CreditCard, Edit, ImagePlus, Plus, Trash2, X, ZoomIn } from "lucide-react"
import { toast } from "sonner"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { LoadingSpinner } from "@/components/ui/loading"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { getBankAccountsConfig, updateBankAccountsConfig, createBankAccount, updateBankAccount, deleteBankAccount } from "../actions"
import type { BankAccount, BankAccountsConfig } from "@/lib/features/configs"
import { useLocale } from "@/lib/i18n/LocaleProvider"
import { t } from "@/lib/i18n"
import { THAILAND_BANKS, type ThailandBank } from "@/types/banks"

const bankAccountFormSchema = z.object({
  code: z.string().min(1, "请选择银行"),
  account_holder: z.string().trim().min(1, "账户持有人不能为空"),
  account_number: z.string().trim().min(1, "账号不能为空"),
  sort_order: z.number().int("排序必须为整数").min(1, "排序必须为正整数"),
  is_active: z.boolean(),
})

type BankAccountFormData = z.infer<typeof bankAccountFormSchema>

function findBank(code: string) {
  return THAILAND_BANKS.find((bank) => bank.code === code)
}

function BankLogo({ bank, className = "size-9" }: { bank?: ThailandBank; className?: string }) {
  if (!bank?.logo) {
    return (
      <div className={`${className} flex shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground`}>
        <CreditCard className="size-4" />
      </div>
    )
  }

  return (
    <div
      className={`${className} flex shrink-0 items-center justify-center rounded-md border p-1.5`}
      style={{ backgroundColor: bank.color || undefined }}
    >
      <img src={bank.logo} alt={bank.name} className="max-h-full max-w-full object-contain" />
    </div>
  )
}

async function compressImageToJpeg(file: File, quality = 0.82): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const maxSide = 1600
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
      const canvas = document.createElement("canvas")
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        URL.revokeObjectURL(url)
        resolve(file)
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file)
            return
          }
          resolve(new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }))
        },
        "image/jpeg",
        quality
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file)
    }
    img.src = url
  })
}

function BankAccountDialog({
  configId,
  account,
  nextSortOrder,
  open,
  onOpenChange,
  onSaved,
}: {
  configId: string
  account: BankAccount | null
  nextSortOrder: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (config: BankAccountsConfig) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState("")
  const isEdit = Boolean(account)

  const form = useForm<BankAccountFormData>({
    resolver: zodResolver(bankAccountFormSchema),
    defaultValues: {
      code: account?.code || THAILAND_BANKS[0]?.code || "",
      account_holder: account?.account_holder || "",
      account_number: account?.account_number || "",
      sort_order: account?.sort_order || nextSortOrder,
      is_active: account?.is_active ?? true,
    },
  })

  useEffect(() => {
    if (!open) return
    form.reset({
      code: account?.code || THAILAND_BANKS[0]?.code || "",
      account_holder: account?.account_holder || "",
      account_number: account?.account_number || "",
      sort_order: account?.sort_order || nextSortOrder,
      is_active: account?.is_active ?? true,
    })
    setSelectedFile(null)
    setPreviewUrl("")
  }, [account, form, nextSortOrder, open])

  const selectedBank = findBank(form.watch("code"))

  const handleFileChange = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("请上传图片文件")
      return
    }
    const compressed = await compressImageToJpeg(file)
    setSelectedFile(compressed)
    setPreviewUrl(URL.createObjectURL(compressed))
  }

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen && previewUrl) URL.revokeObjectURL(previewUrl)
    onOpenChange(nextOpen)
  }

  const onSubmit = async (data: BankAccountFormData) => {
    if (!isEdit && !selectedFile) {
      toast.error("请上传收款二维码")
      return
    }

    const formData = new FormData()
    formData.set("code", data.code)
    formData.set("account_holder", data.account_holder)
    formData.set("account_number", data.account_number)
    formData.set("sort_order", data.sort_order.toString())
    formData.set("is_active", data.is_active ? "true" : "false")
    if (selectedFile) formData.set("qr_code_file", selectedFile)

    const result = isEdit && account
      ? await updateBankAccount(configId, account.id, formData)
      : await createBankAccount(configId, formData)

    if (!result.ok || !result.data) {
      toast.error(result.error || "保存失败")
      return
    }

    onSaved(result.data)
    handleClose(false)
    toast.success(isEdit ? "银行卡已更新" : "银行卡已添加")
    if (result.warning) toast.warning(result.warning)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "编辑银行卡" : "添加银行卡"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>银行</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择银行" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {THAILAND_BANKS.map((bank) => (
                        <SelectItem key={bank.code} value={bank.code}>
                          <span className="flex items-center gap-2">
                            <BankLogo bank={bank} className="size-6" />
                            <span>{bank.name}</span>
                            <span className="text-xs text-muted-foreground">{bank.code}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="rounded-md border p-3">
              <div className="flex items-center gap-3">
                <BankLogo bank={selectedBank} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{selectedBank?.name || "未选择银行"}</p>
                  <p className="text-xs text-muted-foreground">银行名称由 code 自动写入</p>
                </div>
              </div>
            </div>

            <FormField
              control={form.control}
              name="account_holder"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>账户持有人</FormLabel>
                  <FormControl>
                    <Input placeholder="Lamduan NongKaeo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="account_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>账号</FormLabel>
                  <FormControl>
                    <Input placeholder="670-1-477XX-X" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isEdit ? (
              <FormField
                control={form.control}
                name="sort_order"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>排序</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        value={field.value}
                        onChange={(event) => field.onChange(Number.parseInt(event.target.value, 10) || 1)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                排序将自动设置为 {nextSortOrder}
              </div>
            )}

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-md border p-3">
                  <FormLabel className="m-0">启用</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>收款二维码{isEdit ? "（不上传则保持原图）" : ""}</FormLabel>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex size-24 items-center justify-center overflow-hidden rounded-md border-2 border-dashed bg-muted/40 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  {previewUrl || account?.qr_code_url ? (
                    <img src={previewUrl || account?.qr_code_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImagePlus className="size-6" />
                  )}
                </button>
                <div className="text-xs text-muted-foreground">
                  <p>支持 JPG/PNG/WEBP，提交前压缩为 JPEG。</p>
                  <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => inputRef.current?.click()}>
                    选择图片
                  </Button>
                </div>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => handleFileChange(event.target.files?.[0])}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                取消
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "保存中..." : "保存"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default function BankAccountsConfigPage() {
  const router = useRouter()
  const { t: translations } = useLocale()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [configId, setConfigId] = useState("")
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [selectedQR, setSelectedQR] = useState<{ url: string; name: string } | null>(null)
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<BankAccount | null>(null)

  useEffect(() => {
    async function loadConfig() {
      try {
        const result = await getBankAccountsConfig()
        if (result.ok && result.data) {
          setConfigId(result.data.id)
          const config = result.data.value_json as BankAccountsConfig
          setAccounts(config.accounts || [])
        } else {
          toast.error(result.error || t(translations, "configs.bankAccounts.errorLoad"))
        }
      } catch (error) {
        console.error("[BankAccounts] 加载配置失败:", error)
        toast.error(t(translations, "configs.bankAccounts.errorLoad"))
      } finally {
        setLoading(false)
      }
    }

    loadConfig()
  }, [translations])

  const sortedAccounts = useMemo(
    () => [...accounts].sort((a, b) => a.sort_order - b.sort_order || a.code.localeCompare(b.code)),
    [accounts]
  )
  const nextSortOrder = useMemo(
    () => accounts.reduce((max, account) => Math.max(max, account.sort_order), 0) + 1,
    [accounts]
  )

  const handleToggleActive = async (accountId: string, currentActive: boolean) => {
    const newAccounts = accounts.map((acc) =>
      acc.id === accountId ? { ...acc, is_active: !currentActive } : acc
    )

    setSaving(true)
    try {
      const result = await updateBankAccountsConfig(configId, { accounts: newAccounts })
      if (result.ok && result.data) {
        setAccounts(result.data.accounts)
        toast.success(!currentActive ? "已激活银行卡" : "已停用银行卡")
      } else {
        toast.error(result.error || t(translations, "configs.bankAccounts.errorUpdate"))
      }
    } catch (error) {
      console.error("[BankAccounts] 更新失败:", error)
      toast.error(t(translations, "configs.bankAccounts.errorUpdate"))
    } finally {
      setSaving(false)
    }
  }

  const openCreateDialog = () => {
    setEditingAccount(null)
    setDialogOpen(true)
  }

  const openEditDialog = (account: BankAccount) => {
    setEditingAccount(account)
    setDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setSaving(true)
    try {
      const result = await deleteBankAccount(configId, deleteTarget.id)
      if (!result.ok || !result.data) {
        toast.error(result.error || "删除失败")
        return
      }
      setAccounts(result.data.accounts)
      setDeleteTarget(null)
      toast.success("银行卡已删除")
      if (result.warning) toast.warning(result.warning)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold md:text-2xl">
            {t(translations, "configs.bankAccounts.title")}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground md:text-sm">
            {t(translations, "configs.bankAccounts.description")}
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 size-4" />
          添加银行卡
        </Button>
      </div>

      <div className="grid gap-3 md:gap-4">
        {sortedAccounts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              {t(translations, "configs.bankAccounts.noData")}
            </CardContent>
          </Card>
        ) : (
          sortedAccounts.map((account) => {
            const bank = findBank(account.code)
            return (
              <Card key={account.id} className={`transition-opacity ${!account.is_active ? "opacity-60" : ""}`}>
                <CardContent className="p-4 md:p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-4">
                      <button
                        type="button"
                        onClick={() => setSelectedQR({ url: account.qr_code_url, name: account.bank_name })}
                        className="group relative size-14 shrink-0 overflow-hidden rounded-lg border-2 border-border bg-muted transition-colors hover:border-primary md:size-16"
                      >
                        {account.qr_code_url ? (
                          <>
                            <img src={account.qr_code_url} alt={`${account.bank_name} QR Code`} className="h-full w-full object-cover" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                              <ZoomIn className="size-5 text-white" />
                            </div>
                          </>
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <CreditCard className="size-6 text-muted-foreground" />
                          </div>
                        )}
                      </button>

                      <BankLogo bank={bank} />

                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-base font-semibold md:text-lg">{account.bank_name}</h3>
                          <Badge variant="outline" className="shrink-0 text-xs">{account.code}</Badge>
                          <Badge variant="secondary" className="shrink-0 text-xs">排序 {account.sort_order}</Badge>
                        </div>
                        <div className="space-y-0.5">
                          <p className="truncate text-xs text-muted-foreground md:text-sm">{account.account_holder}</p>
                          <p className="text-xs font-mono text-muted-foreground md:text-sm">{account.account_number}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 md:shrink-0">
                      {account.is_active ? (
                        <Badge variant="default" className="gap-1 text-xs">
                          <Check className="size-3" />
                          <span>{t(translations, "configs.bankAccounts.activated")}</span>
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <X className="size-3" />
                          <span>{t(translations, "configs.bankAccounts.deactivated")}</span>
                        </Badge>
                      )}
                      <Switch
                        checked={account.is_active}
                        onCheckedChange={() => handleToggleActive(account.id, account.is_active)}
                        disabled={saving}
                      />
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(account)}>
                        <Edit className="mr-2 size-4" />
                        编辑
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(account)}>
                        <Trash2 className="mr-2 size-4" />
                        删除
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      <Card className="border-dashed bg-muted/50">
        <CardContent className="p-4 md:p-6">
          <div className="flex gap-3 md:gap-4">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary md:size-10">
              <CreditCard className="size-4 md:size-5" />
            </div>
            <div className="flex-1">
              <h3 className="mb-2 text-sm font-semibold md:text-base">
                {t(translations, "configs.bankAccounts.configNotice")}
              </h3>
              <ul className="space-y-1 text-xs text-muted-foreground md:text-sm">
                <li>• {t(translations, "configs.bankAccounts.clickToZoom")}</li>
                <li>• {t(translations, "configs.bankAccounts.activatedMsg")}</li>
                <li>• 删除银行卡会同步删除该账号的二维码文件</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <BankAccountDialog
        configId={configId}
        account={editingAccount}
        nextSortOrder={nextSortOrder}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={(config) => setAccounts(config.accounts)}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除银行卡</AlertDialogTitle>
            <AlertDialogDescription>
              删除后会从配置中移除 {deleteTarget?.bank_name}，并同步删除该银行卡的二维码文件。此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={saving}>
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!selectedQR} onOpenChange={() => setSelectedQR(null)}>
        <DialogContent className="max-w-md">
          {selectedQR && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="text-center">{selectedQR.name}</DialogTitle>
              </DialogHeader>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  {t(translations, "configs.bankAccounts.qrCodeTitle")}
                </p>
              </div>
              <div className="relative aspect-square w-full overflow-hidden rounded-lg border bg-muted">
                <img src={selectedQR.url} alt={`${selectedQR.name} QR Code`} className="h-full w-full object-contain" />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
