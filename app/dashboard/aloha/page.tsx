import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { AlohaManagementContent } from "./aloha-content"

export const metadata = {
    title: "จัดการ Aloha - CBODY Ops",
    description: "ระบบจัดการ Aloha",
}

export default function AlohaPage() {
    return (
        <Suspense fallback={<AlohaPageSkeleton />}>
            <AlohaManagementContent />
        </Suspense>
    )
}

function AlohaPageSkeleton() {
    return (
        <div className="flex flex-col gap-6 p-4 md:px-8 md:py-6">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96 mt-2" />
            <div className="grid gap-4 md:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-32 w-full" />
                ))}
            </div>
        </div>
    )
}
