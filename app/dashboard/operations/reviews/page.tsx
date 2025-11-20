import { ReviewsPage } from "@/components/operations/reviews/ReviewsPage"
import { getReviewStats, getReviews } from "./actions"

export const metadata = {
    title: "评论审核 - 运营管理",
    description: "审核用户提交的订单评价",
}

// ✅ 优化：改为 Server Component，在服务端获取初始数据
export default async function Page() {
    // 并行获取统计和评论列表
    const [statsResult, reviewsResult] = await Promise.all([
        getReviewStats(),
        getReviews({ status: "pending", page: 1, limit: 50 })
    ])

    const initialStats = statsResult.ok ? statsResult.data : null
    const initialReviews = reviewsResult.ok && reviewsResult.data ? reviewsResult.data.reviews : []
    const initialTotal = reviewsResult.ok && reviewsResult.data ? reviewsResult.data.total : 0

    return (
        <ReviewsPage
            initialStats={initialStats}
            initialReviews={initialReviews}
            initialTotal={initialTotal}
        />
    )
}
