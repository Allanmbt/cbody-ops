import type { PrivateDataset, PrivateGirl } from "./types"

export function createAuditFields(updatedAt = new Date().toISOString()) {
  return {
    created_by: null,
    updated_by: null,
    created_at: updatedAt,
    updated_at: updatedAt,
  }
}

export function bangkokDate(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

export function localizedText(value: Record<string, string> | undefined, locale = "en"): string {
  return value?.[locale] || value?.en || ""
}

export function splitList(value: string): string[] {
  return value.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean)
}

export function formatAvailabilityTime(
  startTime: string | null,
  endTime: string | null,
  endsNextDay: boolean
): string {
  if (!startTime || !endTime) return "未设置时间"
  return `${startTime.slice(0, 5)}–${endTime.slice(0, 5)}${endsNextDay ? " 次日" : ""}`
}

export function hasSensitiveLocationName(name: string): boolean {
  return /\b(room|unit|floor|suite)\b/i.test(name)
}

export function getEffectivePublicName(
  internalName: string,
  publicName: Record<string, string> | undefined
): { value: string; source: "internal" | "private" } {
  if (hasSensitiveLocationName(internalName)) {
    return { value: localizedText(publicName) || "未设置安全公开名称", source: "private" }
  }
  return { value: internalName, source: "internal" }
}

export interface ProviderReadiness {
  ready: boolean
  passed: number
  total: number
  blockers: string[]
  warnings: string[]
}

export function getProviderReadiness(
  dataset: PrivateDataset,
  girl: PrivateGirl,
  _today: string
): ProviderReadiness {
  const profile = dataset.profiles.find((item) => item.girl_id === girl.id)
  const location = dataset.locations.find((item) => item.id === girl.incall_location_id)
  const locationContent = dataset.locationContent.find(
    (item) => item.incall_location_id === girl.incall_location_id
  )
  const qualified = dataset.adminGirlServices.filter(
    (item) => item.girl_id === girl.id && item.is_qualified
  )
  const validServices = qualified.filter((adminService) => {
    const service = dataset.services.find((item) => item.id === adminService.service_id)
    const setting = dataset.serviceSettings.find((item) => item.service_id === adminService.service_id)
    const provider = dataset.providerServices.find(
      (item) => item.admin_girl_service_id === adminService.id
    )
    return Boolean(
      service?.is_active &&
      setting?.is_incall_enabled &&
      provider?.is_published &&
      adminService.duration_active
    )
  })

  const checks = [
    { ok: girl.incall_enabled, label: "未开启 Incall" },
    { ok: girl.is_verified && !girl.is_blocked && !girl.deleted_at, label: "原技师资料未通过公开条件" },
    { ok: Boolean(profile?.is_published), label: "Private 资料未发布" },
    { ok: Boolean(location?.is_active && locationContent?.is_published), label: "场所未激活或未公开" },
    { ok: validServices.length > 0, label: "没有满足公开链路的服务" },
  ]

  const warnings: string[] = []
  if (!dataset.media.some((item) => item.girl_id === girl.id && item.role === "cover" && item.is_active)) {
    warnings.push("缺少启用封面")
  }
  if (!dataset.availabilitySettings.some((item) => item.girl_id === girl.id && item.is_available)) {
    warnings.push("常规排班当前未开启可约")
  }
  if (!profile?.booking_url) warnings.push("预约 URL 为空")
  if (!profile?.health_certified) warnings.push("未开启健康认证展示")
  if (girl.category_names.length === 0) warnings.push("未绑定分类")

  const blockers = checks.filter((item) => !item.ok).map((item) => item.label)
  return {
    ready: blockers.length === 0,
    passed: checks.length - blockers.length,
    total: checks.length,
    blockers,
    warnings,
  }
}
