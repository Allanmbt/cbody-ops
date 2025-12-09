"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { LoadingSpinner } from "@/components/ui/loading"
import { Eye, Lock, Unlock, Copy, Check } from "lucide-react"
import { formatRelativeTime } from "@/lib/features/orders"
import { toast } from "sonner"
import { ChatThreadDrawer } from "@/components/operations/chats/ChatThreadDrawer"
import { CustomerDetailDialog } from "@/components/operations/chats/CustomerDetailDialog"
import { toggleThreadLock } from "@/app/dashboard/operations/chats/actions"

interface ChatThreadTableProps {
    threads: any[]
    loading?: boolean
    onRefresh: () => void
}

/**
 * 从多语言对象或字符串中提取文本
 */
function getDisplayText(value: any): string {
    if (!value) return ''
    if (typeof value === 'string') return value
    if (typeof value === 'object') {
        // 优先顺序：zh > en > th > 第一个可用的值
        return value.zh || value.en || value.th || Object.values(value)[0] || ''
    }
    return String(value)
}

/**
 * 获取会话类型显示
 */
function getThreadTypeBadge(type: string) {
    switch (type) {
        case 'c2g':
            return <Badge variant="default">客户↔技师</Badge>
        case 's2c':
            return <Badge variant="secondary">客服↔客户</Badge>
        case 's2g':
            return <Badge variant="secondary">客服↔技师</Badge>
        default:
            return <Badge variant="outline">{type}</Badge>
    }
}

/**
 * 获取参与者显示
 */
function getParticipants(thread: any): string {
    const parts: string[] = []

    if (thread.customer) {
        parts.push(getDisplayText(thread.customer.display_name) || getDisplayText(thread.customer.username) || '客户')
    }

    if (thread.girl) {
        parts.push(getDisplayText(thread.girl.name) || `#${thread.girl.girl_number}`)
    }

    if (thread.support) {
        parts.push(getDisplayText(thread.support.display_name) || getDisplayText(thread.support.username) || '客服')
    }

    return parts.join(' ↔ ')
}

/**
 * 一键复制订单号
 */
function CopyOrderButton({ orderNumber }: { orderNumber: string }) {
    const [copied, setCopied] = useState(false)

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(orderNumber)
            setCopied(true)
            toast.success("订单号已复制")
            setTimeout(() => setCopied(false), 2000)
        } catch (error) {
            toast.error("复制失败")
        }
    }

    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-6 px-2"
        >
            {copied ? (
                <Check className="h-3 w-3 text-green-600" />
            ) : (
                <Copy className="h-3 w-3" />
            )}
        </Button>
    )
}

export function ChatThreadTable({
    threads,
    loading = false,
    onRefresh
}: ChatThreadTableProps) {
    const [selectedThread, setSelectedThread] = useState<any | null>(null)
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [lockingThreadId, setLockingThreadId] = useState<string | null>(null)
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
    const [threadToToggle, setThreadToToggle] = useState<any | null>(null)
    const [customerDetailOpen, setCustomerDetailOpen] = useState(false)
    const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null)

    const handleViewDetail = (thread: any) => {
        setSelectedThread(thread)
        setDrawerOpen(true)
    }

    const handleViewCustomerDetail = (customer: any) => {
        setSelectedCustomer(customer)
        setCustomerDetailOpen(true)
    }

    const handleToggleLockClick = (thread: any) => {
        setThreadToToggle(thread)
        setConfirmDialogOpen(true)
    }

    const handleConfirmToggleLock = async () => {
        if (!threadToToggle) return

        setLockingThreadId(threadToToggle.id)
        setConfirmDialogOpen(false)

        const result = await toggleThreadLock(threadToToggle.id, !threadToToggle.is_locked)

        if (result.ok) {
            toast.success(threadToToggle.is_locked ? "会话已解锁" : "会话已锁定")
            onRefresh()
        } else {
            toast.error(result.error || "操作失败")
        }

        setLockingThreadId(null)
        setThreadToToggle(null)
    }

    const handleCancelToggleLock = () => {
        setConfirmDialogOpen(false)
        setThreadToToggle(null)
    }

    return (
        <>
            <div className="rounded-md border-t">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[100px]">类型</TableHead>
                            <TableHead className="w-[180px]">参与者</TableHead>
                            <TableHead className="w-[120px]">关联订单</TableHead>
                            <TableHead className="w-[200px]">最后消息</TableHead>
                            <TableHead className="w-[100px]">最后时间</TableHead>
                            <TableHead className="w-[120px]">未读数</TableHead>
                            <TableHead className="w-[80px]">状态</TableHead>
                            <TableHead className="w-[140px] text-center">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={8} className="h-24 text-center">
                                    <LoadingSpinner />
                                </TableCell>
                            </TableRow>
                        ) : threads.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="h-24 text-center">
                                    <div className="flex flex-col items-center gap-2">
                                        <p className="text-muted-foreground">暂无会话记录</p>
                                        <p className="text-sm text-muted-foreground">调整筛选条件以查看更多会话</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            threads.map((thread) => (
                                <TableRow key={thread.id}>
                                    {/* 类型 */}
                                    <TableCell>
                                        {getThreadTypeBadge(thread.thread_type)}
                                    </TableCell>

                                    {/* 参与者 */}
                                    <TableCell>
                                        <span className="text-sm">
                                            {thread.customer && (
                                                <>
                                                    <button
                                                        onClick={() => handleViewCustomerDetail(thread.customer)}
                                                        className="underline hover:text-primary transition-colors"
                                                        title="查看客户详情"
                                                    >
                                                        {getDisplayText(thread.customer.display_name) || getDisplayText(thread.customer.username) || '客户'}
                                                    </button>
                                                    {(thread.girl || thread.support) && ' ↔ '}
                                                </>
                                            )}
                                            {thread.girl && (
                                                <>
                                                    {getDisplayText(thread.girl.name) || `#${thread.girl.girl_number}`}
                                                    {thread.support && ' ↔ '}
                                                </>
                                            )}
                                            {thread.support && (
                                                getDisplayText(thread.support.display_name) || getDisplayText(thread.support.username) || '客服'
                                            )}
                                        </span>
                                    </TableCell>

                                    {/* 关联订单 */}
                                    <TableCell>
                                        {thread.order ? (
                                            <div className="flex items-center gap-1">
                                                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                                    {thread.order.order_number}
                                                </code>
                                                <CopyOrderButton orderNumber={thread.order.order_number} />
                                            </div>
                                        ) : (
                                            <span className="text-sm text-muted-foreground">-</span>
                                        )}
                                    </TableCell>

                                    {/* 最后消息 */}
                                    <TableCell>
                                        {thread.last_message_text ? (
                                            <span className="text-sm line-clamp-1">
                                                {thread.last_message_text.length > 30
                                                    ? `${thread.last_message_text.substring(0, 30)}...`
                                                    : thread.last_message_text}
                                            </span>
                                        ) : (
                                            <span className="text-sm text-muted-foreground">暂无消息</span>
                                        )}
                                    </TableCell>

                                    {/* 最后时间 */}
                                    <TableCell>
                                        {thread.last_message_at ? (
                                            <span className="text-sm">{formatRelativeTime(thread.last_message_at)}</span>
                                        ) : (
                                            <span className="text-sm text-muted-foreground">-</span>
                                        )}
                                    </TableCell>

                                    {/* 未读数 */}
                                    <TableCell>
                                        <div className="flex flex-col gap-0.5 text-xs">
                                            {thread.unread_counts?.customer !== undefined && (
                                                <span>客户: {thread.unread_counts.customer}</span>
                                            )}
                                            {thread.unread_counts?.girl !== undefined && (
                                                <span>技师: {thread.unread_counts.girl}</span>
                                            )}
                                            {!thread.unread_counts?.customer && !thread.unread_counts?.girl && (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </div>
                                    </TableCell>

                                    {/* 状态 */}
                                    <TableCell>
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
                                    </TableCell>

                                    {/* 操作 */}
                                    <TableCell className="text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleViewDetail(thread)}
                                            >
                                                <Eye className="h-4 w-4 mr-1" />
                                                查看
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleToggleLockClick(thread)}
                                                disabled={lockingThreadId === thread.id}
                                            >
                                                {lockingThreadId === thread.id ? (
                                                    <LoadingSpinner size="sm" />
                                                ) : thread.is_locked ? (
                                                    <>
                                                        <Unlock className="h-4 w-4 mr-1" />
                                                        解锁
                                                    </>
                                                ) : (
                                                    <>
                                                        <Lock className="h-4 w-4 mr-1" />
                                                        锁定
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* 会话详情抽屉 */}
            <ChatThreadDrawer
                open={drawerOpen}
                onOpenChange={setDrawerOpen}
                thread={selectedThread}
                onRefresh={onRefresh}
            />

            {/* 客户详情弹窗 */}
            <CustomerDetailDialog
                open={customerDetailOpen}
                onOpenChange={setCustomerDetailOpen}
                customer={selectedCustomer}
            />

            {/* 锁定/解锁确认对话框 */}
            <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {threadToToggle?.is_locked ? "解锁会话" : "锁定会话"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {threadToToggle?.is_locked ? (
                                <>
                                    确定要解锁该会话吗？解锁后用户可以继续发送消息。
                                    <br />
                                    <span className="text-sm text-muted-foreground mt-2 block">
                                        参与者：{threadToToggle && getParticipants(threadToToggle)}
                                    </span>
                                </>
                            ) : (
                                <>
                                    确定要锁定该会话吗？锁定后用户将无法发送新消息。
                                    <br />
                                    <span className="text-sm text-muted-foreground mt-2 block">
                                        参与者：{threadToToggle && getParticipants(threadToToggle)}
                                    </span>
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={handleCancelToggleLock}>
                            取消
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmToggleLock}>
                            确认{threadToToggle?.is_locked ? "解锁" : "锁定"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
