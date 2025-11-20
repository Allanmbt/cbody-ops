import { TherapistMonitoringPage } from "@/components/operations/therapists/TherapistMonitoringPage"
import { getMonitoringTherapists } from "./actions"

export const metadata = {
  title: "技师状态监控 - 运营管理",
  description: "实时监控技师在线状态、位置、排队情况"
}

/**
 * 技师监控页面
 * ✅ 优化：使用 Server Component 在服务端获取初始数据
 */
export default async function OperationsTherapistsPage() {
  // 服务端获取初始数据（默认显示在线和忙碌的技师）
  const result = await getMonitoringTherapists({
    status: ['available', 'busy'],
    page: 1,
    limit: 50
  })

  return (
    <TherapistMonitoringPage
      initialTherapists={result.ok && result.data ? result.data.therapists : []}
      initialTotal={result.ok && result.data ? result.data.total : 0}
    />
  )
}
