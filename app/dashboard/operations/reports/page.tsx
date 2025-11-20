import { ReportsPage } from "@/components/operations/reports/ReportsPage"
import { getReportStats, getReports } from "./actions"

export const metadata = {
    title: "举报处理 - 运营管理",
    description: "查看并处理用户与技师的举报记录",
}

// ✅ 优化：改为 Server Component，在服务端获取初始数据
export default async function OperationsReportsPage() {
    // 并行获取统计和举报列表
    const [statsResult, reportsResult] = await Promise.all([
        getReportStats(),
        getReports({ status: "pending", page: 1, limit: 50 })
    ])

    const initialStats = statsResult.ok ? statsResult.data : null
    const initialReports = reportsResult.ok && reportsResult.data ? reportsResult.data.reports : []
    const initialTotal = reportsResult.ok && reportsResult.data ? reportsResult.data.total : 0

    return (
        <ReportsPage
            initialStats={initialStats}
            initialReports={initialReports}
            initialTotal={initialTotal}
        />
    )
}
