import { redirect } from "next/navigation"

import { PrivateManagement } from "@/components/private/PrivateManagement"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { requireAdmin } from "@/lib/auth"
import type { PrivatePagePermissions, PrivateSection } from "@/lib/features/private"
import { getPrivateManagementData } from "./actions"

const validSections = new Set<PrivateSection>(["providers", "availability", "catalog", "venues", "orders"])

export default async function PrivateManagementPage({
  searchParams,
}: {
  searchParams: Promise<{
    section?: string
    girl?: string
  }>
}) {
  let admin
  try {
    admin = await requireAdmin(["superadmin", "admin", "support"])
  } catch {
    redirect("/login")
  }

  const params = await searchParams
  const requestedSection = validSections.has(params.section as PrivateSection)
    ? params.section as PrivateSection
    : "providers"
  const canViewOrderStats = admin.role === "superadmin" || admin.role === "admin"
  const initialSection = requestedSection === "orders" && !canViewOrderStats
    ? "providers"
    : requestedSection
  const permissions: PrivatePagePermissions = {
    role: admin.role,
    canManageContent: admin.role === "superadmin" || admin.role === "admin",
    canManageAvailability: true,
    canDeleteAvailability: admin.role === "superadmin" || admin.role === "admin",
    canViewOrderStats,
  }
  const dataResult = await getPrivateManagementData()
  if (!dataResult.ok) {
    return (
      <Alert variant="destructive">
        <AlertTitle>到店管理数据加载失败</AlertTitle>
        <AlertDescription>{dataResult.error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <PrivateManagement
      initialData={dataResult.data}
      permissions={permissions}
      initialSection={initialSection}
      initialGirlId={params.girl}
    />
  )
}
