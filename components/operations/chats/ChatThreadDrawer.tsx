"use client"

import { useState, useEffect } from "react"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/ui/loading"
import { MessageSquare, Lock, Unlock } from "lucide-react"
import { getChatMessages } from "@/app/dashboard/operations/chats/actions"
import { formatRelativeTime } from "@/lib/features/orders"

interface ChatThreadDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    thread?: any | null
    onRefresh: () => void
}

/**
 * 获取发送者显示名称
 */
function getSenderName(sender: any, role: string): string {
    if (!sender) return role === 'system' ? '系统' : '未知'

    if (role === 'girl') {
        return sender.name || sender.display_name || `#${sender.girl_number}` || '技师'
    }

    return sender.display_name || sender.username || '用户'
}

/**
 * 获取头像URL（支持本地头像）
 */
function getAvatarUrl(avatarUrl: string | null | undefined): string | undefined {
    if (!avatarUrl) return undefined

    // 转换为字符串并去除空格
    const url = String(avatarUrl).trim()
    if (!url) return undefined

    // 完整URL直接返回
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) {
        return url
    }

    // avatar_数字格式转换为本地路径
    if (url.startsWith('avatar_')) {
        const number = url.replace('avatar_', '').replace('.jpg', '')
        return `/avatars/${number}.jpg`
    }

    // 纯数字也转换为本地路径
    if (/^\d+$/.test(url)) {
        return `/avatars/${url}.jpg`
    }

    return url
}

export function ChatThreadDrawer({
    open,
    onOpenChange,
    thread,
    onRefresh
}: ChatThreadDrawerProps) {
    const [loading, setLoading] = useState(false)
    const [messages, setMessages] = useState<any[]>([])
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)
    const [loadingMore, setLoadingMore] = useState(false)

    useEffect(() => {
        async function loadMessages() {
            if (!thread?.id) return

            setLoading(true)
            try {
                const result = await getChatMessages(thread.id, 1, 100)
                if (result.ok && result.data) {
                    // 后端已经倒序返回（最新在前），直接使用
                    setMessages(result.data.messages)
                    setTotal(result.data.total)
                    setPage(1)
                }
            } catch (error) {
                console.error('加载消息失败:', error)
            } finally {
                setLoading(false)
            }
        }

        if (open && thread) {
            loadMessages()
        } else if (!open) {
            setMessages([])
            setPage(1)
            setTotal(0)
        }
    }, [open, thread])

    const loadMore = async () => {
        if (!thread?.id || loadingMore) return

        setLoadingMore(true)
        try {
            const nextPage = page + 1
            const result = await getChatMessages(thread.id, nextPage, 100)
            if (result.ok && result.data) {
                // 追加更老的消息到底部
                setMessages(prev => [...prev, ...result.data.messages])
                setPage(nextPage)
            }
        } catch (error) {
            console.error('加载更多消息失败:', error)
        } finally {
            setLoadingMore(false)
        }
    }

    if (!thread) return null

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:w-[600px] sm:max-w-[600px] overflow-y-auto px-6">
                <SheetHeader className="px-0">
                    <SheetTitle className="flex items-center gap-2">
                        <MessageSquare className="w-5 h-5" />
                        会话详情
                    </SheetTitle>
                    <SheetDescription>
                        查看完整聊天记录
                    </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-4 px-0">
                    {/* 会话信息 */}
                    <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">会话状态</span>
                            {thread.is_locked ? (
                                <Badge variant="destructive" className="gap-1">
                                    <Lock className="h-3 w-3" />
                                    已锁定
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="gap-1">
                                    <Unlock className="h-3 w-3" />
                                    正常
                                </Badge>
                            )}
                        </div>

                        <div className="text-xs text-muted-foreground space-y-1">
                            <div>类型: {thread.thread_type}</div>
                            {thread.last_message_at && (
                                <div>最后消息: {formatRelativeTime(thread.last_message_at)}</div>
                            )}
                        </div>
                    </div>

                    {/* 消息列表 */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-medium">聊天记录</h3>

                        {loading ? (
                            <div className="flex justify-center py-8">
                                <LoadingSpinner />
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                暂无消息记录
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {messages.map((message) => (
                                    <div
                                        key={message.id}
                                        className="flex gap-3 p-3 rounded-lg bg-muted/30"
                                    >
                                        {/* 头像 */}
                                        <Avatar className="h-8 w-8 flex-shrink-0">
                                            <AvatarImage
                                                src={getAvatarUrl(message.sender?.avatar_url)}
                                                alt={getSenderName(message.sender, message.sender_role)}
                                            />
                                            <AvatarFallback className="text-xs">
                                                {getSenderName(message.sender, message.sender_role).substring(0, 2)}
                                            </AvatarFallback>
                                        </Avatar>

                                        {/* 消息内容 */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-sm font-medium">
                                                    {getSenderName(message.sender, message.sender_role)}
                                                </span>
                                                <Badge variant="outline" className="text-xs">
                                                    {message.sender_role}
                                                </Badge>
                                                <span className="text-xs text-muted-foreground">
                                                    {formatRelativeTime(message.created_at)}
                                                    {' '}
                                                    ({new Date(message.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })})
                                                </span>
                                            </div>

                                            {/* 文本内容 */}
                                            {message.content_type === 'text' && (
                                                <p className="text-sm whitespace-pre-wrap break-words">
                                                    {message.text_content}
                                                </p>
                                            )}

                                            {/* 图片内容 */}
                                            {message.content_type === 'image' && message.attachment_url && (
                                                <div className="mt-2">
                                                    <img
                                                        src={message.attachment_url}
                                                        alt="聊天图片"
                                                        className="max-w-full rounded-lg"
                                                        style={{ maxHeight: '300px' }}
                                                    />
                                                </div>
                                            )}

                                            {/* 系统消息 */}
                                            {message.content_type === 'system' && (
                                                <p className="text-sm text-muted-foreground italic">
                                                    {message.text_content}
                                                </p>
                                            )}

                                            {/* 关联订单 */}
                                            {message.order_id && (
                                                <div className="mt-1">
                                                    <Badge variant="secondary" className="text-xs">
                                                        订单: {message.order_id}
                                                    </Badge>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 加载更多按钮 */}
                        {!loading && messages.length > 0 && messages.length < total && (
                            <div className="flex justify-center pt-4">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={loadMore}
                                    disabled={loadingMore}
                                >
                                    {loadingMore ? (
                                        <>
                                            <LoadingSpinner size="sm" className="mr-2" />
                                            加载中...
                                        </>
                                    ) : (
                                        `加载更多 (${messages.length}/${total})`
                                    )}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}
