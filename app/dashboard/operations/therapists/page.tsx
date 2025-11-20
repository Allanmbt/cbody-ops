import { Suspense } from "react"
import { TherapistMonitoringPage } from "@/components/operations/therapists/TherapistMonitoringPage"
import { LoadingSpinner } from "@/components/ui/loading"

export const metadata = {
  title: "技师状态监控 - 运营管理",
  description: "实时监控技师在线状态、位置、排队情况"
}

export default function OperationsTherapistsPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <TherapistMonitoringPage />
    </Suspense>
  )
}
