"use client"

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useReducer, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Eye,
  Image as ImageIcon,
  MapPin,
  Maximize2,
  Music2,
  MoreHorizontal,
  Pencil,
  Plus,
  PlayCircle,
  Search,
  Settings2,
  Shirt,
  Store,
  Trash2,
  Users,
} from "lucide-react"
import { toast } from "sonner"

import { AvailabilityPanel } from "@/components/private/AvailabilityPanel"
import { CatalogPanel } from "@/components/private/CatalogPanel"
import { VenuesPanel } from "@/components/private/VenuesPanel"
import { applyPrivateMutation } from "@/app/dashboard/business/private/actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  bangkokDate,
  createAuditFields,
  formatAvailabilityTime,
  getProviderReadiness,
  localizedText,
  privateDataReducer,
  privateAlbumSettingsFormSchema,
  privateMediaFormSchema,
  privateProfileFormSchema,
  privateProviderServiceFormSchema,
  splitList,
  type AdminGirlService,
  type PrivateAlbumSettings,
  type PrivateAlbumSettingsFormData,
  type PrivateDataset,
  type PrivateGirl,
  type PrivateMedia,
  type PrivateMediaFormData,
  type PrivateMutationAction,
  type PrivateMutationDispatcher,
  type PrivatePagePermissions,
  type PrivateProfile,
  type PrivateProfileFormData,
  type PrivateProviderService,
  type PrivateProviderServiceFormData,
  type PrivateSection,
} from "@/lib/features/private"

interface PrivateManagementProps {
  initialData: PrivateDataset
  permissions: PrivatePagePermissions
  initialSection?: PrivateSection
  initialGirlId?: string
}

type PublishFilter = "all" | "published" | "draft"
type ReadinessFilter = "all" | "ready" | "incomplete"
type AvailabilityFilter = "all" | "available" | "unavailable"

function mutationSuccessMessage(action: PrivateMutationAction): string {
  const messages: Record<PrivateMutationAction["type"], string> = {
    UPSERT_PROFILE: "Private 资料已保存",
    DELETE_PROFILE: "Private 资料已删除",
    UPSERT_MEDIA: action.type === "UPSERT_MEDIA" && action.replaceActiveCover ? "相册媒体已保存并替换封面" : "相册媒体已保存",
    DELETE_MEDIA: "相册媒体记录已删除",
    UPSERT_ALBUM_SETTINGS: "相册背景音乐设置已保存",
    UPSERT_AVAILABILITY: "排班已保存",
    UPSERT_AVAILABILITY_BATCH: "批量排班已保存",
    DELETE_AVAILABILITY: "排班已删除",
    UPSERT_SERVICE_SETTING: "Private 服务设置已保存",
    DELETE_SERVICE_SETTING: "服务已移出 Private 目录",
    UPSERT_PROVIDER_SERVICE: "技师服务发布设置已保存",
    DELETE_PROVIDER_SERVICE: "技师服务扩展已删除",
    UPSERT_ATTIRE: "制服已保存",
    DELETE_ATTIRE: "制服及其关联已删除",
    UPSERT_LOCATION: "场所与公开内容已保存",
    DELETE_LOCATION: "场所已删除",
  }
  return messages[action.type]
}

export function PrivateManagement({ initialData, permissions, initialSection = "providers", initialGirlId }: PrivateManagementProps) {
  const router = useRouter()
  const [data, reducerDispatch] = useReducer(privateDataReducer, initialData)
  const [isSaving, startSaving] = useTransition()
  const [section, setSection] = useState<PrivateSection>(initialSection)
  const [selectedGirlId, setSelectedGirlId] = useState<string | null>(initialGirlId || null)
  const [focusLocationId, setFocusLocationId] = useState<string | null>(null)
  const today = bangkokDate()

  const dispatch = useCallback<PrivateMutationDispatcher>((action) => {
    startSaving(async () => {
      const result = await applyPrivateMutation(action)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      reducerDispatch(result.data)
      toast.success(mutationSuccessMessage(result.data))
    })
  }, [])

  const girls = useMemo(() => data.girls.filter((girl) => girl.incall_enabled), [data.girls])
  const stats = useMemo(() => {
    const published = girls.filter((girl) => data.profiles.find((item) => item.girl_id === girl.id)?.is_published).length
    const available = girls.filter((girl) => data.availability.some((item) => item.girl_id === girl.id && item.service_date === today && item.is_available)).length
    const incomplete = girls.filter((girl) => !getProviderReadiness(data, girl, today).ready).length
    return { total: girls.length, published, available, incomplete }
  }, [data, girls, today])

  const switchSection = (next: PrivateSection, girlId?: string) => {
    setSection(next)
    const params = new URLSearchParams({ section: next })
    if (girlId) params.set("girl", girlId)
    router.replace(`/dashboard/business/private?${params.toString()}`, { scroll: false })
  }

  const openProvider = (girlId: string) => {
    setSelectedGirlId(girlId)
    switchSection("providers", girlId)
  }

  const closeProvider = () => {
    setSelectedGirlId(null)
    switchSection("providers")
  }

  const openVenue = (locationId: string | null) => {
    setSelectedGirlId(null)
    setFocusLocationId(locationId)
    switchSection("venues")
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><Store className="h-6 w-6" /><h1 className="text-2xl font-bold tracking-tight">到店管理</h1></div>
          <p className="mt-1 text-sm text-muted-foreground">集中维护 CBODY Private 技师、排班、服务制服和场所公开信息</p>
        </div>
        <Badge variant="outline" className="h-7 gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Supabase 实时数据{isSaving ? " · 保存中" : ""}</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Private 技师" value={stats.total} icon={Users} onClick={() => { switchSection("providers"); }} />
        <StatCard label="已发布资料" value={stats.published} icon={Eye} onClick={() => switchSection("providers")} />
        <StatCard label="今日可约" value={stats.available} icon={CalendarDays} onClick={() => switchSection("availability")} />
        <StatCard label="配置不完整" value={stats.incomplete} icon={CircleAlert} tone="warning" onClick={() => switchSection("providers")} />
      </div>

      <Tabs value={section} onValueChange={(value) => switchSection(value as PrivateSection)} className="space-y-4">
        <div className="overflow-x-auto pb-1"><TabsList className="min-w-max"><TabsTrigger value="providers"><Users />Private 技师</TabsTrigger><TabsTrigger value="availability"><CalendarDays />排班管理</TabsTrigger><TabsTrigger value="catalog"><Shirt />服务与制服</TabsTrigger><TabsTrigger value="venues"><MapPin />场所与地址</TabsTrigger></TabsList></div>
        <TabsContent value="providers"><ProviderList data={data} permissions={permissions} today={today} onOpenProvider={openProvider} /></TabsContent>
        <TabsContent value="availability"><AvailabilityPanel data={data} dispatch={dispatch} permissions={permissions} /></TabsContent>
        <TabsContent value="catalog"><CatalogPanel data={data} dispatch={dispatch} permissions={permissions} /></TabsContent>
        <TabsContent value="venues"><VenuesPanel data={data} dispatch={dispatch} permissions={permissions} focusLocationId={focusLocationId} /></TabsContent>
      </Tabs>

      <ProviderSheet
        girl={data.girls.find((item) => item.id === selectedGirlId) || null}
        data={data}
        dispatch={dispatch}
        permissions={permissions}
        today={today}
        onClose={closeProvider}
        onOpenVenue={openVenue}
      />
    </div>
  )
}

function StatCard({ label, value, icon: Icon, tone, onClick }: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; tone?: "warning"; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Card className="transition-colors hover:bg-accent/30"><CardContent className="flex items-center justify-between p-4"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div><div className={`rounded-lg p-2.5 ${tone === "warning" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : "bg-primary/10 text-primary"}`}><Icon className="h-5 w-5" /></div></CardContent></Card></button>
}

function ProviderList({ data, permissions, today, onOpenProvider }: { data: PrivateDataset; permissions: PrivatePagePermissions; today: string; onOpenProvider: (girlId: string) => void }) {
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [publishFilter, setPublishFilter] = useState<PublishFilter>("all")
  const [readinessFilter, setReadinessFilter] = useState<ReadinessFilter>("all")
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>("all")
  const [locationFilter, setLocationFilter] = useState("all")
  const [page, setPage] = useState(1)
  const limit = 10

  const providers = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return data.girls.filter((girl) => girl.incall_enabled).filter((girl) => {
      const profile = data.profiles.find((item) => item.girl_id === girl.id)
      const available = data.availability.some((item) => item.girl_id === girl.id && item.service_date === today && item.is_available)
      const ready = getProviderReadiness(data, girl, today).ready
      const matchesSearch = !keyword || girl.name.toLowerCase().includes(keyword) || girl.username.toLowerCase().includes(keyword) || String(girl.girl_number).includes(keyword)
      return matchesSearch &&
        (publishFilter === "all" || (publishFilter === "published" ? profile?.is_published : !profile?.is_published)) &&
        (readinessFilter === "all" || (readinessFilter === "ready" ? ready : !ready)) &&
        (availabilityFilter === "all" || (availabilityFilter === "available" ? available : !available)) &&
        (locationFilter === "all" || (locationFilter === "none" ? !girl.incall_location_id : girl.incall_location_id === locationFilter))
    }).sort((a, b) => (data.profiles.find((item) => item.girl_id === a.id)?.sort_order ?? 999) - (data.profiles.find((item) => item.girl_id === b.id)?.sort_order ?? 999))
  }, [data, search, publishFilter, readinessFilter, availabilityFilter, locationFilter, today])

  useEffect(() => setPage(1), [search, publishFilter, readinessFilter, availabilityFilter, locationFilter])
  const totalPages = Math.max(1, Math.ceil(providers.length / limit))
  const visible = providers.slice((page - 1) * limit, page * limit)
  const reset = () => { setSearchInput(""); setSearch(""); setPublishFilter("all"); setReadinessFilter("all"); setAvailabilityFilter("all"); setLocationFilter("all") }

  return <div className="space-y-4">
    <Card><CardContent className="flex flex-wrap gap-3 p-4"><form className="flex min-w-[260px] flex-1 gap-2" onSubmit={(event) => { event.preventDefault(); setSearch(searchInput.trim()) }}><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="搜索工号、姓名或 username" className="pl-9" /></div><Button type="submit"><Search className="mr-2 h-4 w-4" />搜索</Button></form><FilterSelect value={publishFilter} onChange={(value) => setPublishFilter(value as PublishFilter)} items={[['all','全部发布状态'],['published','资料已发布'],['draft','资料未发布']]} /><FilterSelect value={readinessFilter} onChange={(value) => setReadinessFilter(value as ReadinessFilter)} items={[['all','全部完整度'],['ready','满足公开条件'],['incomplete','配置不完整']]} /><FilterSelect value={availabilityFilter} onChange={(value) => setAvailabilityFilter(value as AvailabilityFilter)} items={[['all','全部今日状态'],['available','今日可约'],['unavailable','今日不可约/未排班']]} /><Select value={locationFilter} onValueChange={setLocationFilter}><SelectTrigger className="w-full sm:w-[170px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部场所</SelectItem><SelectItem value="none">未分配场所</SelectItem>{data.locations.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select><Button variant="outline" onClick={reset}>重置</Button></CardContent></Card>
    <Card><CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">Private 技师列表</CardTitle><div className="flex items-center gap-2"><Badge variant="outline">{providers.length} 名</Badge><Button asChild variant="outline" size="sm"><Link href="/dashboard/girls">管理到店资格</Link></Button></div></CardHeader><CardContent>
      <div className="hidden overflow-x-auto rounded-md border md:block"><Table className="min-w-[900px]"><TableHeader><TableRow><TableHead>技师</TableHead><TableHead>场所</TableHead><TableHead>今日排班</TableHead><TableHead>资源</TableHead><TableHead>排序</TableHead><TableHead>发布条件</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader><TableBody>{visible.map((girl) => <ProviderRow key={girl.id} girl={girl} data={data} today={today} onOpen={() => onOpenProvider(girl.id)} />)}{visible.length === 0 && <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">没有符合条件的 Incall 技师</TableCell></TableRow>}</TableBody></Table></div>
      <div className="space-y-3 md:hidden">{visible.map((girl) => <ProviderMobileCard key={girl.id} girl={girl} data={data} today={today} onOpen={() => onOpenProvider(girl.id)} />)}</div>
      {providers.length > limit && <div className="mt-4 flex items-center justify-between"><span className="text-sm text-muted-foreground">显示 {(page - 1) * limit + 1}–{Math.min(page * limit, providers.length)}，共 {providers.length} 名</span><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft className="h-4 w-4" />上一页</Button><span className="text-sm">第 {page} 页</span><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>下一页<ChevronRight className="h-4 w-4" /></Button></div></div>}
      {!permissions.canManageContent && <p className="mt-4 text-xs text-muted-foreground">当前角色为 support：可查看全部内容，仅排班模块可新增或修改。</p>}
    </CardContent></Card>
  </div>
}

function FilterSelect({ value, onChange, items }: { value: string; onChange: (value: string) => void; items: [string, string][] }) { return <Select value={value} onValueChange={onChange}><SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger><SelectContent>{items.map(([itemValue, label]) => <SelectItem key={itemValue} value={itemValue}>{label}</SelectItem>)}</SelectContent></Select> }

function ProviderRow({ girl, data, today, onOpen }: { girl: PrivateGirl; data: PrivateDataset; today: string; onOpen: () => void }) {
  const profile = data.profiles.find((item) => item.girl_id === girl.id)
  const location = data.locations.find((item) => item.id === girl.incall_location_id)
  const availability = data.availability.find((item) => item.girl_id === girl.id && item.service_date === today)
  const mediaCount = data.media.filter((item) => item.girl_id === girl.id).length
  const serviceCount = getPublishedProviderServices(data, girl.id).length
  const readiness = getProviderReadiness(data, girl, today)
  return <TableRow><TableCell><ProviderIdentity girl={girl} profile={profile} /></TableCell><TableCell><div className="max-w-[180px] truncate">{location?.name || "未分配"}</div>{!location && <span className="text-xs text-amber-600">需在技师管理设置</span>}</TableCell><TableCell>{availability ? <><Badge variant={availability.is_available ? "default" : "secondary"}>{availability.is_available ? "可约" : "不可约"}</Badge><div className="mt-1 text-xs text-muted-foreground">{formatAvailabilityTime(availability.start_time, availability.end_time, availability.ends_next_day)}</div></> : <Badge variant="outline">未排班</Badge>}</TableCell><TableCell><div className="text-sm">{serviceCount} 服务 · {mediaCount} 媒体</div><div className="text-xs text-muted-foreground">{girl.category_names.length} 分类</div></TableCell><TableCell>{profile?.sort_order ?? "—"}</TableCell><TableCell><ReadinessBadge readiness={readiness} /></TableCell><TableCell className="text-right"><Button size="sm" variant="outline" onClick={onOpen}>配置</Button></TableCell></TableRow>
}

function ProviderMobileCard({ girl, data, today, onOpen }: { girl: PrivateGirl; data: PrivateDataset; today: string; onOpen: () => void }) {
  const profile = data.profiles.find((item) => item.girl_id === girl.id)
  const availability = data.availability.find((item) => item.girl_id === girl.id && item.service_date === today)
  return <div className="rounded-lg border p-4"><div className="flex items-start justify-between gap-3"><ProviderIdentity girl={girl} profile={profile} /><ReadinessBadge readiness={getProviderReadiness(data, girl, today)} /></div><div className="mt-3 grid grid-cols-2 gap-2 text-sm"><div><span className="text-muted-foreground">今日：</span>{availability?.is_available ? "可约" : "不可约/未排"}</div><div><span className="text-muted-foreground">排序：</span>{profile?.sort_order ?? "—"}</div></div><Button className="mt-4 w-full" variant="outline" onClick={onOpen}>打开 Private 配置</Button></div>
}

function ProviderIdentity({ girl, profile }: { girl: PrivateGirl; profile?: PrivateProfile }) {
  const [previewOpen, setPreviewOpen] = useState(false)
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={!girl.avatar_url}
        onClick={() => setPreviewOpen(true)}
        className="group relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
        aria-label={girl.avatar_url ? `预览 ${girl.name} 的头像大图` : undefined}
      >
        <Avatar className="h-10 w-10">
          <AvatarImage src={girl.avatar_url || undefined} />
          <AvatarFallback>{girl.name.slice(0, 1)}</AvatarFallback>
        </Avatar>
        {girl.avatar_url && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <Maximize2 className="h-4 w-4" />
          </span>
        )}
      </button>
      <div>
        <div className="flex items-center gap-2 font-medium">
          No. {girl.girl_number} · {girl.name}
          {profile?.badge && <Badge variant="outline" className="text-[10px]">{profile.badge}</Badge>}
        </div>
        <div className="text-xs text-muted-foreground">@{girl.username}</div>
      </div>
      {girl.avatar_url && (
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-3xl border-0 bg-black/95 p-2 sm:p-3">
            <DialogHeader className="sr-only">
              <DialogTitle>{girl.name} 头像预览</DialogTitle>
            </DialogHeader>
            <img src={girl.avatar_url} alt={`${girl.name} 头像大图`} className="max-h-[82vh] w-full rounded-md object-contain" />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function ReadinessBadge({ readiness }: { readiness: ReturnType<typeof getProviderReadiness> }) { return <div title={[...readiness.blockers, ...readiness.warnings].join("\n")}><Badge variant={readiness.ready ? "default" : "secondary"} className={readiness.ready ? "bg-emerald-600" : ""}>{readiness.ready ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> : <AlertCircle className="mr-1 h-3.5 w-3.5" />}{readiness.passed}/{readiness.total}</Badge>{readiness.warnings.length > 0 && <div className="mt-1 text-xs text-muted-foreground">{readiness.warnings.length} 项提醒</div>}</div> }

function getPublishedProviderServices(data: PrivateDataset, girlId: string) { return data.adminGirlServices.filter((item) => item.girl_id === girlId && item.is_qualified).filter((item) => data.providerServices.find((provider) => provider.admin_girl_service_id === item.id)?.is_published) }

function ProviderSheet({ girl, data, dispatch, permissions, today, onClose, onOpenVenue }: { girl: PrivateGirl | null; data: PrivateDataset; dispatch: PrivateMutationDispatcher; permissions: PrivatePagePermissions; today: string; onClose: () => void; onOpenVenue: (locationId: string | null) => void }) {
  if (!girl) return null
  const readiness = getProviderReadiness(data, girl, today)
  const location = data.locations.find((item) => item.id === girl.incall_location_id)
  return <Sheet open={Boolean(girl)} onOpenChange={(open) => !open && onClose()}><SheetContent className="w-full overflow-y-auto sm:max-w-4xl"><SheetHeader className="border-b"><div className="pr-8"><ProviderIdentity girl={girl} profile={data.profiles.find((item) => item.girl_id === girl.id)} /><div className="mt-3 flex flex-wrap items-center gap-2"><ReadinessBadge readiness={readiness} />{location ? <Button variant="outline" size="sm" onClick={() => onOpenVenue(location.id)}><MapPin className="mr-1 h-3.5 w-3.5" />{location.name}</Button> : <Button variant="outline" size="sm" asChild><Link href="/dashboard/girls">去技师管理分配场所</Link></Button>}</div></div><SheetTitle className="sr-only">{girl.name} Private 配置</SheetTitle><SheetDescription className="sr-only">集中维护 Private 资料、混合相册、服务制服和排班</SheetDescription></SheetHeader><div className="px-4 pb-6"><Tabs defaultValue="profile" className="space-y-4"><div className="overflow-x-auto"><TabsList className="min-w-max"><TabsTrigger value="profile">展示资料</TabsTrigger><TabsTrigger value="media">混合相册</TabsTrigger><TabsTrigger value="services">服务与制服</TabsTrigger><TabsTrigger value="availability">排班</TabsTrigger></TabsList></div><TabsContent value="profile"><ProfilePanel girl={girl} data={data} dispatch={dispatch} permissions={permissions} readiness={readiness} /></TabsContent><TabsContent value="media"><MixedAlbumPanel girl={girl} data={data} dispatch={dispatch} permissions={permissions} /></TabsContent><TabsContent value="services"><ProviderServicesPanel girl={girl} data={data} dispatch={dispatch} permissions={permissions} /></TabsContent><TabsContent value="availability"><AvailabilityPanel data={data} dispatch={dispatch} permissions={permissions} girlId={girl.id} compact /></TabsContent></Tabs></div></SheetContent></Sheet>
}

function ProfilePanel({ girl, data, dispatch, permissions, readiness }: { girl: PrivateGirl; data: PrivateDataset; dispatch: PrivateMutationDispatcher; permissions: PrivatePagePermissions; readiness: ReturnType<typeof getProviderReadiness> }) {
  const profile = data.profiles.find((item) => item.girl_id === girl.id)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const form = useForm<PrivateProfileFormData>({ resolver: zodResolver(privateProfileFormSchema) as any, defaultValues: profileDefaults(profile) })
  useEffect(() => form.reset(profileDefaults(profile)), [profile, form, girl.id])
  const save = (values: PrivateProfileFormData) => { const now = new Date().toISOString(); dispatch({ type: "UPSERT_PROFILE", value: { ...(profile || { ...createAuditFields(now), girl_id: girl.id }), introduction: { ...(profile?.introduction || {}), en: values.introduction_en, zh: values.introduction_zh || "", th: values.introduction_th || "" }, bio: { ...(profile?.bio || {}), en: values.bio_en, zh: values.bio_zh || "", th: values.bio_th || "" }, personal_tags: { ...(profile?.personal_tags || {}), en: splitList(values.personal_tags_en) }, skin_tone: { ...(profile?.skin_tone || {}), en: values.skin_tone_en }, body_type: { ...(profile?.body_type || {}), en: values.body_type_en }, display_age: values.display_age, badge: values.badge === "none" ? null : values.badge, sort_order: values.sort_order, is_published: values.is_published, health_certified: values.health_certified, booking_url: values.booking_url, updated_by: null, updated_at: now } }) }
  return <div className="space-y-4"><ReadinessDetails readiness={readiness} /><Card><CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">Private Profile</CardTitle>{profile && <Button variant="ghost" size="sm" className="text-destructive" disabled={!permissions.canManageContent} onClick={() => setDeleteOpen(true)}><Trash2 className="mr-2 h-4 w-4" />删除资料</Button>}</CardHeader><CardContent><Form {...form}><form onSubmit={form.handleSubmit(save)} className="space-y-4"><FormField control={form.control} name="introduction_en" render={({ field }) => <FormItem><FormLabel>卡片短介绍（EN）</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="bio_en" render={({ field }) => <FormItem><FormLabel>详情介绍（EN）</FormLabel><FormControl><Textarea rows={5} {...field} /></FormControl><FormMessage /></FormItem>} /><details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">中文与泰文介绍</summary><div className="mt-3 grid gap-4"><FormField control={form.control} name="introduction_zh" render={({ field }) => <FormItem><FormLabel>短介绍（ZH）</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>} /><FormField control={form.control} name="bio_zh" render={({ field }) => <FormItem><FormLabel>详情（ZH）</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>} /><FormField control={form.control} name="introduction_th" render={({ field }) => <FormItem><FormLabel>短介绍（TH）</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>} /><FormField control={form.control} name="bio_th" render={({ field }) => <FormItem><FormLabel>详情（TH）</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>} /></div></details><FormField control={form.control} name="personal_tags_en" render={({ field }) => <FormItem><FormLabel>个性标签（EN，逗号分隔）</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} /><div className="grid gap-3 sm:grid-cols-2"><FormField control={form.control} name="skin_tone_en" render={({ field }) => <FormItem><FormLabel>肤色展示（EN）</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="body_type_en" render={({ field }) => <FormItem><FormLabel>体型展示（EN）</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} /></div><div className="grid gap-3 sm:grid-cols-3"><FormField control={form.control} name="display_age" render={({ field }) => <FormItem><FormLabel>公开年龄</FormLabel><FormControl><Input type="number" min={20} max={99} value={field.value ?? ""} onChange={(event) => field.onChange(event.target.value === "" ? null : event.target.value)} /></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="badge" render={({ field }) => <FormItem><FormLabel>Private 标签</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">无</SelectItem><SelectItem value="hot">hot</SelectItem><SelectItem value="new">new</SelectItem><SelectItem value="signature">signature</SelectItem><SelectItem value="vip">vip</SelectItem></SelectContent></Select></FormItem>} /><FormField control={form.control} name="sort_order" render={({ field }) => <FormItem><FormLabel>排序</FormLabel><FormControl><Input type="number" min={0} {...field} /></FormControl><FormMessage /></FormItem>} /></div><FormField control={form.control} name="booking_url" render={({ field }) => <FormItem><FormLabel>预约 HTTPS URL</FormLabel><FormControl><Input placeholder="https://..." {...field} /></FormControl><FormMessage /></FormItem>} /><div className="grid gap-3 sm:grid-cols-2"><FormField control={form.control} name="health_certified" render={({ field }) => <FormItem className="flex items-center justify-between rounded-lg border p-3"><div><FormLabel>Private 健康认证</FormLabel><p className="text-xs text-muted-foreground">不能直接映射原 is_verified</p></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>} /><FormField control={form.control} name="is_published" render={({ field }) => <FormItem className="flex items-center justify-between rounded-lg border p-3"><div><FormLabel>发布 Private 资料</FormLabel><p className="text-xs text-muted-foreground">仍需满足完整公开链路</p></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>} /></div><Button type="submit" disabled={!permissions.canManageContent}>{profile ? "保存资料" : "创建资料"}</Button></form></Form></CardContent></Card><AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>删除 Private Profile？</AlertDialogTitle><AlertDialogDescription>将删除真实 private_profiles 记录。媒体、服务和排班是独立关联，不会被自动删除，但该技师将无法公开。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => { dispatch({ type: "DELETE_PROFILE", girlId: girl.id }); setDeleteOpen(false) }}>确认删除</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>
}

function profileDefaults(profile?: PrivateProfile): PrivateProfileFormData { return { introduction_en: profile?.introduction.en || "", introduction_zh: profile?.introduction.zh || "", introduction_th: profile?.introduction.th || "", bio_en: profile?.bio.en || "", bio_zh: profile?.bio.zh || "", bio_th: profile?.bio.th || "", personal_tags_en: profile?.personal_tags.en?.join(", ") || "", skin_tone_en: profile?.skin_tone.en || "", body_type_en: profile?.body_type.en || "", display_age: profile?.display_age ?? null, badge: profile?.badge || "none", sort_order: profile?.sort_order ?? 999, is_published: profile?.is_published ?? false, health_certified: profile?.health_certified ?? false, booking_url: profile?.booking_url || "" } }

function ReadinessDetails({ readiness }: { readiness: ReturnType<typeof getProviderReadiness> }) { return <div className="grid gap-3 sm:grid-cols-2"><Alert className={readiness.ready ? "border-emerald-300" : "border-amber-300"}>{readiness.ready ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}<AlertTitle>{readiness.ready ? "满足公开硬条件" : `${readiness.blockers.length} 项公开阻断`}</AlertTitle><AlertDescription>{readiness.blockers.length ? readiness.blockers.join("、") : "RPC 仍会按当前数据库状态进行最终过滤。"}</AlertDescription></Alert><Alert><CircleAlert className="h-4 w-4" /><AlertTitle>{readiness.warnings.length} 项质量提醒</AlertTitle><AlertDescription>{readiness.warnings.length ? readiness.warnings.join("、") : "暂无质量提醒"}</AlertDescription></Alert></div> }

function MixedAlbumPanel({ girl, data, dispatch, permissions }: { girl: PrivateGirl; data: PrivateDataset; dispatch: PrivateMutationDispatcher; permissions: PrivatePagePermissions }) {
  const media = data.media.filter((item) => item.girl_id === girl.id).sort((a, b) => a.sort_order - b.sort_order)
  const activeMedia = media.filter((item) => item.is_active)
  const albumSettings = data.albumSettings.find((item) => item.girl_id === girl.id)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [editing, setEditing] = useState<PrivateMedia | null | undefined>(undefined)
  const [deleting, setDeleting] = useState<PrivateMedia | null>(null)
  const preview = activeMedia[Math.min(previewIndex, Math.max(activeMedia.length - 1, 0))]

  useEffect(() => {
    if (previewIndex >= activeMedia.length) setPreviewIndex(0)
  }, [activeMedia.length, previewIndex])

  return (
    <div className="space-y-6">
      <Alert>
        <ImageIcon className="h-4 w-4" />
        <AlertTitle>混合相册规则</AlertTitle>
        <AlertDescription>每名技师最多 5 项媒体；静态照片使用 image，动态照片使用无声短视频 video。视频必须配置 poster 封面，相册最多一项启用封面。</AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)]">
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              相册预览
              <Badge variant="outline">{activeMedia.length}/5 项启用</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative mx-auto aspect-[4/5] max-h-[480px] overflow-hidden rounded-xl bg-muted">
              {!preview && <div className="flex h-full items-center justify-center text-sm text-muted-foreground">暂无启用媒体</div>}
              {preview?.kind === "image" && <img src={preview.url} alt={localizedText(preview.alt)} className="h-full w-full object-cover" />}
              {preview?.kind === "video" && (
                <video key={preview.id} src={preview.url} poster={preview.poster_url || undefined} className="h-full w-full object-cover" muted autoPlay loop playsInline preload="metadata" />
              )}
              {preview && <div className="absolute left-3 top-3 flex gap-1"><Badge>{preview.role === "cover" ? "主封面" : "相册"}</Badge><Badge variant="secondary">{preview.kind === "video" ? "动态照片" : "静态照片"}</Badge></div>}
            </div>
            {activeMedia.length > 1 && (
              <div className="flex justify-center gap-2" aria-label="选择相册预览项目">
                {activeMedia.map((item, index) => (
                  <button key={item.id} type="button" aria-label={`预览第 ${index + 1} 项`} onClick={() => setPreviewIndex(index)} className={`h-2.5 w-2.5 rounded-full ${index === previewIndex ? "bg-primary" : "bg-muted-foreground/30"}`} />
                ))}
              </div>
            )}
            {albumSettings?.is_audio_enabled && albumSettings.background_audio_url && (
              <audio controls loop={albumSettings.background_loop} preload="none" className="w-full" src={albumSettings.background_audio_url}>您的浏览器不支持音频播放。</audio>
            )}
          </CardContent>
        </Card>

        <AlbumSettingsForm
          girlId={girl.id}
          settings={albumSettings}
          enabled={data.capabilities.albumSettings}
          canManage={permissions.canManageContent}
          dispatch={dispatch}
        />
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h3 className="font-semibold">相册媒体</h3><p className="text-sm text-muted-foreground">当前维护真实 HTTPS 资源地址；上传功能接入 R2 后可复用相同记录。</p></div>
          <Button disabled={!permissions.canManageContent || media.length >= 5} onClick={() => setEditing(null)}><Plus className="mr-2 h-4 w-4" />新增相册项</Button>
        </div>
        {media.length >= 5 && <p className="text-sm text-amber-600">已达到 5 项上限，请先删除不再使用的记录。</p>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {media.map((item) => (
            <div key={item.id} className="overflow-hidden rounded-lg border">
              <div className="relative aspect-[4/5] bg-muted">
                <img src={item.kind === "video" ? item.poster_url || item.url : item.url} alt={localizedText(item.alt)} className="h-full w-full object-cover" />
                <div className="absolute left-2 top-2 flex flex-wrap gap-1"><Badge>{item.role === "cover" ? "主封面" : "相册"}</Badge><Badge variant="secondary">{item.kind === "video" ? "动态照片" : "静态照片"}</Badge></div>
                {item.kind === "video" && <PlayCircle className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow" />}
              </div>
              <div className="space-y-2 p-3">
                <div className="flex items-center justify-between"><span className="text-sm">排序 {item.sort_order}</span><Badge variant={item.is_active ? "default" : "secondary"}>{item.is_active ? "启用" : "停用"}</Badge></div>
                <p className="truncate text-xs text-muted-foreground" title={item.url}>{item.url}</p>
                <div className="flex gap-2"><Button variant="outline" size="sm" disabled={!permissions.canManageContent} onClick={() => setEditing(item)}>编辑</Button><Button variant="ghost" size="sm" className="text-destructive" disabled={!permissions.canManageContent} onClick={() => setDeleting(item)}>删除</Button></div>
              </div>
            </div>
          ))}
          {media.length === 0 && <div className="col-span-full rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground"><ImageIcon className="mx-auto mb-2 h-8 w-8 opacity-40" />暂无混合相册媒体</div>}
        </div>
      </div>

      <MediaDialog girlId={girl.id} media={editing || null} open={editing !== undefined} otherActiveCover={data.media.some((item) => item.girl_id === girl.id && item.role === "cover" && item.is_active && item.id !== editing?.id)} onOpenChange={(open) => !open && setEditing(undefined)} onSave={(value, replaceActiveCover) => { dispatch({ type: "UPSERT_MEDIA", value, replaceActiveCover }); setEditing(undefined) }} />
      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>删除这项相册媒体？</AlertDialogTitle><AlertDialogDescription>将删除真实 private_media 记录，但不会删除 R2、Supabase Storage 或外部 URL 对应的原文件。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => { if (deleting) dispatch({ type: "DELETE_MEDIA", id: deleting.id }); setDeleting(null) }}>确认删除</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  )
}

function AlbumSettingsForm({ girlId, settings, enabled, canManage, dispatch }: { girlId: string; settings?: PrivateAlbumSettings; enabled: boolean; canManage: boolean; dispatch: PrivateMutationDispatcher }) {
  const form = useForm<PrivateAlbumSettingsFormData>({
    resolver: zodResolver(privateAlbumSettingsFormSchema) as any,
    defaultValues: albumSettingsDefaults(settings),
  })
  useEffect(() => form.reset(albumSettingsDefaults(settings)), [form, settings, girlId])

  if (!enabled) {
    return <Alert className="border-amber-300"><Music2 className="h-4 w-4" /><AlertTitle>背景音乐表待部署</AlertTitle><AlertDescription>现有相册数据可以正常管理；应用本次 private_album_settings migration 后，此区域会自动启用。</AlertDescription></Alert>
  }

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Music2 className="h-4 w-4" />独立背景音乐</CardTitle></CardHeader>
      <CardContent><Form {...form}><form className="space-y-4" onSubmit={form.handleSubmit((values) => {
        const now = new Date().toISOString()
        dispatch({ type: "UPSERT_ALBUM_SETTINGS", value: {
          ...(settings || { ...createAuditFields(now), girl_id: girlId }),
          background_audio_url: values.background_audio_url || null,
          background_audio_object_key: values.background_audio_object_key || null,
          background_audio_mime_type: values.background_audio_mime_type || null,
          background_audio_title: values.background_audio_title || null,
          background_volume: values.background_volume,
          background_loop: values.background_loop,
          is_audio_enabled: values.is_audio_enabled,
          slide_duration_seconds: values.slide_duration_seconds,
          updated_by: null,
          updated_at: now,
        } })
      })}>
        <FormField control={form.control} name="background_audio_url" render={({ field }) => <FormItem><FormLabel>背景音乐 HTTPS URL</FormLabel><FormControl><Input placeholder="https://media.example.com/audio/..." {...field} /></FormControl><FormMessage /></FormItem>} />
        <FormField control={form.control} name="background_audio_title" render={({ field }) => <FormItem><FormLabel>音乐名称</FormLabel><FormControl><Input placeholder="后台识别名称" {...field} /></FormControl><FormMessage /></FormItem>} />
        <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">存储与播放参数</summary><div className="mt-3 grid gap-4 sm:grid-cols-2"><FormField control={form.control} name="background_audio_object_key" render={({ field }) => <FormItem><FormLabel>R2 Object Key</FormLabel><FormControl><Input placeholder="private/audio/..." {...field} /></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="background_audio_mime_type" render={({ field }) => <FormItem><FormLabel>音频 MIME</FormLabel><FormControl><Input placeholder="audio/mp4" {...field} /></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="background_volume" render={({ field }) => <FormItem><FormLabel>默认音量（0–1）</FormLabel><FormControl><Input type="number" min={0} max={1} step={0.05} {...field} /></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="slide_duration_seconds" render={({ field }) => <FormItem><FormLabel>静态照片停留秒数</FormLabel><FormControl><Input type="number" min={3} max={10} {...field} /></FormControl><FormMessage /></FormItem>} /></div></details>
        <div className="grid gap-3 sm:grid-cols-2"><FormField control={form.control} name="background_loop" render={({ field }) => <FormItem className="flex items-center justify-between rounded-lg border p-3"><FormLabel>循环播放</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>} /><FormField control={form.control} name="is_audio_enabled" render={({ field }) => <FormItem className="flex items-center justify-between rounded-lg border p-3"><FormLabel>启用背景音乐</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>} /></div>
        <Button type="submit" disabled={!canManage}>保存音乐设置</Button>
      </form></Form></CardContent>
    </Card>
  )
}

function albumSettingsDefaults(settings?: PrivateAlbumSettings): PrivateAlbumSettingsFormData {
  return {
    background_audio_url: settings?.background_audio_url || "",
    background_audio_object_key: settings?.background_audio_object_key || "",
    background_audio_mime_type: settings?.background_audio_mime_type || "audio/mp4",
    background_audio_title: settings?.background_audio_title || "",
    background_volume: settings?.background_volume ?? 0.35,
    background_loop: settings?.background_loop ?? true,
    is_audio_enabled: settings?.is_audio_enabled ?? false,
    slide_duration_seconds: settings?.slide_duration_seconds ?? 5,
  }
}

function MediaDialog({ girlId, media, open, otherActiveCover, onOpenChange, onSave }: { girlId: string; media: PrivateMedia | null; open: boolean; otherActiveCover: boolean; onOpenChange: (open: boolean) => void; onSave: (value: PrivateMedia, replaceActiveCover: boolean) => void }) {
  const form = useForm<PrivateMediaFormData>({ resolver: zodResolver(privateMediaFormSchema) as any, defaultValues: { kind: "image", role: "gallery", url: "", poster_url: "", mime_type: "image/jpeg", alt_en: "", sort_order: 0, is_active: true } })
  useEffect(() => form.reset({ kind: media?.kind || "image", role: media?.role || "gallery", url: media?.url || "", poster_url: media?.poster_url || "", mime_type: media?.mime_type || "", alt_en: media?.alt.en || "", sort_order: media?.sort_order ?? 0, is_active: media?.is_active ?? true }), [media, form, open])
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{media ? "编辑相册媒体" : "新增相册媒体"}</DialogTitle></DialogHeader><Form {...form}><form className="space-y-4" onSubmit={form.handleSubmit((values) => { const now = new Date().toISOString(); const replace = values.role === "cover" && values.is_active && otherActiveCover; onSave({ ...(media || { ...createAuditFields(now), id: crypto.randomUUID(), girl_id: girlId }), kind: values.kind, role: values.role, url: values.url, poster_url: values.poster_url || null, mime_type: values.mime_type || null, alt: { ...(media?.alt || {}), en: values.alt_en }, sort_order: values.sort_order, is_active: values.is_active, updated_by: null, updated_at: now }, replace) })}><div className="grid grid-cols-2 gap-3"><FormField control={form.control} name="kind" render={({ field }) => <FormItem><FormLabel>相册类型</FormLabel><Select value={field.value} onValueChange={(value) => { field.onChange(value); form.setValue("mime_type", value === "video" ? "video/mp4" : "image/jpeg") }}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="image">静态照片</SelectItem><SelectItem value="video">动态照片（短视频）</SelectItem></SelectContent></Select></FormItem>} /><FormField control={form.control} name="role" render={({ field }) => <FormItem><FormLabel>相册用途</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="cover">主封面</SelectItem><SelectItem value="gallery">相册内容</SelectItem></SelectContent></Select></FormItem>} /></div><FormField control={form.control} name="url" render={({ field }) => <FormItem><FormLabel>{form.watch("kind") === "video" ? "无声短视频 HTTPS URL" : "图片 HTTPS URL"}</FormLabel><FormControl><Input placeholder="https://..." {...field} /></FormControl><FormMessage /></FormItem>} />{form.watch("kind") === "video" && <FormField control={form.control} name="poster_url" render={({ field }) => <FormItem><FormLabel>动态照片封面 HTTPS URL</FormLabel><FormControl><Input placeholder="https://..." {...field} /></FormControl><FormMessage /></FormItem>} />}<div className="grid gap-3 sm:grid-cols-2"><FormField control={form.control} name="mime_type" render={({ field }) => <FormItem><FormLabel>MIME</FormLabel><FormControl><Input placeholder="video/mp4" {...field} /></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="sort_order" render={({ field }) => <FormItem><FormLabel>排序</FormLabel><FormControl><Input type="number" min={0} {...field} /></FormControl><FormMessage /></FormItem>} /></div><FormField control={form.control} name="alt_en" render={({ field }) => <FormItem><FormLabel>替代文本（EN）</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="is_active" render={({ field }) => <FormItem className="flex items-center justify-between rounded-lg border p-3"><FormLabel>启用相册项</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>} />{form.watch("role") === "cover" && form.watch("is_active") && otherActiveCover && <Alert className="border-amber-300"><AlertCircle className="h-4 w-4" /><AlertDescription>保存后会停用当前封面，确保每名技师只有一个启用主封面。</AlertDescription></Alert>}<DialogFooter><Button type="submit">保存相册媒体</Button></DialogFooter></form></Form></DialogContent></Dialog>
}

function ProviderServicesPanel({ girl, data, dispatch, permissions }: { girl: PrivateGirl; data: PrivateDataset; dispatch: PrivateMutationDispatcher; permissions: PrivatePagePermissions }) {
  const qualified = data.adminGirlServices.filter((item) => item.girl_id === girl.id && item.is_qualified)
  const [editing, setEditing] = useState<AdminGirlService | null>(null)
  const [deleting, setDeleting] = useState<AdminGirlService | null>(null)
  return <div className="space-y-4"><Alert><Settings2 className="h-4 w-4" /><AlertTitle>服务来源保持只读</AlertTitle><AlertDescription>仅列出 admin_girl_services.is_qualified=true 的审核关系；原服务、审核关系、时长与价格不会在此修改。</AlertDescription></Alert><div className="space-y-3">{qualified.map((adminService) => { const service = data.services.find((item) => item.id === adminService.service_id); const setting = data.serviceSettings.find((item) => item.service_id === adminService.service_id); const provider = data.providerServices.find((item) => item.admin_girl_service_id === adminService.id); const bindings = data.providerServiceAttires.filter((item) => item.admin_girl_service_id === adminService.id && item.is_active); const chainValid = Boolean(service?.is_active && setting?.is_incall_enabled && provider?.is_published && adminService.duration_active); return <Card key={adminService.id}><CardContent className="p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h4 className="font-medium">{localizedText(service?.title, "zh") || localizedText(service?.title)}</h4><Badge variant={chainValid ? "default" : "secondary"}>{chainValid ? "公开链路有效" : "未满足公开条件"}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{adminService.duration_minutes} 分钟 · ฿{adminService.price.toLocaleString()} · {bindings.length} 套制服</p><p className="mt-2 line-clamp-2 text-sm">{localizedText(provider?.description_override) || localizedText(setting?.description_override) || "暂无 Private 介绍"}</p>{!setting?.is_incall_enabled && <p className="mt-2 text-xs text-amber-600">该服务尚未在全局 Private 服务目录启用</p>}</div><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm"><MoreHorizontal className="mr-2 h-4 w-4" />操作</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem disabled={!permissions.canManageContent || !setting?.is_incall_enabled} onClick={() => setEditing(adminService)}><Pencil className="mr-2 h-4 w-4" />{provider ? "编辑发布设置" : "创建发布设置"}</DropdownMenuItem>{provider && <><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive" disabled={!permissions.canManageContent} onClick={() => setDeleting(adminService)}><Trash2 className="mr-2 h-4 w-4" />删除 Private 服务扩展</DropdownMenuItem></>}</DropdownMenuContent></DropdownMenu></div></CardContent></Card> })}{qualified.length === 0 && <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">没有已审核合格的服务，请先在服务管理完成绑定审核。</div>}</div><ProviderServiceDialog adminService={editing} data={data} open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)} onSave={(value, attireBindings) => { dispatch({ type: "UPSERT_PROVIDER_SERVICE", value, attireBindings }); setEditing(null) }} /><AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>删除 Private 技师服务扩展？</AlertDialogTitle><AlertDialogDescription>将删除真实 private_provider_services 记录及其制服绑定，不影响原 admin_girl_services 审核关系或价格时长。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => { if (deleting) dispatch({ type: "DELETE_PROVIDER_SERVICE", adminGirlServiceId: deleting.id }); setDeleting(null) }}>确认删除</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>
}

function ProviderServiceDialog({ adminService, data, open, onOpenChange, onSave }: { adminService: AdminGirlService | null; data: PrivateDataset; open: boolean; onOpenChange: (open: boolean) => void; onSave: (value: PrivateProviderService, attireBindings: PrivateDataset["providerServiceAttires"]) => void }) {
  const provider = adminService ? data.providerServices.find((item) => item.admin_girl_service_id === adminService.id) : undefined
  const service = adminService ? data.services.find((item) => item.id === adminService.service_id) : undefined
  const setting = adminService ? data.serviceSettings.find((item) => item.service_id === adminService.service_id) : undefined
  const form = useForm<PrivateProviderServiceFormData>({ resolver: zodResolver(privateProviderServiceFormSchema) as any, defaultValues: { is_published: false, sort_order: 999, description_en: "", includes_en: "", attire_ids: [] } })
  useEffect(() => { if (!adminService) return; form.reset({ is_published: provider?.is_published ?? false, sort_order: provider?.sort_order ?? 999, description_en: provider?.description_override.en || "", includes_en: provider?.includes_override.en?.join("\n") || "", attire_ids: data.providerServiceAttires.filter((item) => item.admin_girl_service_id === adminService.id && item.is_active).map((item) => item.attire_id) }) }, [adminService, provider, data.providerServiceAttires, form])
  if (!adminService || !service) return null
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>{localizedText(service.title, "zh") || localizedText(service.title)} · 技师发布设置</DialogTitle></DialogHeader><Form {...form}><form className="space-y-4" onSubmit={form.handleSubmit((values) => { const now = new Date().toISOString(); const audit = createAuditFields(now); const value: PrivateProviderService = { ...(provider || { ...audit, admin_girl_service_id: adminService.id, badge: null }), is_published: values.is_published, sort_order: values.sort_order, description_override: { ...(provider?.description_override || {}), en: values.description_en }, includes_override: { ...(provider?.includes_override || {}), en: splitList(values.includes_en) }, updated_by: null, updated_at: now }; const bindings = values.attire_ids.map((attireId, index) => ({ ...audit, admin_girl_service_id: adminService.id, attire_id: attireId, sort_order: (index + 1) * 10, is_active: true, updated_by: null, updated_at: now })); onSave(value, bindings) })}><div className="rounded-lg bg-muted/50 p-3 text-sm">公开价格预览：{adminService.duration_minutes} 分钟 · ฿{adminService.price.toLocaleString()}</div><div className="grid gap-3 sm:grid-cols-2"><FormField control={form.control} name="is_published" render={({ field }) => <FormItem className="flex items-center justify-between rounded-lg border p-3"><FormLabel>在该技师页面发布</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>} /><FormField control={form.control} name="sort_order" render={({ field }) => <FormItem><FormLabel>技师内排序</FormLabel><FormControl><Input type="number" min={0} {...field} /></FormControl><FormMessage /></FormItem>} /></div><FormField control={form.control} name="description_en" render={({ field }) => <FormItem><FormLabel>技师专属服务介绍（EN）</FormLabel><FormControl><Textarea rows={4} {...field} /></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="includes_en" render={({ field }) => <FormItem><FormLabel>包含内容（EN，每行或逗号分隔）</FormLabel><FormControl><Textarea rows={4} {...field} /></FormControl><FormMessage /></FormItem>} />{setting?.supports_attire ? <FormField control={form.control} name="attire_ids" render={({ field }) => <FormItem><FormLabel>绑定制服</FormLabel><div className="grid gap-2 sm:grid-cols-2">{data.attires.map((attire) => <label key={attire.id} className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${!attire.is_active ? "opacity-50" : ""}`}><Checkbox checked={field.value.includes(attire.id)} disabled={!attire.is_active} onCheckedChange={(checked) => field.onChange(checked ? [...field.value, attire.id] : field.value.filter((id) => id !== attire.id))} />{attire.code} · {localizedText(attire.name)}</label>)}</div><FormMessage /></FormItem>} /> : <Alert><Shirt className="h-4 w-4" /><AlertDescription>该服务未开启 supports_attire，公开 RPC 不会返回制服。</AlertDescription></Alert>}<DialogFooter><Button type="submit">保存发布设置</Button></DialogFooter></form></Form></DialogContent></Dialog>
}
