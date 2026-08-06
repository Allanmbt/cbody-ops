"use client"

import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Clock3, Pencil, Users } from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Switch } from "@/components/ui/switch"
import {
  createAuditFields,
  formatAvailabilityTime,
  privateAvailabilitySettingFormSchema,
  type PrivateAvailabilitySetting,
  type PrivateAvailabilitySettingFormData,
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

const defaultSettingValues: PrivateAvailabilitySettingFormData = {
  is_available: false,
  start_time: "15:00",
  end_time: "02:00",
}

function endsNextDay(startTime: string, endTime: string): boolean {
  return endTime <= startTime
}

function createSetting(
  girlId: string,
  values: PrivateAvailabilitySettingFormData,
  existing?: PrivateAvailabilitySetting
): PrivateAvailabilitySetting {
  const now = new Date().toISOString()
  return {
    ...(existing || {
      ...createAuditFields(now),
      girl_id: girlId,
    }),
    is_available: values.is_available,
    start_time: values.start_time,
    end_time: values.end_time,
    ends_next_day: endsNextDay(values.start_time, values.end_time),
    note: existing?.note || { en: "" },
    updated_by: null,
    updated_at: now,
  }
}

function valuesFromSetting(
  setting?: PrivateAvailabilitySetting
): PrivateAvailabilitySettingFormData {
  return {
    is_available: setting?.is_available ?? defaultSettingValues.is_available,
    start_time: setting?.start_time?.slice(0, 5) || defaultSettingValues.start_time,
    end_time: setting?.end_time?.slice(0, 5) || defaultSettingValues.end_time,
  }
}

export function AvailabilityPanel({
  data,
  dispatch,
  permissions,
  girlId,
  compact = false,
}: AvailabilityPanelProps) {
  const [editingGirlId, setEditingGirlId] = useState<string | null>(null)
  const [batchOpen, setBatchOpen] = useState(false)
  const [selectedGirlIds, setSelectedGirlIds] = useState<Set<string>>(new Set())
  const settingsAvailable = data.capabilities.availabilitySettings

  const girls = useMemo(
    () =>
      data.girls.filter(
        (girl) => girl.incall_enabled && (!girlId || girl.id === girlId)
      ),
    [data.girls, girlId]
  )
  const settingsMap = useMemo(
    () =>
      new Map(
        data.availabilitySettings.map((setting) => [setting.girl_id, setting])
      ),
    [data.availabilitySettings]
  )
  const editingSetting = editingGirlId
    ? settingsMap.get(editingGirlId)
    : undefined

  const form = useForm<PrivateAvailabilitySettingFormData>({
    resolver: zodResolver(privateAvailabilitySettingFormSchema) as any,
    defaultValues: defaultSettingValues,
  })

  useEffect(() => {
    form.reset(valuesFromSetting(editingSetting))
  }, [editingSetting, editingGirlId, form])

  const toggleAvailability = (targetGirlId: string, isAvailable: boolean) => {
    if (!permissions.canManageAvailability || !settingsAvailable) return
    const existing = settingsMap.get(targetGirlId)
    dispatch({
      type: "UPSERT_AVAILABILITY_SETTING",
      value: createSetting(
        targetGirlId,
        { ...valuesFromSetting(existing), is_available: isAvailable },
        existing
      ),
    })
  }

  const saveOne = (values: PrivateAvailabilitySettingFormData) => {
    if (!editingGirlId) return
    dispatch({
      type: "UPSERT_AVAILABILITY_SETTING",
      value: createSetting(
        editingGirlId,
        values,
        settingsMap.get(editingGirlId)
      ),
    })
    setEditingGirlId(null)
  }

  const saveBatch = (values: PrivateAvailabilitySettingFormData) => {
    if (selectedGirlIds.size === 0) {
      toast.error("请至少选择一名技师")
      return
    }
    dispatch({
      type: "UPSERT_AVAILABILITY_SETTINGS_BATCH",
      values: [...selectedGirlIds].map((id) =>
        createSetting(id, values, settingsMap.get(id))
      ),
    })
    setBatchOpen(false)
    setSelectedGirlIds(new Set())
  }

  return (
    <div className="space-y-4">
      {!settingsAvailable && (
        <Alert variant="destructive">
          <AlertTitle>常规排班表尚未部署</AlertTitle>
          <AlertDescription>
            请先应用本次 private_availability_settings migration。旧的每日排班记录不会被删除。
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">排班管理</CardTitle>
          {!compact && permissions.canManageAvailability && (
            <Button
              onClick={() => setBatchOpen(true)}
              disabled={!settingsAvailable || selectedGirlIds.size === 0}
            >
              <Users className="mr-2 h-4 w-4" />
              批量设置
              {selectedGirlIds.size > 0 ? ` (${selectedGirlIds.size})` : ""}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {!compact && girls.length > 0 && (
            <label className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              <Checkbox
                checked={
                  selectedGirlIds.size === girls.length
                    ? true
                    : selectedGirlIds.size > 0
                      ? "indeterminate"
                      : false
                }
                onCheckedChange={(checked) =>
                  setSelectedGirlIds(
                    checked ? new Set(girls.map((girl) => girl.id)) : new Set()
                  )
                }
                aria-label="选择全部技师"
              />
              选择全部 Incall 技师
            </label>
          )}

          {girls.map((girl) => {
            const setting = settingsMap.get(girl.id)
            return (
              <div
                key={girl.id}
                className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center"
              >
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
                  <div className="font-medium">
                    No. {girl.girl_number} · {girl.name}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant={setting?.is_available ? "default" : "secondary"}>
                      {setting
                        ? setting.is_available
                          ? "当前可约"
                          : "当前关闭"
                        : "未配置"}
                    </Badge>
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5" />
                      {setting
                        ? formatAvailabilityTime(
                            setting.start_time,
                            setting.end_time
                          )
                        : "15:00–02:00"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {setting?.is_available ? "可约" : "关闭"}
                    </span>
                    <Switch
                      checked={setting?.is_available ?? false}
                      disabled={
                        !settingsAvailable || !permissions.canManageAvailability
                      }
                      onCheckedChange={(checked) =>
                        toggleAvailability(girl.id, checked)
                      }
                      aria-label={`${girl.name} 当前可约状态`}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      !settingsAvailable || !permissions.canManageAvailability
                    }
                    onClick={() => setEditingGirlId(girl.id)}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    编辑时间
                  </Button>
                </div>
              </div>
            )
          })}

          {girls.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              暂无支持 Incall 的技师
            </div>
          )}
        </CardContent>
      </Card>

      <AvailabilityDialog
        open={Boolean(editingGirlId)}
        title="编辑常规排班"
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

function AvailabilityFields({
  form,
}: {
  form: ReturnType<typeof useForm<PrivateAvailabilitySettingFormData>>
}) {
  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="is_available"
        render={({ field }) => (
          <FormItem className="flex items-center justify-between rounded-lg border p-3">
            <FormLabel>当前可约</FormLabel>
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        )}
      />
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name="start_time"
          render={({ field }) => (
            <FormItem>
              <FormLabel>开始时间</FormLabel>
              <FormControl>
                <Input type="time" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="end_time"
          render={({ field }) => (
            <FormItem>
              <FormLabel>结束时间</FormLabel>
              <FormControl>
                <Input type="time" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  )
}

function AvailabilityDialog({
  open,
  title,
  form,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  title: string
  form: ReturnType<typeof useForm<PrivateAvailabilitySettingFormData>>
  onOpenChange: (open: boolean) => void
  onSubmit: (values: PrivateAvailabilitySettingFormData) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <AvailabilityFields form={form} />
            <DialogFooter>
              <Button type="submit">保存排班</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function BatchAvailabilityDialog({
  open,
  count,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  count: number
  onOpenChange: (open: boolean) => void
  onSubmit: (values: PrivateAvailabilitySettingFormData) => void
}) {
  const form = useForm<PrivateAvailabilitySettingFormData>({
    resolver: zodResolver(privateAvailabilitySettingFormSchema) as any,
    defaultValues: {
      ...defaultSettingValues,
      is_available: true,
    },
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>批量设置 {count} 名技师</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <AvailabilityFields form={form} />
            <DialogFooter>
              <Button type="submit">应用排班</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
