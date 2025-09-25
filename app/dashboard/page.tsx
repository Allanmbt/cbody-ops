import { DashboardLayout } from "@/components/dashboard-layout"
import { DashboardContent } from "./dashboard-content"

export default function DashboardPage() {
  return (
    <DashboardLayout breadcrumb={[{ label: "概览" }]}>
      <DashboardContent />
    </DashboardLayout>
  )
}