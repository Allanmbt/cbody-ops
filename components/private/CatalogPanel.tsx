"use client"

import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { MoreHorizontal, Pencil, Plus, Shirt, Trash2 } from "lucide-react"

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  createAuditFields,
  localizedText,
  privateAttireFormSchema,
  privateServiceSettingFormSchema,
  type BaseService,
  type PrivateAttire,
  type PrivateAttireFormData,
  type PrivateDataset,
  type PrivateMutationDispatcher,
  type PrivatePagePermissions,
  type PrivateServiceSetting,
  type PrivateServiceSettingFormData,
} from "@/lib/features/private"

interface CatalogPanelProps {
  data: PrivateDataset
  dispatch: PrivateMutationDispatcher
  permissions: PrivatePagePermissions
}

export function CatalogPanel({ data, dispatch, permissions }: CatalogPanelProps) {
  const [editingService, setEditingService] = useState<BaseService | null>(null)
  const [editingAttire, setEditingAttire] = useState<PrivateAttire | null | undefined>(undefined)
  const [deletingService, setDeletingService] = useState<BaseService | null>(null)
  const [deletingAttire, setDeletingAttire] = useState<PrivateAttire | null>(null)

  const sortedServices = useMemo(() => [...data.services].sort((a, b) => {
    const aSort = data.serviceSettings.find((item) => item.service_id === a.id)?.sort_order ?? 999
    const bSort = data.serviceSettings.find((item) => item.service_id === b.id)?.sort_order ?? 999
    return aSort - bSort || a.id - b.id
  }), [data.services, data.serviceSettings])

  const attireUsage = (id: string) => data.providerServiceAttires.filter((item) => item.attire_id === id).length

  return (
    <Tabs defaultValue="services" className="space-y-4">
      <TabsList className="w-full sm:w-auto">
        <TabsTrigger value="services">Private 服务目录</TabsTrigger>
        <TabsTrigger value="attires">制服目录</TabsTrigger>
      </TabsList>

      <TabsContent value="services">
        <Card>
          <CardHeader><CardTitle className="text-base">原服务与 Private 扩展设置</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <Table className="min-w-[780px]">
                <TableHeader><TableRow>
                  <TableHead>服务</TableHead><TableHead>原服务状态</TableHead><TableHead>Private 分类</TableHead><TableHead>Incall</TableHead><TableHead>制服</TableHead><TableHead>排序</TableHead><TableHead className="text-right">操作</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {sortedServices.map((service) => {
                    const setting = data.serviceSettings.find((item) => item.service_id === service.id)
                    return (
                      <TableRow key={service.id}>
                        <TableCell><div className="font-medium">{localizedText(service.title, "zh") || localizedText(service.title)}</div><div className="text-xs text-muted-foreground">{service.code} · ID {service.id}</div></TableCell>
                        <TableCell><Badge variant={service.is_active ? "default" : "secondary"}>{service.is_active ? "启用" : "停用"}</Badge></TableCell>
                        <TableCell>{setting ? <Badge variant="outline">{setting.display_category}</Badge> : <span className="text-muted-foreground">未配置</span>}</TableCell>
                        <TableCell><Badge variant={setting?.is_incall_enabled ? "default" : "secondary"}>{setting?.is_incall_enabled ? "已开启" : "未开启"}</Badge></TableCell>
                        <TableCell>{setting?.supports_attire ? "支持" : "—"}</TableCell>
                        <TableCell>{setting?.sort_order ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem disabled={!permissions.canManageContent} onClick={() => setEditingService(service)}><Pencil className="mr-2 h-4 w-4" />{setting ? "编辑 Private 设置" : "创建 Private 设置"}</DropdownMenuItem>
                              {setting && <><DropdownMenuSeparator /><DropdownMenuItem disabled={!permissions.canManageContent} className="text-destructive" onClick={() => setDeletingService(service)}><Trash2 className="mr-2 h-4 w-4" />移出 Private 目录</DropdownMenuItem></>}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">服务标题、徽章与启用状态来自原 services，仅供查看；本页不会修改原服务。</p>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="attires">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Themed Attire 制服目录</CardTitle>
            <Button disabled={!permissions.canManageContent} onClick={() => setEditingAttire(null)}><Plus className="mr-2 h-4 w-4" />新增制服</Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[...data.attires].sort((a, b) => a.sort_order - b.sort_order).map((attire) => (
                <div key={attire.id} className="overflow-hidden rounded-lg border bg-card">
                  <div className="aspect-[16/9] bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={attire.image_url} alt={localizedText(attire.name)} className="h-full w-full object-cover" />
                  </div>
                  <div className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3"><div><div className="font-medium">{attire.code} · {localizedText(attire.name)}</div><div className="text-xs text-muted-foreground">使用 {attireUsage(attire.id)} 次 · 排序 {attire.sort_order}</div></div><Badge variant={attire.is_active ? "default" : "secondary"}>{attire.is_active ? "启用" : "停用"}</Badge></div>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{localizedText(attire.note) || "暂无说明"}</p>
                    <div className="flex gap-2"><Button variant="outline" size="sm" disabled={!permissions.canManageContent} onClick={() => setEditingAttire(attire)}>编辑</Button><Button variant="ghost" size="sm" disabled={!permissions.canManageContent} className="text-destructive" onClick={() => setDeletingAttire(attire)}>删除</Button></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <ServiceSettingDialog
        service={editingService}
        setting={editingService ? data.serviceSettings.find((item) => item.service_id === editingService.id) : undefined}
        open={Boolean(editingService)}
        onOpenChange={(open) => !open && setEditingService(null)}
        onSave={(value) => { dispatch({ type: "UPSERT_SERVICE_SETTING", value }); setEditingService(null) }}
      />
      <AttireDialog
        open={editingAttire !== undefined}
        attire={editingAttire || null}
        existingCodes={data.attires.filter((item) => item.id !== editingAttire?.id).map((item) => item.code.toLowerCase())}
        onOpenChange={(open) => !open && setEditingAttire(undefined)}
        onSave={(value) => { dispatch({ type: "UPSERT_ATTIRE", value }); setEditingAttire(undefined) }}
      />

      <AlertDialog open={Boolean(deletingService)} onOpenChange={(open) => !open && setDeletingService(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>移出 Private 服务目录？</AlertDialogTitle><AlertDialogDescription>将删除真实 private_service_settings 记录。技师服务扩展记录会保留，但公开链路将立即失效；原 services 数据不受影响。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => { if (deletingService) dispatch({ type: "DELETE_SERVICE_SETTING", serviceId: deletingService.id }); setDeletingService(null) }}>确认移除</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={Boolean(deletingAttire)} onOpenChange={(open) => !open && setDeletingAttire(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>删除制服 {deletingAttire?.code}？</AlertDialogTitle><AlertDialogDescription>该制服当前有 {deletingAttire ? attireUsage(deletingAttire.id) : 0} 条服务绑定。删除真实记录会按照 ON DELETE CASCADE 同时移除这些绑定。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => { if (deletingAttire) dispatch({ type: "DELETE_ATTIRE", id: deletingAttire.id }); setDeletingAttire(null) }}>确认删除</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </Tabs>
  )
}

function ServiceSettingDialog({ service, setting, open, onOpenChange, onSave }: { service: BaseService | null; setting?: PrivateServiceSetting; open: boolean; onOpenChange: (open: boolean) => void; onSave: (value: PrivateServiceSetting) => void }) {
  const form = useForm<PrivateServiceSettingFormData>({ resolver: zodResolver(privateServiceSettingFormSchema) as any, defaultValues: { is_incall_enabled: false, supports_attire: false, display_category: "wellness", description_en: "", description_zh: "", description_th: "", sort_order: 999 } })
  useEffect(() => { form.reset({ is_incall_enabled: setting?.is_incall_enabled ?? false, supports_attire: setting?.supports_attire ?? false, display_category: setting?.display_category ?? "wellness", description_en: setting?.description_override.en || "", description_zh: setting?.description_override.zh || "", description_th: setting?.description_override.th || "", sort_order: setting?.sort_order ?? 999 }) }, [setting, service, form])
  if (!service) return null
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>{localizedText(service.title, "zh") || localizedText(service.title)} · Private 设置</DialogTitle></DialogHeader><Form {...form}><form className="space-y-4" onSubmit={form.handleSubmit((values) => { const now = new Date().toISOString(); onSave({ ...(setting || { ...createAuditFields(now), service_id: service.id, name_override: { en: "" } }), is_incall_enabled: values.is_incall_enabled, supports_attire: values.is_incall_enabled ? values.supports_attire : false, display_category: values.display_category, description_override: { ...(setting?.description_override || {}), en: values.description_en, zh: values.description_zh || "", th: values.description_th || "" }, sort_order: values.sort_order, updated_by: null, updated_at: now }) })}>
    <div className="grid gap-3 sm:grid-cols-2">
      <FormField control={form.control} name="is_incall_enabled" render={({ field }) => <FormItem className="flex items-center justify-between rounded-lg border p-3"><FormLabel>允许 Private Incall</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={(checked) => { field.onChange(checked); if (!checked) form.setValue("supports_attire", false) }} /></FormControl></FormItem>} />
      <FormField control={form.control} name="supports_attire" render={({ field }) => <FormItem className="flex items-center justify-between rounded-lg border p-3"><FormLabel>支持制服</FormLabel><FormControl><Switch checked={field.value} disabled={!form.watch("is_incall_enabled")} onCheckedChange={field.onChange} /></FormControl></FormItem>} />
    </div>
    <div className="grid gap-3 sm:grid-cols-2"><FormField control={form.control} name="display_category" render={({ field }) => <FormItem><FormLabel>Private 分类</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="wellness">wellness</SelectItem><SelectItem value="yoga">yoga</SelectItem><SelectItem value="screening">screening</SelectItem></SelectContent></Select><FormMessage /></FormItem>} /><FormField control={form.control} name="sort_order" render={({ field }) => <FormItem><FormLabel>排序</FormLabel><FormControl><Input type="number" min={0} {...field} /></FormControl><FormMessage /></FormItem>} /></div>
    <FormField control={form.control} name="description_en" render={({ field }) => <FormItem><FormLabel>Private 通用介绍（EN）</FormLabel><FormControl><Textarea rows={4} {...field} /></FormControl><FormMessage /></FormItem>} />
    <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">其他语言</summary><div className="mt-3 grid gap-3"><FormField control={form.control} name="description_zh" render={({ field }) => <FormItem><FormLabel>中文</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>} /><FormField control={form.control} name="description_th" render={({ field }) => <FormItem><FormLabel>ไทย</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>} /></div></details>
    <DialogFooter><Button type="submit">保存设置</Button></DialogFooter>
  </form></Form></DialogContent></Dialog>
}

function AttireDialog({ open, attire, existingCodes, onOpenChange, onSave }: { open: boolean; attire: PrivateAttire | null; existingCodes: string[]; onOpenChange: (open: boolean) => void; onSave: (value: PrivateAttire) => void }) {
  const form = useForm<PrivateAttireFormData>({ resolver: zodResolver(privateAttireFormSchema) as any, defaultValues: { code: "", name_en: "", name_zh: "", name_th: "", note_en: "", image_url: "", sort_order: 999, is_active: true } })
  useEffect(() => { form.reset({ code: attire?.code || "", name_en: attire?.name.en || "", name_zh: attire?.name.zh || "", name_th: attire?.name.th || "", note_en: attire?.note.en || "", image_url: attire?.image_url || "", sort_order: attire?.sort_order ?? 999, is_active: attire?.is_active ?? true }) }, [attire, form, open])
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>{attire ? "编辑制服" : "新增制服"}</DialogTitle></DialogHeader><Form {...form}><form className="space-y-4" onSubmit={form.handleSubmit((values) => { if (existingCodes.includes(values.code.toLowerCase())) { form.setError("code", { message: "制服编号已存在" }); return } const now = new Date().toISOString(); onSave({ ...(attire || { ...createAuditFields(now), id: crypto.randomUUID() }), code: values.code, name: { ...(attire?.name || {}), en: values.name_en, zh: values.name_zh || "", th: values.name_th || "" }, note: { ...(attire?.note || {}), en: values.note_en }, image_url: values.image_url, sort_order: values.sort_order, is_active: values.is_active, updated_by: null, updated_at: now }) })}>
    <div className="grid gap-3 sm:grid-cols-2"><FormField control={form.control} name="code" render={({ field }) => <FormItem><FormLabel>制服编号</FormLabel><FormControl><Input placeholder="A003" {...field} /></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="sort_order" render={({ field }) => <FormItem><FormLabel>排序</FormLabel><FormControl><Input type="number" min={0} {...field} /></FormControl><FormMessage /></FormItem>} /></div>
    <FormField control={form.control} name="name_en" render={({ field }) => <FormItem><FormLabel>英文名称</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
    <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">其他语言</summary><div className="mt-3 grid gap-3 sm:grid-cols-2"><FormField control={form.control} name="name_zh" render={({ field }) => <FormItem><FormLabel>中文</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>} /><FormField control={form.control} name="name_th" render={({ field }) => <FormItem><FormLabel>ไทย</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>} /></div></details>
    <FormField control={form.control} name="note_en" render={({ field }) => <FormItem><FormLabel>英文说明</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>} />
    <FormField control={form.control} name="image_url" render={({ field }) => <FormItem><FormLabel>图片 HTTPS URL</FormLabel><FormControl><Input placeholder="https://..." {...field} /></FormControl><FormMessage /></FormItem>} />
    <FormField control={form.control} name="is_active" render={({ field }) => <FormItem className="flex items-center justify-between rounded-lg border p-3"><FormLabel>启用制服</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>} />
    <DialogFooter><Button type="submit"><Shirt className="mr-2 h-4 w-4" />保存制服</Button></DialogFooter>
  </form></Form></DialogContent></Dialog>
}
