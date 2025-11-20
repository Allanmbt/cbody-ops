import { OrderMonitoringPage } from "@/components/operations/orders/OrderMonitoringPage"
import { getOrderStats, getMonitoringOrders } from "./actions"

export const metadata = {
  title: "订单监控 - 运营管理",
  description: "实时监控进行中的订单，快速发现异常"
}

/**
 * 订单监控页面
 * ✅ 优化：使用 Server Component 在服务端获取初始数据
 */
export default async function OperationsOrdersPage() {
  // 服务端并行获取统计数据和订单列表
  const [statsResult, ordersResult] = await Promise.all([
    getOrderStats(),
    getMonitoringOrders({
      time_range: 'today',
      page: 1,
      limit: 50
    })
  ])

  return (
    <OrderMonitoringPage
      initialStats={statsResult.ok ? statsResult.data : null}
      initialOrders={ordersResult.ok && ordersResult.data ? ordersResult.data.orders : []}
      initialTotal={ordersResult.ok && ordersResult.data ? ordersResult.data.total : 0}
    />
  )
}
