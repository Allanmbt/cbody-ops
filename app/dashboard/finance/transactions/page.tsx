import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { TransactionsListContent } from "./transactions-list-content"

export const metadata = {
    title: "交易记录 - CBODY Ops",
    description: "结算交易记录管理",
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
        <div className="flex flex-col gap-6">
            <div>
                <Skeleton className="h-9 w-48" />
                <Skeleton className="h-5 w-64 mt-2" />
            </div>
            <Skeleton className="h-[600px] w-full" />
        </div>
    )
}
