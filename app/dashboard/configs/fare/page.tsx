"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { LoadingSpinner } from "@/components/ui/loading"
import { ArrowLeft, Save, RotateCcw, Info } from "lucide-react"
import { toast } from "sonner"
import { getFareConfig, updateFareConfig } from "../actions"
import { fareParamsSchema } from "@/lib/features/configs"
import type { FareParamsConfig, AppConfig } from "@/lib/features/configs"

export default function FareConfigPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [configId, setConfigId] = useState<string>("")

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = useForm<FareParamsConfig>({
    resolver: zodResolver(fareParamsSchema),
  })

  // 监听开关状态
  const rainEnabled = watch("rain_enabled")
  const congestionEnabled = watch("congestion_enabled")

  // 加载配置
  useEffect(() => {
    async function loadConfig() {
      try {
        const result = await getFareConfig()
        if (result.ok && result.data) {
          const config = result.data as AppConfig
          setConfigId(config.id)
          reset(config.value_json as FareParamsConfig)
        } else {
          toast.error(result.error || "获取配置失败")
        }
      } catch (error) {
        console.error("加载配置失败:", error)
        toast.error("加载配置失败")
      } finally {
        setLoading(false)
      }
    }

    loadConfig()
  }, [reset])

  // 提交表单
  const onSubmit = async (data: FareParamsConfig) => {
    if (!configId) {
      toast.error("配置ID不存在")
      return
    }

    setSaving(true)
    try {
      const result = await updateFareConfig(configId, data)
      if (result.ok) {
        toast.success("配置已保存")
        reset(data)
      } else {
        toast.error(result.error || "保存失败")
      }
    } catch (error) {
      console.error("保存配置失败:", error)
      toast.error("保存配置失败")
    } finally {
      setSaving(false)
    }
  }

  // 重置表单
  const handleReset = () => {
    reset()
    toast.info("已重置为上次保存的配置")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/configs">
            <Button variant="ghost" size="sm" className="mb-2 gap-2">
              <ArrowLeft className="size-4" />
              返回配置管理
            </Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">车费计价配置</h1>
          <p className="text-muted-foreground mt-2">
            配置订单车费计算规则、距离分档定价和环境因素加价
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!isDirty || saving}
          >
            <RotateCcw className="mr-2 size-4" />
            重置
          </Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            disabled={!isDirty || saving}
          >
            {saving ? (
              <>
                <LoadingSpinner className="mr-2 size-4" />
                保存中...
              </>
            ) : (
              <>
                <Save className="mr-2 size-4" />
                保存配置
              </>
            )}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* 基础计价参数 */}
        <Card>
          <CardHeader>
            <CardTitle>基础计价参数</CardTitle>
            <CardDescription>设置订单的基础费用和距离定价规则</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="baseFare">基础费用（泰铢）</Label>
                <Input
                  id="baseFare"
                  type="number"
                  step="1"
                  {...register("baseFare", { valueAsNumber: true })}
                />
                {errors.baseFare && (
                  <p className="text-sm text-red-600">{errors.baseFare.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="freeDistanceKm">免费距离（公里）</Label>
                <Input
                  id="freeDistanceKm"
                  type="number"
                  step="0.1"
                  {...register("freeDistanceKm", { valueAsNumber: true })}
                />
                {errors.freeDistanceKm && (
                  <p className="text-sm text-red-600">{errors.freeDistanceKm.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="tier1PerKm">第一档单价（0-5km，泰铢/公里）</Label>
                <Input
                  id="tier1PerKm"
                  type="number"
                  step="1"
                  {...register("tier1PerKm", { valueAsNumber: true })}
                />
                {errors.tier1PerKm && (
                  <p className="text-sm text-red-600">{errors.tier1PerKm.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="tier2PerKm">第二档单价（5-15km，泰铢/公里）</Label>
                <Input
                  id="tier2PerKm"
                  type="number"
                  step="1"
                  {...register("tier2PerKm", { valueAsNumber: true })}
                />
                {errors.tier2PerKm && (
                  <p className="text-sm text-red-600">{errors.tier2PerKm.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="tier3PerKm">第三档单价（&gt;15km，泰铢/公里）</Label>
                <Input
                  id="tier3PerKm"
                  type="number"
                  step="1"
                  {...register("tier3PerKm", { valueAsNumber: true })}
                />
                {errors.tier3PerKm && (
                  <p className="text-sm text-red-600">{errors.tier3PerKm.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="perMin">时间费用（泰铢/分钟）</Label>
                <Input
                  id="perMin"
                  type="number"
                  step="1"
                  {...register("perMin", { valueAsNumber: true })}
                />
                {errors.perMin && (
                  <p className="text-sm text-red-600">{errors.perMin.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="tripMultiplier">行程倍数（1=单程, 2=来回）</Label>
                <Input
                  id="tripMultiplier"
                  type="number"
                  step="1"
                  min="1"
                  max="3"
                  {...register("tripMultiplier", { valueAsNumber: true })}
                />
                {errors.tripMultiplier && (
                  <p className="text-sm text-red-600">{errors.tripMultiplier.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="minFare">最低收费（泰铢）</Label>
                <Input
                  id="minFare"
                  type="number"
                  step="1"
                  {...register("minFare", { valueAsNumber: true })}
                />
                {errors.minFare && (
                  <p className="text-sm text-red-600">{errors.minFare.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="roundUpTo">向上取整倍数（泰铢）</Label>
                <Input
                  id="roundUpTo"
                  type="number"
                  step="1"
                  {...register("roundUpTo", { valueAsNumber: true })}
                />
                {errors.roundUpTo && (
                  <p className="text-sm text-red-600">{errors.roundUpTo.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 环境因素加价 */}
        <Card>
          <CardHeader>
            <CardTitle>环境因素加价</CardTitle>
            <CardDescription>根据天气和路况自动调整价格</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 雨天加价 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>雨天加价</Label>
                  <p className="text-sm text-muted-foreground">
                    雨天时自动按倍数增加费用
                  </p>
                </div>
                <Switch
                  checked={rainEnabled}
                  onCheckedChange={(checked) => setValue("rain_enabled", checked, { shouldDirty: true })}
                />
              </div>
              {rainEnabled && (
                <div className="ml-4 space-y-2">
                  <Label htmlFor="rain_multiplier">雨天价格倍数</Label>
                  <Input
                    id="rain_multiplier"
                    type="number"
                    step="0.01"
                    min="1"
                    max="2"
                    {...register("rain_multiplier", { valueAsNumber: true })}
                  />
                  <p className="text-xs text-muted-foreground">
                    例如：1.20 表示加价 20%
                  </p>
                  {errors.rain_multiplier && (
                    <p className="text-sm text-red-600">{errors.rain_multiplier.message}</p>
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* 拥堵加价 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>拥堵加价</Label>
                  <p className="text-sm text-muted-foreground">
                    道路拥堵时自动按倍数增加费用
                  </p>
                </div>
                <Switch
                  checked={congestionEnabled}
                  onCheckedChange={(checked) => setValue("congestion_enabled", checked, { shouldDirty: true })}
                />
              </div>
              {congestionEnabled && (
                <div className="ml-4 space-y-2">
                  <Label htmlFor="congestion_multiplier">拥堵价格倍数</Label>
                  <Input
                    id="congestion_multiplier"
                    type="number"
                    step="0.01"
                    min="1"
                    max="2"
                    {...register("congestion_multiplier", { valueAsNumber: true })}
                  />
                  <p className="text-xs text-muted-foreground">
                    例如：1.15 表示加价 15%
                  </p>
                  {errors.congestion_multiplier && (
                    <p className="text-sm text-red-600">{errors.congestion_multiplier.message}</p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ETA 缓冲时间 */}
        <Card>
          <CardHeader>
            <CardTitle>预计到达时间缓冲</CardTitle>
            <CardDescription>设置预计到达时间的额外缓冲（分钟）</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="eta_buffer_min_base">默认缓冲时间（分钟）</Label>
                <Input
                  id="eta_buffer_min_base"
                  type="number"
                  step="1"
                  min="0"
                  {...register("eta_buffer_min_base", { valueAsNumber: true })}
                />
                {errors.eta_buffer_min_base && (
                  <p className="text-sm text-red-600">{errors.eta_buffer_min_base.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="eta_buffer_min_rain">雨天额外缓冲（分钟）</Label>
                <Input
                  id="eta_buffer_min_rain"
                  type="number"
                  step="1"
                  min="0"
                  {...register("eta_buffer_min_rain", { valueAsNumber: true })}
                />
                {errors.eta_buffer_min_rain && (
                  <p className="text-sm text-red-600">{errors.eta_buffer_min_rain.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="eta_buffer_min_congestion">拥堵额外缓冲（分钟）</Label>
                <Input
                  id="eta_buffer_min_congestion"
                  type="number"
                  step="1"
                  min="0"
                  {...register("eta_buffer_min_congestion", { valueAsNumber: true })}
                />
                {errors.eta_buffer_min_congestion && (
                  <p className="text-sm text-red-600">{errors.eta_buffer_min_congestion.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

      </form>
    </div>
  )
}
