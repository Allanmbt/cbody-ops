import { Suspense } from "react"
import { ReportsPage } from "@/components/operations/reports/ReportsPage"
import { LoadingSpinner } from "@/components/ui/loading"

export const metadata = {
    title: "举报处理 - 运营管理",
    description: "查看并处理用户与技师的举报记录",
}

export default function OperationsReportsPage() {
    return (
        <Suspense fallback={<LoadingSpinner />}>
            <ReportsPage />
        </Suspense>
    )
}
