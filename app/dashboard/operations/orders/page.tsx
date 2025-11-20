import { Suspense } from "react"
import { OrderMonitoringPage } from "@/components/operations/orders/OrderMonitoringPage"
import { LoadingSpinner } from "@/components/ui/loading"

export const metadata = {
  title: "订单监控 - 运营管理",
  description: "实时监控进行中的订单，快速发现异常"
}

export default function OperationsOrdersPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <OrderMonitoringPage />
    </Suspense>
  )
}
