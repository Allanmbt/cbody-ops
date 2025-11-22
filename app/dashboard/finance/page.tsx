import { redirect } from "next/navigation"

export const metadata = {
    title: "财务管理 - CBODY Ops",
    description: "财务管理",
}

export default function FinanceDashboardPage() {
    // 重定向到订单结算页面
    redirect('/dashboard/finance/settlements')
}
