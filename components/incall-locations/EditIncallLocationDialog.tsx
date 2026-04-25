"use client"

import { useState, useCallback, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { createIncallLocationSchema, type CreateIncallLocationData } from "@/lib/features/incall-locations"
import type { IncallLocation } from "@/lib/features/incall-locations"
import { GooglePlacesInput, type PlaceResult } from "./GooglePlacesInput"
import { MultiImageUpload } from "./MultiImageUpload"
import { updateIncallLocation, uploadIncallPhoto } from "@/app/dashboard/business/incall-locations/actions"

type City = { id: number; code: string; name: { en: string; zh: string; th: string } }

interface EditIncallLocationDialogProps {
  location: IncallLocation | null
  cities: City[]
  onClose: () => void
  onUpdated: () => void
}

export function EditIncallLocationDialog({
  location,
  cities,
  onClose,
  onUpdated,
}: EditIncallLocationDialogProps) {
  const [open, setOpen] = useState(false)

  const form = useForm<CreateIncallLocationData>({
    resolver: zodResolver(createIncallLocationSchema),
    defaultValues: {
      name: "",
      address: "",
      lat: 0,
      lng: 0,
      place_id: null,
      city_id: null,
      photos: [],
      meta: { floor: "", entrance_note: "", parking: "" },
    },
  })

  useEffect(() => {
    if (location) {
      form.reset({
        name: location.name,
        address: location.address,
        lat: location.lat,
        lng: location.lng,
        place_id: location.place_id,
        city_id: location.city_id,
        photos: location.photos ?? [],
        meta: {
          floor: location.meta?.floor ?? "",
          entrance_note: location.meta?.entrance_note ?? "",
          parking: location.meta?.parking ?? "",
        },
      })
      setOpen(true)
    } else {
      setOpen(false)
    }
  }, [location, form])

  const handlePlaceSelect = useCallback((place: PlaceResult) => {
    form.setValue("name", place.name || form.getValues("name"))
    form.setValue("address", place.address)
    form.setValue("lat", place.lat)
    form.setValue("lng", place.lng)
    form.setValue("place_id", place.place_id)
    form.trigger(["name", "address", "lat", "lng"])
  }, [form])

  const handleUpload = useCallback(async (file: File): Promise<string | null> => {
    const fd = new FormData()
    fd.append("file", file)
    const result = await uploadIncallPhoto(fd)
    if (!result.ok) { toast.error(result.error || "上传失败"); return null }
    return result.data!
  }, [])

  const handleClose = () => {
    setOpen(false)
    onClose()
  }

  const onSubmit = async (data: CreateIncallLocationData) => {
    if (!location) return
    const result = await updateIncallLocation(location.id, data)
    if (!result.ok) {
      toast.error(result.error || "更新失败")
      return
    }
    toast.success("地址已更新")
    handleClose()
    onUpdated()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑到店地址</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">重新搜索地点</p>
              <GooglePlacesInput onSelect={handlePlaceSelect} />
              <p className="text-xs text-muted-foreground">选择后自动覆盖地址和坐标，也可直接修改下方字段</p>
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>地点名称 *</FormLabel>
                  <FormControl>
                    <Input placeholder="如：Thai Heaven Spa · Room 301" {...field} />
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
                    <Input placeholder="展示给顾客的完整地址" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="lat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>纬度 lat *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        placeholder="13.7563"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
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
                      <Input
                        type="number"
                        step="any"
                        placeholder="100.5018"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="city_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>城市</FormLabel>
                  <Select
                    value={field.value?.toString() || "none"}
                    onValueChange={(v) => field.onChange(v === "none" ? null : parseInt(v))}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择城市（可选）" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">不指定</SelectItem>
                      {cities.map((c) => (
                        <SelectItem key={c.id} value={c.id.toString()}>
                          {c.name?.zh || c.name?.en || c.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3 rounded-md border p-3">
              <p className="text-sm font-medium text-muted-foreground">补充信息（可选）</p>
              <FormField
                control={form.control}
                name="meta.floor"
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
                name="meta.entrance_note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>进门说明</FormLabel>
                    <FormControl>
                      <Textarea placeholder="如：扫码进门，电梯直达3楼" rows={2} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="meta.parking"
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

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                取消
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "保存中..." : "保存修改"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
