import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { SettlementsListContent } from "./settlements-list-content"

export const metadata = {
    title: "订单结算 - CBODY Ops",
    description: "订单结算管理",
}

export default function SettlementsPage() {
    return (
        <Suspense fallback={<SettlementsListSkeleton />}>
            <SettlementsListContent />
        </Suspense>
    )
}

function SettlementsListSkeleton() {
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
