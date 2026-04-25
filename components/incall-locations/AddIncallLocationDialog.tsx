"use client"

import { useState, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus } from "lucide-react"
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
import { GooglePlacesInput, type PlaceResult } from "./GooglePlacesInput"
import { MultiImageUpload } from "./MultiImageUpload"
import { createIncallLocation, uploadIncallPhoto } from "@/app/dashboard/business/incall-locations/actions"

type City = { id: number; code: string; name: { en: string; zh: string; th: string } }

interface AddIncallLocationDialogProps {
  cities: City[]
  onCreated: () => void
}

export function AddIncallLocationDialog({ cities, onCreated }: AddIncallLocationDialogProps) {
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

  const onSubmit = async (data: CreateIncallLocationData) => {
    const result = await createIncallLocation(data)
    if (!result.ok) {
      toast.error(result.error || "创建失败")
      return
    }
    toast.success("地址已创建")
    setOpen(false)
    form.reset()
    onCreated()
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        新增地址
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) form.reset() }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新增到店地址</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Google Places 搜索 */}
              <div className="space-y-1">
                <p className="text-sm font-medium">搜索地点</p>
                <GooglePlacesInput onSelect={handlePlaceSelect} />
                <p className="text-xs text-muted-foreground">选择后自动填入地址和坐标</p>
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

              {/* 图片上传 */}
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

              {/* Meta 可选字段 */}
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
                        <Textarea
                          placeholder="如：扫码进门，电梯直达3楼"
                          rows={2}
                          {...field}
                        />
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setOpen(false); form.reset() }}
                >
                  取消
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "创建中..." : "创建地址"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
