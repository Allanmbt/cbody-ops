import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { SettlementDetailContent } from "./settlement-detail-content"

export const metadata = {
    title: "结算详情 - CBODY Ops",
    description: "订单结算详情",
}

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function SettlementDetailPage({ params }: PageProps) {
    const { id } = await params
    return (
        <Suspense fallback={<SettlementDetailSkeleton />}>
            <SettlementDetailContent settlementId={id} />
        </Suspense>
    )
}

function SettlementDetailSkeleton() {
    return (
        <div className="flex flex-col gap-6">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-[600px] w-full" />
        </div>
    )
}
