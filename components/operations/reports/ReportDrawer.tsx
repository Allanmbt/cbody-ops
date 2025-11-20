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
import { Textarea } from "@/components/ui/textarea"
import { LoadingSpinner } from "@/components/ui/loading"
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatRelativeTime } from "@/lib/features/orders"
import { resolveReport, type ReportListItem } from "@/app/dashboard/operations/reports/actions"
import { toast } from "sonner"

interface ReportDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    report: ReportListItem | null
    onResolved: () => void
}

function getRoleLabel(role: string) {
    if (role === "girl") return "技师"
    if (role === "customer") return "客户"
    return role
}

function getReportTypeLabel(type: string) {
    const map: Record<string, string> = {
        harassment: "骚扰 / 不当言论",
        spam: "垃圾消息 / 恶意骚扰",
        fake_booking: "恶意下单 / 爽约",
        inappropriate_behavior: "不当行为（服务过程中的不尊重）",
        dangerous_behavior: "危险行为（毒品 / 暴力 / 醉酒）",
        privacy_violation: "隐私与安全隐患（偷拍 / 录音 / 摄像头）",
        payment_issue: "付款问题 / 欺诈行为",
        c_late_arrival: "无法联系 / 严重迟到",
        c_unprofessional_attitude: "服务态度恶劣",
        c_not_as_described: "与描述不符（形象/技能差距大）",
        c_incomplete_service: "服务不足（偷钟/提前结束）",
        c_poor_condition: "状态不佳",
        c_inappropriate_behavior: "不当行为（醉酒/盗窃/越界）",
        c_missing_uniform: "未按要求着装",
        c_suspected_theft: "可疑偷盗行为",
        c_dangerous_behavior: "危险行为",
        other: "其他",
    }
    return map[type] || type
}

export function ReportDrawer({ open, onOpenChange, report, onResolved }: ReportDrawerProps) {
    const [adminNotes, setAdminNotes] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [previewImage, setPreviewImage] = useState<string | null>(null)

    // 当 report 改变时，同步已有的 admin_notes
    useEffect(() => {
        if (report) {
            setAdminNotes(report.admin_notes || "")
        }
    }, [report])

    const handleResolve = async () => {
        if (!report) return

        // 验证是否填写了回馈说明
        if (report.status === "pending" && !adminNotes.trim()) {
            toast.error("请填写处理说明")
            return
        }

        setIsSubmitting(true)
        const result = await resolveReport(report.id, adminNotes.trim() || undefined)
        setIsSubmitting(false)

        if (!result.ok) {
            toast.error(result.error || "标记已处理失败")
            return
        }

        toast.success("已标记为已处理")
        onResolved()
    }

    if (!report) return null

    // 举报人信息
    const reporterProfile = report.reporter_profile
    const reporterIsGirl = report.reporter_role === "girl"
    const reporterName = reporterIsGirl && reporterProfile?.girl_name
        ? reporterProfile.girl_name
        : reporterProfile?.display_name || "未命名用户"
    const reporterDisplayText = reporterIsGirl && reporterProfile?.girl_number
        ? `#${reporterProfile.girl_number} · ${reporterName}`
        : reporterName

    // 被举报人信息
    const targetProfile = report.target_profile
    // 修复逻辑：技师举报时，被举报人必然是客户（不显示工号）
    const targetIsGirl = reporterIsGirl ? false : !!targetProfile?.girl_number
    const targetName = targetIsGirl && targetProfile?.girl_name
        ? targetProfile.girl_name
        : targetProfile?.display_name || "未命名用户"
    const targetDisplayText = targetIsGirl && targetProfile?.girl_number
        ? `#${targetProfile.girl_number} · ${targetName}`
        : targetName

    return (
        <>
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:w-[520px] sm:max-w-[520px] overflow-y-auto px-6">
                <SheetHeader className="px-0">
                    <SheetTitle className="flex items-center justify-between gap-2">
                        <span>举报详情</span>
                        <Badge variant={report.status === "pending" ? "destructive" : "outline"}>
                            {report.status === "pending" ? "待处理" : "已处理"}
                        </Badge>
                    </SheetTitle>
                    <SheetDescription>
                        查看举报内容、截图和关联信息
                    </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-6 px-0">
                    {/* 基本信息 */}
                    <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                        <div className="flex items-start gap-3">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={reporterProfile?.avatar_url || undefined} />
                                <AvatarFallback className="text-xs">
                                    {reporterName.slice(0, 2)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium truncate">{reporterDisplayText}</span>
                                    <Badge variant="outline" className="text-xs">
                                        举报人 · {getRoleLabel(report.reporter_role)}
                                    </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    举报时间：{formatRelativeTime(report.created_at)}
                                </div>
                                {!reporterIsGirl && reporterProfile && (
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(reporterProfile.user_id)
                                            toast.success("已复制用户ID")
                                        }}
                                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
                                    >
                                        <span>用户ID：</span>
                                        <span className="font-mono">{reporterProfile.user_id}</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1">
                                    <span className="text-xs">被举报人：</span>
                                    <span className="font-medium text-foreground">{targetDisplayText}</span>
                                </div>
                                {!targetIsGirl && targetProfile && (
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(targetProfile.user_id)
                                            toast.success("已复制用户ID")
                                        }}
                                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        <span>用户ID：</span>
                                        <span className="font-mono">{targetProfile.user_id}</span>
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="text-xs">举报类型：</span>
                                <Badge variant="outline" className="text-xs">
                                    {getReportTypeLabel(report.report_type)}
                                </Badge>
                            </div>
                        </div>

                        {report.order && (
                            <div className="text-xs text-muted-foreground">
                                关联订单：<span className="font-mono text-foreground">{report.order.order_number}</span>
                            </div>
                        )}
                    </div>

                    {/* 描述 */}
                    {report.description && (
                        <div className="space-y-2">
                            <div className="text-sm font-medium">举报描述</div>
                            <div className="text-sm whitespace-pre-wrap break-words bg-muted/40 rounded-lg p-3">
                                {report.description}
                            </div>
                        </div>
                    )}

                    {/* 截图 */}
                    {report.screenshot_urls && report.screenshot_urls.length > 0 && (
                        <div className="space-y-2">
                            <div className="text-sm font-medium">截图证据（点击查看大图）</div>
                            <ScrollArea className="max-h-[260px] rounded-md border bg-muted/30 p-3">
                                <div className="grid grid-cols-2 gap-3">
                                    {report.screenshot_urls.map((url, index) => (
                                        <div key={index} className="space-y-1">
                                            <img
                                                src={url}
                                                alt={`举报截图 ${index + 1}`}
                                                className="w-full rounded-md border object-cover max-h-[160px] cursor-pointer hover:opacity-80 transition-opacity"
                                                onClick={() => setPreviewImage(url)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    )}

                    {/* 管理员处理说明 */}
                    <div className="space-y-2">
                        <div className="text-sm font-medium">
                            管理员处理说明 <span className="text-destructive">*</span>
                        </div>
                        {report.status === "pending" ? (
                            <div className="space-y-2">
                                <Textarea
                                    placeholder="请填写处理结果和回馈说明（必填）&#10;&#10;例如：&#10;- 已核实举报内容，对被举报人进行警告处理&#10;- 双方均有不当行为，各打五十大板&#10;- 经调查举报不实，不予处理"
                                    value={adminNotes}
                                    onChange={(e) => setAdminNotes(e.target.value)}
                                    className="min-h-[120px] resize-none"
                                />
                                <div className="text-xs text-muted-foreground">
                                    此说明将作为处理结果反馈给举报人和被举报人
                                </div>
                            </div>
                        ) : report.admin_notes ? (
                            <div className="text-sm whitespace-pre-wrap break-words bg-muted/30 rounded-lg p-3">
                                {report.admin_notes}
                            </div>
                        ) : (
                            <div className="text-xs text-muted-foreground">无处理说明</div>
                        )}
                    </div>

                    {/* 操作区 */}
                    <div className="flex items-center justify-between pt-2 border-t">
                        <div className="text-xs text-muted-foreground">
                            {report.reviewed_at && (
                                <span>处理时间：{formatRelativeTime(report.reviewed_at)}</span>
                            )}
                        </div>
                        {report.status === "pending" && (
                            <Button
                                size="sm"
                                onClick={handleResolve}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? "提交中..." : "标记为已处理"}
                            </Button>
                        )}
                    </div>
                </div>
            </SheetContent>
        </Sheet>

        {/* 图片预览遮罩层 */}
        {previewImage && (
            <div
                className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4"
                onClick={(e) => {
                    e.stopPropagation()
                    setPreviewImage(null)
                }}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="relative max-w-[90vw] max-h-[90vh]">
                    <img
                        src={previewImage}
                        alt="预览图片"
                        className="max-w-full max-h-[90vh] object-contain rounded-lg"
                        onClick={(e) => e.stopPropagation()}
                    />
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            setPreviewImage(null)
                        }}
                        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors"
                    >
                        ✕
                    </button>
                </div>
            </div>
        )}
    </>
    )
}
