import { DashboardLayout } from "@/components/dashboard-layout"
import { AdminContent } from "./admin-content"

export default function AdminManagementPage() {
  return (
    <DashboardLayout breadcrumb={[{ label: "管理员管理" }]}>
      <AdminContent />
    </DashboardLayout>
  )
}