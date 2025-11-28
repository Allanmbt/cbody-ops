import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { TransactionsListContent } from "./transactions-list-content"

export const metadata = {
    title: "结账/提现申请管理 - CBODY Ops",
    description: "技师结账和提现申请审核管理",
}

export default function TransactionsPage() {
    return (
        <Suspense fallback={<TransactionsListSkeleton />}>
            <TransactionsListContent />
        </Suspense>
    )
}

function TransactionsListSkeleton() {
    return (
        <div className="flex flex-col gap-6 p-4 md:px-8 md:py-6">
            {/* 标题骨架 */}
            <div>
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96 mt-2" />
            </div>

            {/* 统计卡片骨架 */}
            <div className="grid gap-4 md:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-32 w-full" />
                ))}
            </div>

            {/* 筛选区域骨架 */}
            <Skeleton className="h-32 w-full" />

            {/* 列表骨架 */}
            <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                ))}
            </div>
        </div>
    )
}
