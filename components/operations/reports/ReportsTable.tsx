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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LoadingSpinner } from "@/components/ui/loading"
import { Eye, CheckCircle2, Copy, Check } from "lucide-react"
import { formatRelativeTime } from "@/lib/features/orders"
import type { ReportListItem } from "@/app/dashboard/operations/reports/actions"
import { ReportDrawer } from "./ReportDrawer"
import { toast } from "sonner"

interface ReportsTableProps {
    reports: ReportListItem[]
    loading?: boolean
    onRefresh: () => void
}

function getRoleBadge(role: string) {
    if (role === "girl") {
        return <Badge variant="outline" className="text-xs">技师</Badge>
    }
    if (role === "customer") {
        return <Badge variant="outline" className="text-xs">客户</Badge>
    }
    return <Badge variant="outline" className="text-xs">{role}</Badge>
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

export function ReportsTable({ reports, loading = false, onRefresh }: ReportsTableProps) {
    const [selectedReport, setSelectedReport] = useState<ReportListItem | null>(null)
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [copiedId, setCopiedId] = useState<string | null>(null)

    const handleCopyOrder = async (orderNumber: string | undefined) => {
        if (!orderNumber) return
        try {
            await navigator.clipboard.writeText(orderNumber)
            setCopiedId(orderNumber)
            setTimeout(() => setCopiedId(null), 1500)
            toast.success("已复制订单号")
        } catch (error) {
            toast.error("复制失败，请稍后重试")
        }
    }

    const handleView = (report: ReportListItem) => {
        setSelectedReport(report)
        setDrawerOpen(true)
    }

    return (
        <>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>举报人</TableHead>
                            <TableHead>被举报人</TableHead>
                            <TableHead>类型</TableHead>
                            <TableHead>描述</TableHead>
                            <TableHead className="text-center">截图</TableHead>
                            <TableHead>关联订单</TableHead>
                            <TableHead>提交时间</TableHead>
                            <TableHead className="text-center">状态</TableHead>
                            <TableHead className="w-[120px] text-center">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={9} className="h-24 text-center">
                                    <LoadingSpinner />
                                </TableCell>
                            </TableRow>
                        ) : reports.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="h-24 text-center">
                                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                        <div className="text-sm">暂无举报记录</div>
                                        <div className="text-xs">当前没有需要处理的举报</div>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            reports.map((report) => {
                                const screenshotCount = report.screenshot_urls?.length || 0

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
                                    <TableRow key={report.id}>
                                        {/* 举报人 */}
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={reporterProfile?.avatar_url || undefined} />
                                                    <AvatarFallback className="text-xs">
                                                        {reporterName.slice(0, 2)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col gap-0.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-medium truncate max-w-[140px]">
                                                            {reporterDisplayText}
                                                        </span>
                                                        {getRoleBadge(report.reporter_role)}
                                                    </div>
                                                    {!reporterIsGirl && reporterProfile && (
                                                        <button
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(reporterProfile.user_id)
                                                                toast.success("已复制用户ID")
                                                            }}
                                                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                                        >
                                                            <Copy className="h-3 w-3" />
                                                            <span className="font-mono">{reporterProfile.user_id.slice(0, 8)}...</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>

                                        {/* 被举报人 */}
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={targetProfile?.avatar_url || undefined} />
                                                    <AvatarFallback className="text-xs">
                                                        {targetName.slice(0, 2)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-sm font-medium truncate max-w-[120px]">
                                                        {targetDisplayText}
                                                    </span>
                                                    {!targetIsGirl && targetProfile && (
                                                        <button
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(targetProfile.user_id)
                                                                toast.success("已复制用户ID")
                                                            }}
                                                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                                        >
                                                            <Copy className="h-3 w-3" />
                                                            <span className="font-mono">{targetProfile.user_id.slice(0, 8)}...</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>

                                        {/* 类型 */}
                                        <TableCell>
                                            <Badge variant="outline" className="text-xs">
                                                {getReportTypeLabel(report.report_type)}
                                            </Badge>
                                        </TableCell>

                                        {/* 描述 */}
                                        <TableCell>
                                            {report.description ? (
                                                <span className="text-sm text-muted-foreground line-clamp-2 max-w-[220px]">
                                                    {report.description}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">无描述</span>
                                            )}
                                        </TableCell>

                                        {/* 截图 */}
                                        <TableCell className="text-center">
                                            {screenshotCount > 0 ? (
                                                <span className="text-sm">{screenshotCount} 张</span>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">无</span>
                                            )}
                                        </TableCell>

                                        {/* 关联订单 */}
                                        <TableCell>
                                            {report.order ? (
                                                <div className="flex items-center gap-1">
                                                    <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                                                        {report.order.order_number}
                                                    </span>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={() => handleCopyOrder(report.order?.order_number)}
                                                    >
                                                        {copiedId === report.order.order_number ? (
                                                            <Check className="h-3 w-3 text-emerald-500" />
                                                        ) : (
                                                            <Copy className="h-3 w-3 text-muted-foreground" />
                                                        )}
                                                    </Button>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">无</span>
                                            )}
                                        </TableCell>

                                        {/* 提交时间 */}
                                        <TableCell>
                                            <span className="text-sm text-muted-foreground">
                                                {formatRelativeTime(report.created_at)}
                                            </span>
                                        </TableCell>

                                        {/* 状态 */}
                                        <TableCell className="text-center">
                                            <Badge
                                                variant={report.status === "pending" ? "destructive" : "outline"}
                                                className="text-xs"
                                            >
                                                {report.status === "pending" ? "待处理" : "已处理"}
                                            </Badge>
                                        </TableCell>

                                        {/* 操作 */}
                                        <TableCell className="text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => handleView(report)}
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                {report.status === "pending" && (
                                                    <Badge
                                                        variant="outline"
                                                        className="inline-flex items-center gap-1 cursor-pointer"
                                                        onClick={() => handleView(report)}
                                                    >
                                                        <CheckCircle2 className="h-3 w-3" />
                                                        标记
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            <ReportDrawer
                open={drawerOpen}
                onOpenChange={setDrawerOpen}
                report={selectedReport}
                onResolved={() => {
                    setDrawerOpen(false)
                    onRefresh()
                }}
            />
        </>
    )
}
