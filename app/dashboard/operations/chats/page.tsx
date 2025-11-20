import { ChatMonitoringPage } from "@/components/operations/chats/ChatMonitoringPage"
import { getChatStats, getChatThreads } from "./actions"

// ✅ 优化：改为 Server Component，在服务端获取初始数据
export default async function ChatsPage() {
    // 并行获取统计和会话列表
    const [statsResult, threadsResult] = await Promise.all([
        getChatStats(),
        getChatThreads({ only_active: true, page: 1, limit: 50 })
    ])

    const initialStats = statsResult.ok ? statsResult.data : null
    const initialThreads = threadsResult.ok ? threadsResult.data.threads : []
    const initialTotal = threadsResult.ok ? threadsResult.data.total : 0

    return (
        <ChatMonitoringPage
            initialStats={initialStats}
            initialThreads={initialThreads}
            initialTotal={initialTotal}
        />
    )
}
