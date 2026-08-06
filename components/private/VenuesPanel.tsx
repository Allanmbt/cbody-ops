"use client"

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import {
  ExternalLink,
  MapPin,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import { uploadIncallPhoto } from "@/app/dashboard/business/incall-locations/actions"
import { GooglePlacesInput, type PlaceResult } from "@/components/incall-locations/GooglePlacesInput"
import { MultiImageUpload } from "@/components/incall-locations/MultiImageUpload"
import { ListPagination } from "@/components/private/ListPagination"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  createAuditFields,
  getEffectivePublicName,
  localizedText,
  privateLocationFormSchema,
  type PrivateDataset,
  type PrivateIncallLocation,
  type PrivateLocationFormData,
  type PrivateMutationDispatcher,
  type PrivatePagePermissions,
} from "@/lib/features/private"

interface VenuesPanelProps {
  data: PrivateDataset
  dispatch: PrivateMutationDispatcher
  permissions: PrivatePagePermissions
  focusLocationId?: string | null
}

const VENUE_PAGE_SIZE = 12

export function VenuesPanel({
  data,
  dispatch,
  permissions,
  focusLocationId,
}: VenuesPanelProps) {
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [editingLocation, setEditingLocation] =
    useState<PrivateIncallLocation | null | undefined>(undefined)
  const [deletingLocation, setDeletingLocation] = useState<PrivateIncallLocation | null>(null)

  useEffect(() => {
    if (!focusLocationId) return
    const location = data.locations.find((item) => item.id === focusLocationId)
    if (location) setEditingLocation(location)
  }, [focusLocationId, data.locations])

  const locations = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return data.locations
    return data.locations.filter((item) => {
      const content = data.locationContent.find(
        (entry) => entry.incall_location_id === item.id
      )
      return [
        item.name,
        item.address,
        item.city_name,
        item.place_id || "",
        localizedText(content?.public_name),
        localizedText(content?.district),
      ].some((value) => value.toLowerCase().includes(keyword))
    })
  }, [data.locations, data.locationContent, search])

  const pageCount = Math.max(1, Math.ceil(locations.length / VENUE_PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const visibleLocations = locations.slice((safePage - 1) * VENUE_PAGE_SIZE, safePage * VENUE_PAGE_SIZE)

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount))
  }, [pageCount])

  const referenceCount = (locationId: string) =>
    data.girls.filter((girl) => girl.incall_location_id === locationId).length

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <form
            className="flex w-full max-w-xl gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              setSearch(searchInput.trim())
              setPage(1)
            }}
          >
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="搜索场所、城市、公开名称或地区"
                className="pl-9"
              />
            </div>
            <Button type="submit">
              <Search className="mr-2 h-4 w-4" />
              搜索
            </Button>
            {(search || searchInput) && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearchInput("")
                  setSearch("")
                  setPage(1)
                }}
              >
                清除
              </Button>
            )}
          </form>
          <Button
            disabled={!permissions.canManageContent}
            onClick={() => setEditingLocation(null)}
          >
            <Plus className="mr-2 h-4 w-4" />
            新增场所
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {visibleLocations.map((location) => {
          const content = data.locationContent.find(
            (item) => item.incall_location_id === location.id
          )
          const publicName = getEffectivePublicName(location.name, content?.public_name)
          const showPublicName = publicName.value.trim().toLowerCase() !== location.name.trim().toLowerCase()
          const references = referenceCount(location.id)
          return (
            <Card key={location.id} className="overflow-hidden">
              {location.photos.length > 0 && <LocationPhotoStrip photos={location.photos} />}
              <CardHeader className="p-3 pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">{location.name}</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {location.city_name} · {references} 名技师关联
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    <Badge variant={location.is_active ? "default" : "secondary"}>
                      {location.is_active ? "启用" : "停用"}
                    </Badge>
                    <Badge variant={content?.is_published ? "default" : "outline"}>
                      {content?.is_published ? "公开" : "未公开"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 p-3 pt-1">
                <div className="min-w-0">
                  {showPublicName && <div className="truncate text-sm font-medium">{publicName.value}</div>}
                  <div className="truncate text-xs text-muted-foreground">
                    {localizedText(content?.district) || "地区未设置"}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">照片 {location.photos.length} 张{location.place_id ? " · 已配置地图" : ""}</div>
                <div className="flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!permissions.canManageContent}
                    onClick={() => setEditingLocation(location)}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    编辑
                  </Button>
                  {location.place_id && (
                    <Button size="sm" variant="ghost" asChild>
                      <a
                        href={`https://www.google.com/maps/place/?q=place_id:${location.place_id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        地图
                      </a>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={!permissions.canManageContent || references > 0}
                    title={references > 0 ? "请先在技师管理解除关联" : undefined}
                    onClick={() => setDeletingLocation(location)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    删除
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <ListPagination page={safePage} pageSize={VENUE_PAGE_SIZE} total={locations.length} onPageChange={setPage} />

      {locations.length === 0 && (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            <MapPin className="mx-auto mb-3 h-8 w-8 opacity-40" />
            没有符合条件的场所
          </CardContent>
        </Card>
      )}

      <LocationSheet
        open={editingLocation !== undefined}
        location={editingLocation || null}
        content={
          editingLocation
            ? data.locationContent.find(
                (item) => item.incall_location_id === editingLocation.id
              )
            : undefined
        }
        data={data}
        canManage={permissions.canManageContent}
        onOpenChange={(open) => !open && setEditingLocation(undefined)}
        onSave={(location, content) => {
          dispatch({ type: "UPSERT_LOCATION", location, content })
          setEditingLocation(undefined)
        }}
      />

      <AlertDialog
        open={Boolean(deletingLocation)}
        onOpenChange={(open) => !open && setDeletingLocation(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除场所？</AlertDialogTitle>
            <AlertDialogDescription>
              将删除真实 incall_locations 记录及其 private_location_content。若仍有技师引用，系统会阻止删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => {
                if (deletingLocation) {
                  dispatch({ type: "DELETE_LOCATION", id: deletingLocation.id })
                }
                setDeletingLocation(null)
              }}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function LocationPhotoStrip({ photos }: { photos: string[] }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const cover = photos[0]
  return (
    <>
      <button
        type="button"
        onClick={() => setPreviewUrl(cover)}
        className="relative block aspect-[16/9] w-full cursor-zoom-in overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="预览场所图片"
      >
        <img src={cover} alt="场所图片" className="h-full w-full object-cover" />
        {photos.length > 1 && <span className="absolute bottom-2 right-2 rounded bg-black/65 px-2 py-1 text-xs text-white">{photos.length} 张</span>}
      </button>
      <Dialog open={Boolean(previewUrl)} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl border-0 bg-black/95 p-2 sm:p-3">
          <DialogHeader className="sr-only">
            <DialogTitle>环境图片预览</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <img
              src={previewUrl}
              alt="环境图片大图预览"
              className="max-h-[82vh] w-full rounded-md object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

interface LocationSheetProps {
  open: boolean
  location: PrivateIncallLocation | null
  content?: PrivateDataset["locationContent"][number]
  data: PrivateDataset
  canManage: boolean
  onOpenChange: (open: boolean) => void
  onSave: (
    location: PrivateIncallLocation,
    content: PrivateDataset["locationContent"][number] | null
  ) => void
}

function LocationSheet({
  open,
  location,
  content,
  data,
  canManage,
  onOpenChange,
  onSave,
}: LocationSheetProps) {
  const form = useForm<PrivateLocationFormData>({
    resolver: zodResolver(privateLocationFormSchema) as any,
    defaultValues: {
      name: "",
      address: "",
      lat: 13.7563,
      lng: 100.5018,
      place_id: "",
      city_id: data.cities[0]?.id ?? null,
      photos: [],
      floor: "",
      entrance_note: "",
      parking: "",
      is_active: true,
      public_name_en: "",
      public_name_zh: "",
      public_name_th: "",
      district_en: "",
      district_zh: "",
      district_th: "",
      is_published: false,
    },
  })

  useEffect(() => {
    form.reset({
      name: location?.name || "",
      address: location?.address || "",
      lat: location?.lat ?? 13.7563,
      lng: location?.lng ?? 100.5018,
      place_id: location?.place_id || "",
      city_id: location?.city_id ?? data.cities[0]?.id ?? null,
      photos: location?.photos || [],
      floor: typeof location?.meta.floor === "string" ? location.meta.floor : "",
      entrance_note:
        typeof location?.meta.entrance_note === "string"
          ? location.meta.entrance_note
          : "",
      parking:
        typeof location?.meta.parking === "string" ? location.meta.parking : "",
      is_active: location?.is_active ?? true,
      public_name_en: content?.public_name.en || "",
      public_name_zh: content?.public_name.zh || "",
      public_name_th: content?.public_name.th || "",
      district_en: content?.district.en || "",
      district_zh: content?.district.zh || "",
      district_th: content?.district.th || "",
      is_published: content?.is_published ?? false,
    })
  }, [location, content, data.cities, form, open])

  const handlePlaceSelect = useCallback(
    (place: PlaceResult) => {
      form.setValue("name", place.name || form.getValues("name"), {
        shouldDirty: true,
        shouldValidate: true,
      })
      form.setValue("address", place.address, {
        shouldDirty: true,
        shouldValidate: true,
      })
      form.setValue("lat", place.lat, { shouldDirty: true, shouldValidate: true })
      form.setValue("lng", place.lng, { shouldDirty: true, shouldValidate: true })
      form.setValue("place_id", place.place_id || "", { shouldDirty: true })
    },
    [form]
  )

  const handleUpload = useCallback(async (file: File): Promise<string | null> => {
    const formData = new FormData()
    formData.append("file", file)
    const result = await uploadIncallPhoto(formData)
    if (!result.ok) {
      toast.error(result.error || "环境图片上传失败")
      return null
    }
    return result.data || null
  }, [])

  const submit = (values: PrivateLocationFormData) => {
    const now = new Date().toISOString()
    const id = location?.id || crypto.randomUUID()
    const audit = createAuditFields(now)
    const selectedCity = data.cities.find((city) => city.id === values.city_id)
    const nextLocation: PrivateIncallLocation = {
      ...(location || {
        created_by: null,
        created_at: now,
        updated_at: now,
        id,
      }),
      name: values.name,
      address: values.address,
      lat: values.lat,
      lng: values.lng,
      place_id: values.place_id || null,
      city_id: values.city_id,
      city_name: selectedCity?.display_name || "未选择城市",
      photos: values.photos,
      meta: {
        ...(values.floor ? { floor: values.floor } : {}),
        ...(values.entrance_note ? { entrance_note: values.entrance_note } : {}),
        ...(values.parking ? { parking: values.parking } : {}),
      },
      is_active: values.is_active,
      updated_at: now,
    }
    const hasContent = Boolean(
      values.public_name_en ||
        values.public_name_zh ||
        values.public_name_th ||
        values.district_en ||
        values.district_zh ||
        values.district_th ||
        values.is_published ||
        content
    )
    const nextContent = hasContent
      ? {
          ...(content || { ...audit, incall_location_id: id }),
          public_name: {
            ...(content?.public_name || {}),
            en: values.public_name_en,
            zh: values.public_name_zh || "",
            th: values.public_name_th || "",
          },
          district: {
            ...(content?.district || {}),
            en: values.district_en,
            zh: values.district_zh || "",
            th: values.district_th || "",
          },
          is_published: values.is_published,
          updated_by: null,
          updated_at: now,
        }
      : null
    onSave(nextLocation, nextContent)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            {location ? "编辑场所与 Private 公开内容" : "新增场所与 Private 公开内容"}
          </SheetTitle>
          <SheetDescription>
            内部地址沿用原到店地址管理能力；Private 扩展仅维护安全的公开名称、地区和发布状态。
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form className="space-y-6 px-4 pb-6" onSubmit={form.handleSubmit(submit)}>
            <section className="space-y-4">
              <div>
                <h3 className="font-semibold">内部地址</h3>
                <p className="text-xs text-muted-foreground">
                  详细地址、坐标、Place ID 和补充信息仅供运营使用。
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {location ? "重新搜索地点" : "搜索地点"}
                </p>
                <GooglePlacesInput
                  onSelect={handlePlaceSelect}
                  disabled={!canManage}
                  placeholder="搜索地点名称或地址..."
                />
                <p className="text-xs text-muted-foreground">
                  选择 Google 地点后自动覆盖名称、地址、经纬度和 Place ID，仍可在下方调整。
                </p>
              </div>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>地点名称 *</FormLabel>
                    <FormControl>
                      <Input placeholder="如：Miguel's Studio Rama9" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>详细地址 *</FormLabel>
                    <FormControl>
                      <Textarea rows={2} placeholder="内部使用的完整地址" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="lat"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>纬度 lat *</FormLabel>
                      <FormControl>
                        <Input type="number" step="any" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lng"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>经度 lng *</FormLabel>
                      <FormControl>
                        <Input type="number" step="any" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="place_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Google Place ID</FormLabel>
                      <FormControl>
                        <Input placeholder="Google 地点选择后自动填入" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="city_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>城市</FormLabel>
                      <Select
                        value={field.value?.toString() || "none"}
                        onValueChange={(value) =>
                          field.onChange(value === "none" ? null : Number(value))
                        }
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择城市" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">不指定城市</SelectItem>
                          {data.cities.map((city) => (
                            <SelectItem key={city.id} value={city.id.toString()}>
                              {city.display_name} · {city.code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="photos"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>环境图片</FormLabel>
                    <FormControl>
                      <MultiImageUpload
                        value={field.value}
                        onChange={field.onChange}
                        onUpload={handleUpload}
                        max={9}
                        disabled={!canManage}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-3 rounded-lg border p-4">
                <div>
                  <h4 className="text-sm font-medium">补充信息（可选）</h4>
                  <p className="text-xs text-muted-foreground">
                    meta 仅维护楼层、进门说明和停车说明 3 项。
                  </p>
                </div>
                <FormField
                  control={form.control}
                  name="floor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>楼层</FormLabel>
                      <FormControl>
                        <Input placeholder="如：3F" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="entrance_note"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>进门说明</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={2}
                          placeholder="如：扫码进门，电梯直达 3 楼"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="parking"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>停车说明</FormLabel>
                      <FormControl>
                        <Input placeholder="如：地下停车免费" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <FormLabel>地址激活</FormLabel>
                      <p className="text-xs text-muted-foreground">停用后不能满足 Private 公开条件</p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </section>

            <section className="space-y-4 border-t pt-5">
              <div>
                <h3 className="font-semibold">Private 公开内容</h3>
                <p className="text-xs text-muted-foreground">
                  private_location_content 扩展。公开预览不会读取上方内部地址和 meta。
                </p>
              </div>
              <FormField
                control={form.control}
                name="public_name_en"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>公开名称（EN）</FormLabel>
                    <FormControl>
                      <Input placeholder="Private 页面使用的安全名称" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="district_en"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>公开地区（EN）</FormLabel>
                    <FormControl>
                      <Input placeholder="Thonglor" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <details className="rounded-lg border p-3">
                <summary className="cursor-pointer text-sm font-medium">中文与泰文</summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="public_name_zh"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>公开名称（ZH）</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="district_zh"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>地区（ZH）</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="public_name_th"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>公开名称（TH）</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="district_th"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>地区（TH）</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </details>
              <Alert>
                <ShieldAlert className="h-4 w-4" />
                <AlertDescription>
                  当前 RPC 仅在内部名称包含 Room、Unit、Floor 或 Suite 时回退到公开名称；修改 public_name 不代表一定覆盖内部名称。
                </AlertDescription>
              </Alert>
              <FormField
                control={form.control}
                name="is_published"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <FormLabel>允许 Private 网站公开</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        仍需地址激活并满足完整的技师发布链路
                      </p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </section>

            <SheetFooter className="px-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button type="submit" disabled={!canManage || form.formState.isSubmitting}>
                {location ? "保存修改" : "创建场所"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
