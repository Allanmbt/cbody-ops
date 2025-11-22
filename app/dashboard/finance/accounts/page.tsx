import { Suspense } from "react"
import { AccountsListContent } from "./accounts-list-content"
import { PageLoading } from "@/components/ui/loading"

export const metadata = {
    title: "技师账户 - CBODY Ops",
    description: "技师结算账户管理",
}

export default function AccountsListPage() {
    return (
        <Suspense fallback={<PageLoading text="加载账户列表..." />}>
            <AccountsListContent />
        </Suspense>
    )
}
