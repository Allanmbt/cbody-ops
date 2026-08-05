"use client"

import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Trash2, Users } from "lucide-react"
import { toast } from "sonner"

import { getPrivateAvailabilityForDate } from "@/app/dashboard/business/private/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  bangkokDate,
  createAuditFields,
  formatAvailabilityTime,
  privateAvailabilityFormSchema,
  type PrivateAvailability,
  type PrivateAvailabilityFormData,
  type PrivateDataset,
  type PrivateMutationDispatcher,
  type PrivatePagePermissions,
} from "@/lib/features/private"

interface AvailabilityPanelProps {
  data: PrivateDataset
  dispatch: PrivateMutationDispatcher
  permissions: PrivatePagePermissions
  girlId?: string
  compact?: boolean
}

function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00`)
  value.setDate(value.getDate() + days)
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`
}

function createRecord(
  girlId: string,
  date: string,
  values: PrivateAvailabilityFormData,
  existing?: PrivateAvailability
): PrivateAvailability {
  const now = new Date().toISOString()
  return {
    ...(existing || { ...createAuditFields(now), id: crypto.randomUUID(), girl_id: girlId, service_date: date }),
    is_available: values.is_available,
    start_time: values.start_time || null,
    end_time: values.end_time || null,
    ends_next_day: values.ends_next_day,
    note: { ...(existing?.note || {}), en: values.note_en },
    updated_by: null,
    updated_at: now,
  }
}

export function AvailabilityPanel({ data, dispatch, permissions, girlId, compact = false }: AvailabilityPanelProps) {
  const [selectedDate, setSelectedDate] = useState(bangkokDate())
  const [editingGirlId, setEditingGirlId] = useState<string | null>(null)
  const [batchOpen, setBatchOpen] = useState(false)
  const [selectedGirlIds, setSelectedGirlIds] = useState<Set<string>>(new Set())
  const [remoteRecords, setRemoteRecords] = useState<PrivateAvailability[]>([])
  const [isLoadingDate, setIsLoadingDate] = useState(false)

  useEffect(() => {
    let active = true
    setIsLoadingDate(true)
    getPrivateAvailabilityForDate(selectedDate).then((result) => {
      if (!active) return
      setIsLoadingDate(false)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setRemoteRecords(result.data)
    })
    return () => { active = false }
  }, [selectedDate])

  const girls = useMemo(
    () => data.girls.filter((girl) => girl.incall_enabled && (!girlId || girl.id === girlId)),
    [data.girls, girlId]
  )

  const recordMap = useMemo(
    () => new Map(
      [...remoteRecords, ...data.availability]
        .filter((item) => item.service_date === selectedDate)
        .map((item) => [item.girl_id, item])
    ),
    [data.availability, remoteRecords, selectedDate]
  )

  const editingRecord = editingGirlId ? recordMap.get(editingGirlId) : undefined
  const form = useForm<PrivateAvailabilityFormData>({
    resolver: zodResolver(privateAvailabilityFormSchema) as any,
    defaultValues: { is_available: true, start_time: "15:00", end_time: "23:00", ends_next_day: false, note_en: "" },
  })

  useEffect(() => {
    form.reset({
      is_available: editingRecord?.is_available ?? true,
      start_time: editingRecord?.start_time?.slice(0, 5) || "15:00",
      end_time: editingRecord?.end_time?.slice(0, 5) || "23:00",
      ends_next_day: editingRecord?.ends_next_day ?? false,
      note_en: editingRecord?.note.en || "",
    })
  }, [editingRecord, editingGirlId, form])

  const saveOne = (values: PrivateAvailabilityFormData) => {
    if (!editingGirlId) return
    dispatch({ type: "UPSERT_AVAILABILITY", value: createRecord(editingGirlId, selectedDate, values, editingRecord) })
    setEditingGirlId(null)
  }

  const saveBatch = (values: PrivateAvailabilityFormData) => {
    if (selectedGirlIds.size === 0) {
      toast.error("请至少选择一名技师")
      return
    }
    const records = [...selectedGirlIds].map((id) =>
      createRecord(id, selectedDate, values, recordMap.get(id))
    )
    dispatch({ type: "UPSERT_AVAILABILITY_BATCH", values: records })
    setBatchOpen(false)
    setSelectedGirlIds(new Set())
  }

  const deleteRecord = (record: PrivateAvailability) => {
    if (!permissions.canDeleteAvailability) return
    dispatch({ type: "DELETE_AVAILABILITY", id: record.id })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="icon" aria-label="上一天" onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}>
              <ChevronLeft />
            </Button>
            <Input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="w-[160px]"
              aria-label="排班日期"
            />
            <Button variant="outline" size="icon" aria-label="下一天" onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}>
              <ChevronRight />
            </Button>
            <Button variant={selectedDate === bangkokDate() ? "secondary" : "outline"} onClick={() => setSelectedDate(bangkokDate())}>
              今天（曼谷）
            </Button>
            {isLoadingDate && <span className="text-xs text-muted-foreground">加载中…</span>}
          </div>
          {!compact && permissions.canManageAvailability && (
            <Button onClick={() => setBatchOpen(true)} disabled={selectedGirlIds.size === 0}>
              <Users className="mr-2 h-4 w-4" />
              批量设置 {selectedGirlIds.size > 0 ? `(${selectedGirlIds.size})` : ""}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4" /> {selectedDate} 排班
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {girls.map((girl) => {
            const record = recordMap.get(girl.id)
            return (
              <div key={girl.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center">
                {!compact && (
                  <Checkbox
                    checked={selectedGirlIds.has(girl.id)}
                    onCheckedChange={(checked) => {
                      setSelectedGirlIds((current) => {
                        const next = new Set(current)
                        if (checked) next.add(girl.id)
                        else next.delete(girl.id)
                        return next
                      })
                    }}
                    aria-label={`选择 ${girl.name}`}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-medium">No. {girl.girl_number} · {girl.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant={record?.is_available ? "default" : "secondary"}>
                      {record ? (record.is_available ? "可约" : "不可约") : "未排班"}
                    </Badge>
                    {record && <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{formatAvailabilityTime(record.start_time, record.end_time, record.ends_next_day)}</span>}
                    {record?.note.en && <span className="truncate">· {record.note.en}</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!permissions.canManageAvailability}
                    onClick={() => setEditingGirlId(girl.id)}
                  >
                    {record ? "编辑" : "新增"}
                  </Button>
                  {record && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="删除排班"
                      disabled={!permissions.canDeleteAvailability}
                      onClick={() => deleteRecord(record)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
          {girls.length === 0 && <div className="py-10 text-center text-sm text-muted-foreground">暂无支持 Incall 的技师</div>}
        </CardContent>
      </Card>

      <AvailabilityDialog
        open={Boolean(editingGirlId)}
        title={editingRecord ? "编辑排班" : "新增排班"}
        form={form}
        onOpenChange={(open) => !open && setEditingGirlId(null)}
        onSubmit={saveOne}
      />

      <BatchAvailabilityDialog
        open={batchOpen}
        count={selectedGirlIds.size}
        onOpenChange={setBatchOpen}
        onSubmit={saveBatch}
      />
    </div>
  )
}

function AvailabilityFields({ form }: { form: ReturnType<typeof useForm<PrivateAvailabilityFormData>> }) {
  return (
    <div className="space-y-4">
      <FormField control={form.control} name="is_available" render={({ field }) => (
        <FormItem className="flex items-center justify-between rounded-lg border p-3">
          <div><FormLabel>当日可约</FormLabel><p className="text-xs text-muted-foreground">关闭时仍保留当天记录</p></div>
          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
        </FormItem>
      )} />
      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="start_time" render={({ field }) => (
          <FormItem><FormLabel>开始时间</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="end_time" render={({ field }) => (
          <FormItem><FormLabel>结束时间</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
      </div>
      <FormField control={form.control} name="ends_next_day" render={({ field }) => (
        <FormItem className="flex items-center justify-between rounded-lg border p-3">
          <FormLabel>结束时间属于次日</FormLabel>
          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={form.control} name="note_en" render={({ field }) => (
        <FormItem><FormLabel>英文排班说明</FormLabel><FormControl><Textarea placeholder="Optional note" {...field} /></FormControl><FormMessage /></FormItem>
      )} />
    </div>
  )
}

function AvailabilityDialog({ open, title, form, onOpenChange, onSubmit }: {
  open: boolean
  title: string
  form: ReturnType<typeof useForm<PrivateAvailabilityFormData>>
  onOpenChange: (open: boolean) => void
  onSubmit: (values: PrivateAvailabilityFormData) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <AvailabilityFields form={form} />
            <DialogFooter><Button type="submit">保存排班</Button></DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function BatchAvailabilityDialog({ open, count, onOpenChange, onSubmit }: {
  open: boolean
  count: number
  onOpenChange: (open: boolean) => void
  onSubmit: (values: PrivateAvailabilityFormData) => void
}) {
  const form = useForm<PrivateAvailabilityFormData>({
    resolver: zodResolver(privateAvailabilityFormSchema) as any,
    defaultValues: { is_available: true, start_time: "15:00", end_time: "23:00", ends_next_day: false, note_en: "" },
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>批量设置 {count} 名技师</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <AvailabilityFields form={form} />
            <DialogFooter><Button type="submit">应用到已选择技师</Button></DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
