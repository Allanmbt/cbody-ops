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
import { LoadingSpinner } from "@/components/ui/loading"
import { formatRelativeTime } from "@/lib/features/orders"
import { toast } from "sonner"
import { AlertCircle, User, Clock, FileText, Shield } from "lucide-react"

interface CancellationDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    orderId: string | null
    orderNumber?: string
}

// 临时类型定义
interface OrderCancellation {
    id: string
    order_id: string
    cancelled_at: string
    cancelled_by_role: string
    cancelled_by_user_id: string | null
    reason_code: string | null
    reason_note: string | null
    previous_status: string | null
    created_at: string
    cancelled_by_profile?: {
        user_id: string
        display_name: string | null
        avatar_url: string | null
        girl_name?: string | null
        girl_number?: number | null
    } | null
}

// 取消方角色标签
function getRoleLabel(role: string) {
    const map: Record<string, string> = {
        user: "客户",
        therapist: "技师",
        admin: "管理员",
        system: "系统",
    }
    return map[role] || role
}

// 订单状态标签
function getStatusLabel(status: string | null) {
    if (!status) return "未知"
    const map: Record<string, string> = {
        pending: "待确认",
        confirmed: "已确认",
        en_route: "在路上",
        arrived: "已到达",
        in_service: "服务中",
        completed: "已完成",
        cancelled: "已取消",
    }
    return map[status] || status
}

// 取消原因代码翻译
function getReasonCodeLabel(code: string | null) {
    if (!code) return null

    // 技师取消理由（大写下划线格式）
    const therapistReasons: Record<string, string> = {
        "CLIENT_UNREACH": "联系不上客户",
        "AREA_OUT": "超出服务范围 / 太远了",
        "DUP_ORDER": "重复订单 / 时间冲突",
        "CLIENT_REQ": "客户要求取消",
        "ADDR_ISSUE": "地址有问题 / 找不到",
        "CLIENT_CANCEL": "客户要求取消",
        "EMERGENCY": "紧急情况（健康 / 意外）",
        "CLIENT_NO_RESP": "客户不接电话 / 没人应答",
        "CLIENT_REFUSE": "客户现场拒绝服务",
        "DENY_ENTRY": "门禁 / 保安不让进",
        "SAFETY_ISSUE": "安全问题（客户行为不当）",
        "OTHER": "其他原因",
    }

    // 客户取消理由（小写下划线格式）
    const userReasons: Record<string, string> = {
        "user_change_mind": "改变主意 / 想换技师",
        "user_wrong_info": "地址或时间错误",
        "user_waiting_too_long": "等待确认时间过长",
        "user_price_not_ok": "价格或服务不合适",
        "user_personal_issue": "个人紧急情况",
        "user_want_modify": "想改时间或服务",
        "user_slow_reply": "技师回复太慢 / 沟通不畅",
        "user_found_other": "找到其他安排",
        "other_user": "其他原因",
    }

    return therapistReasons[code] || userReasons[code] || code
}

export function CancellationDrawer({ open, onOpenChange, orderId, orderNumber }: CancellationDrawerProps) {
    const [loading, setLoading] = useState(false)
    const [cancellation, setCancellation] = useState<OrderCancellation | null>(null)

    useEffect(() => {
        if (open && orderId) {
            loadCancellation()
        }
    }, [open, orderId])

    const loadCancellation = async () => {
        if (!orderId) return

        setLoading(true)
        // TODO: 实现 getOrderCancellation API
        // const result = await getOrderCancellation(orderId)
        setLoading(false)

        // 暂时显示未实现提示
        toast.error("取消记录查询功能暂未实现")
        onOpenChange(false)
        return

        // if (!result.ok) {
        //     toast.error(result.error || "加载取消记录失败")
        //     onOpenChange(false)
        //     return
        // }

        // setCancellation(result.data || null)
    }

    // 取消人信息
    const cancelledByProfile = cancellation?.cancelled_by_profile
    const isTherapist = cancellation?.cancelled_by_role === 'therapist'
    const cancelledByName = isTherapist && cancelledByProfile?.girl_name
        ? cancelledByProfile.girl_name
        : cancelledByProfile?.display_name || "未知用户"
    const cancelledByDisplayText = isTherapist && cancelledByProfile?.girl_number
        ? `#${cancelledByProfile.girl_number} · ${cancelledByName}`
        : cancelledByName

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:w-[520px] sm:max-w-[520px] overflow-y-auto px-6">
                <SheetHeader className="px-0">
                    <SheetTitle className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-destructive" />
                        <span>订单取消详情</span>
                    </SheetTitle>
                    <SheetDescription>
                        {orderNumber && `订单号：${orderNumber}`}
                    </SheetDescription>
                </SheetHeader>

                {loading ? (
                    <div className="flex justify-center py-10">
                        <LoadingSpinner />
                    </div>
                ) : cancellation ? (
                    <div className="mt-6 space-y-6 px-0">
                        {/* 基本信息卡片 */}
                        <div className="p-4 bg-destructive/10 rounded-lg space-y-3 border border-destructive/20">
                            <div className="flex items-center gap-2 text-destructive">
                                <Clock className="h-4 w-4" />
                                <span className="text-sm font-medium">取消时间</span>
                            </div>
                            <div className="text-lg font-semibold">
                                {formatRelativeTime(cancellation.cancelled_at)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {new Date(cancellation.cancelled_at).toLocaleString('zh-CN')}
                            </div>
                        </div>

                        {/* 取消前状态 */}
                        {cancellation.previous_status && (
                            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                                <div className="flex items-center gap-2 text-sm font-medium">
                                    <Shield className="h-4 w-4" />
                                    <span>取消前订单状态</span>
                                </div>
                                <Badge variant="outline" className="text-sm">
                                    {getStatusLabel(cancellation.previous_status)}
                                </Badge>
                            </div>
                        )}

                        {/* 取消人信息 */}
                        <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <User className="h-4 w-4" />
                                <span>取消方信息</span>
                            </div>

                            <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs">
                                    {getRoleLabel(cancellation.cancelled_by_role)}
                                </Badge>
                            </div>

                            {cancelledByProfile && (
                                <div className="flex items-center gap-3 pt-2">
                                    <Avatar className="h-10 w-10">
                                        <AvatarImage src={cancelledByProfile.avatar_url || undefined} />
                                        <AvatarFallback className="text-xs">
                                            {cancelledByName.slice(0, 2)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col gap-0.5">
                                        <div className="text-sm font-medium">{cancelledByDisplayText}</div>
                                        <div className="text-xs text-muted-foreground font-mono">
                                            ID: {cancelledByProfile.user_id.slice(0, 8)}...
                                        </div>
                                    </div>
                                </div>
                            )}

                            {!cancelledByProfile && cancellation.cancelled_by_role === 'system' && (
                                <div className="text-sm text-muted-foreground">
                                    系统自动取消
                                </div>
                            )}
                        </div>

                        {/* 取消原因 */}
                        <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <FileText className="h-4 w-4" />
                                <span>取消原因</span>
                            </div>

                            {cancellation.reason_code && (
                                <div className="space-y-2">
                                    <div className="text-xs text-muted-foreground">取消类型</div>
                                    <div className="flex flex-col gap-2">
                                        <Badge variant="secondary" className="text-sm w-fit">
                                            {getReasonCodeLabel(cancellation.reason_code)}
                                        </Badge>
                                        <div className="text-xs text-muted-foreground font-mono">
                                            代码：{cancellation.reason_code}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {cancellation.reason_note ? (
                                <div className="space-y-1">
                                    <div className="text-xs text-muted-foreground">详细说明</div>
                                    <div className="text-sm whitespace-pre-wrap break-words bg-background rounded-md p-3 border">
                                        {cancellation.reason_note}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-xs text-muted-foreground">无详细说明</div>
                            )}
                        </div>

                        {/* 记录时间 */}
                        <div className="pt-2 border-t text-xs text-muted-foreground">
                            <div>记录创建时间：{formatRelativeTime(cancellation.created_at)}</div>
                            <div className="mt-1">{new Date(cancellation.created_at).toLocaleString('zh-CN')}</div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                        <AlertCircle className="h-12 w-12 mb-4" />
                        <div className="text-sm">未找到取消记录</div>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    )
}
