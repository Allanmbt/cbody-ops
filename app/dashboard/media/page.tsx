"use client"

import { useRef, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { PendingMediaList } from '@/components/media/PendingMediaList'
import { ApprovedMediaList } from '@/components/media/ApprovedMediaList'
import { RejectedMediaList } from '@/components/media/RejectedMediaList'
import { MediaStats } from '@/components/media/MediaStats'

export default function MediaManagementPage() {
    const [refreshKey, setRefreshKey] = useState(0)
    const [isRefreshing, setIsRefreshing] = useState(false)

    const handleRefresh = () => {
        setIsRefreshing(true)
        setRefreshKey(prev => prev + 1)
        // 给用户一个视觉反馈
        setTimeout(() => setIsRefreshing(false), 1000)
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">媒体管理</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        审核技师上传的照片、视频和实况照片
                    </p>
                </div>
                <Button
                    size="default"
                    variant="outline"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="cursor-pointer"
                    title="刷新数据"
                >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                    刷新
                </Button>
            </div>

            {/* 统计卡片 */}
            <MediaStats key={`stats-${refreshKey}`} />

            {/* 分页标签 */}
            <Tabs defaultValue="pending" className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-3">
                    <TabsTrigger value="pending">待审核</TabsTrigger>
                    <TabsTrigger value="approved">已发布</TabsTrigger>
                    <TabsTrigger value="rejected">已驳回</TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="mt-6">
                    <PendingMediaList key={`pending-${refreshKey}`} />
                </TabsContent>

                <TabsContent value="approved" className="mt-6">
                    <ApprovedMediaList key={`approved-${refreshKey}`} />
                </TabsContent>

                <TabsContent value="rejected" className="mt-6">
                    <RejectedMediaList key={`rejected-${refreshKey}`} />
                </TabsContent>
            </Tabs>
        </div>
    )
}
