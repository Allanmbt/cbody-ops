"use client"

/**
 * 订单结算详情页面
 */

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { ArrowLeft, Receipt, User, Calendar, DollarSign, CheckCircle, Clock, Edit, CreditCard, FileText } from "lucide-react"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"
import { getOrderSettlementDetail, updateOrderSettlementPayment, markSettlementAsSettled } from "@/lib/features/finance/actions"
import type { OrderSettlementWithDetails } from "@/lib/features/finance"

interface SettlementDetailContentProps {
    settlementId: string
}

export function SettlementDetailContent({ settlementId }: SettlementDetailContentProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [settlement, setSettlement] = useState<OrderSettlementWithDetails | null>(null)
    const [editPaymentOpen, setEditPaymentOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const [settling, setSettling] = useState(false)

    // 支付信息表单状态
    const [paymentContentType, setPaymentContentType] = useState<string>('')
    const [paymentMethod, setPaymentMethod] = useState<string>('')
    const [paymentNotes, setPaymentNotes] = useState('')

    useEffect(() => {
        loadSettlementDetail()
    }, [settlementId])

    async function loadSettlementDetail() {
        try {
            setLoading(true)
            const result = await getOrderSettlementDetail(settlementId)

            if (!result.ok) {
                toast.error(result.error || "加载结算详情失败")
                return
            }

            setSettlement(result.data!)
            // 初始化表单数据
            setPaymentContentType(result.data!.payment_content_type || 'null')
            setPaymentMethod(result.data!.payment_method || 'null')
            setPaymentNotes(result.data!.payment_notes || '')
        } catch (error) {
            console.error('[SettlementDetail] 加载失败:', error)
            toast.error("加载结算详情失败")
        } finally {
            setLoading(false)
        }
    }

    async function handleUpdatePayment() {
        if (!settlement) return

        try {
            setSaving(true)
            const result = await updateOrderSettlementPayment({
                settlement_id: settlementId,
                payment_content_type: paymentContentType === 'null' ? null : paymentContentType as any,
                payment_method: paymentMethod === 'null' ? null : paymentMethod as any,
                payment_notes: paymentNotes || null,
            })

            if (!result.ok) {
                toast.error(result.error || "更新支付信息失败")
                return
            }

            toast.success("支付信息已更新")
            setEditPaymentOpen(false)
            loadSettlementDetail()
        } catch (error) {
            console.error('[UpdatePayment] 失败:', error)
            toast.error("更新支付信息失败")
        } finally {
            setSaving(false)
        }
    }

    async function handleMarkAsSettled() {
        if (!settlement) return

        try {
            setSettling(true)
            const result = await markSettlementAsSettled({
                settlement_id: settlementId,
            })

            if (!result.ok) {
                toast.error(result.error || "标记已结算失败")
                return
            }

            toast.success("已标记为已结算，技师账户余额已更新")
            loadSettlementDetail()
        } catch (error) {
            console.error('[MarkSettled] 失败:', error)
            toast.error("标记已结算失败")
        } finally {
            setSettling(false)
        }
    }

    function getPaymentContentTypeLabel(type: string | null) {
        if (!type) return '技师自己收款'
        const labels: Record<string, string> = {
            deposit: '定金',
            full_amount: '全款',
            tip: '小费',
            other: '其他',
        }
        return labels[type] || type
    }

    function getPaymentMethodLabel(method: string | null) {
        if (!method) return '未指定'
        const labels: Record<string, string> = {
            wechat: '微信',
            alipay: '支付宝',
            thb_bank_transfer: '泰铢转账',
            credit_card: '信用卡',
            cash: '现金',
            other: '其他',
        }
        return labels[method] || method
    }

    return (
        <div className="flex flex-col gap-6">
            {/* 返回按钮 */}
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.back()}
                >
                    <ArrowLeft className="mr-2 size-4" />
                    返回
                </Button>
                <div>
                    <h1 className="text-3xl font-bold">订单结算详情</h1>
                    <p className="text-muted-foreground mt-1">
                        查看订单结算明细信息
                    </p>
                </div>
            </div>

            {/* 内容 */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <p className="text-muted-foreground">加载中...</p>
                </div>
            ) : !settlement ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="text-muted-foreground">未找到结算记录</p>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* 订单和技师信息 */}
                    <div className="grid gap-6 md:grid-cols-2">
                        {/* 订单信息 */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <Receipt className="size-5 text-muted-foreground" />
                                    <CardTitle>订单信息</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div>
                                    <p className="text-sm text-muted-foreground">订单号</p>
                                    <p className="font-medium">{settlement.orders?.order_number || '-'}</p>
                                </div>
                                <Separator />
                                <div>
                                    <p className="text-sm text-muted-foreground">服务内容</p>
                                    <p className="font-medium">
                                        {settlement.orders?.service_name
                                            ? (typeof settlement.orders.service_name === 'string'
                                                ? settlement.orders.service_name
                                                : (settlement.orders.service_name as any)?.zh || (settlement.orders.service_name as any)?.en || '-')
                                            : '-'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">服务时长</p>
                                    <p className="font-medium">{settlement.orders?.service_duration ? `${settlement.orders.service_duration}分钟` : '-'}</p>
                                </div>
                                <Separator />
                                <div>
                                    <p className="text-sm text-muted-foreground">订单总额</p>
                                    <p className="text-lg font-bold">{formatCurrency(settlement.orders?.total_amount || 0)}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">完成时间</p>
                                    <p className="text-sm">{settlement.orders?.completed_at ? format(new Date(settlement.orders.completed_at), 'PPpp', { locale: zhCN }) : '-'}</p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 技师信息 */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <User className="size-5 text-muted-foreground" />
                                    <CardTitle>技师信息</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <Avatar className="size-16">
                                        <AvatarImage src={(settlement.girls as any)?.avatar_url || ''} alt={settlement.girls?.name || '技师'} />
                                        <AvatarFallback>{settlement.girls?.name?.charAt(0) || '?'}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-medium text-lg">{settlement.girls?.name || '未知技师'}</p>
                                        <p className="text-sm text-muted-foreground">工号 #{settlement.girls?.girl_number || '-'}</p>
                                    </div>
                                </div>
                                <Separator />
                                <div>
                                    <p className="text-sm text-muted-foreground">所属城市</p>
                                    <p className="font-medium">
                                        {(settlement.girls as any)?.cities?.name
                                            ? (typeof (settlement.girls as any).cities.name === 'string'
                                                ? (settlement.girls as any).cities.name
                                                : (settlement.girls as any).cities.name?.zh || (settlement.girls as any).cities.name?.en || '-')
                                            : '-'}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* 结算明细 */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <DollarSign className="size-5 text-muted-foreground" />
                                <CardTitle>结算明细</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <p className="text-sm text-muted-foreground">服务费</p>
                                    <p className="font-medium">{formatCurrency(settlement.service_fee)}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">额外费用</p>
                                    <p className="font-medium">{formatCurrency(settlement.extra_fee)}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">服务佣金率</p>
                                    <p className="font-medium">{settlement.service_commission_rate}%</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">额外费用佣金率</p>
                                    <p className="font-medium">{settlement.extra_commission_rate}%</p>
                                </div>
                            </div>
                            <Separator />
                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <p className="text-sm text-muted-foreground">平台应得金额</p>
                                    <p className="font-medium">{formatCurrency(settlement.platform_should_get)}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">顾客已付平台</p>
                                    <p className="font-medium">{formatCurrency(settlement.customer_paid_to_platform)}</p>
                                </div>
                            </div>
                            <Separator />
                            <div className="bg-muted/50 p-4 rounded-lg">
                                <p className="text-sm text-muted-foreground mb-2">最终结算金额</p>
                                <p className={`text-2xl font-bold ${Number(settlement.settlement_amount) < 0
                                    ? 'text-red-600 dark:text-red-400'
                                    : Number(settlement.settlement_amount) > 0
                                        ? 'text-green-600 dark:text-green-400'
                                        : 'text-muted-foreground'
                                    }`}>
                                    {formatCurrency(settlement.settlement_amount)}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {Number(settlement.settlement_amount) < 0 && '技师欠平台'}
                                    {Number(settlement.settlement_amount) > 0 && '平台欠技师'}
                                    {Number(settlement.settlement_amount) === 0 && '已平衡'}
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 支付信息 */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                            <div className="flex items-center gap-2">
                                <CreditCard className="size-5 text-muted-foreground" />
                                <CardTitle>支付信息</CardTitle>
                            </div>
                            <Dialog open={editPaymentOpen} onOpenChange={setEditPaymentOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-8 gap-1">
                                        <Edit className="size-3" />
                                        编辑
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>编辑支付信息</DialogTitle>
                                        <DialogDescription>
                                            修改订单的支付内容和方式
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label>支付内容类型</Label>
                                            <Select value={paymentContentType} onValueChange={setPaymentContentType}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="选择支付内容" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="null">技师自己收款</SelectItem>
                                                    <SelectItem value="deposit">定金</SelectItem>
                                                    <SelectItem value="full_amount">全款</SelectItem>
                                                    <SelectItem value="tip">小费</SelectItem>
                                                    <SelectItem value="other">其他</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>支付方式</Label>
                                            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="选择支付方式" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="null">未指定</SelectItem>
                                                    <SelectItem value="wechat">微信</SelectItem>
                                                    <SelectItem value="alipay">支付宝</SelectItem>
                                                    <SelectItem value="thb_bank_transfer">泰铢转账</SelectItem>
                                                    <SelectItem value="credit_card">信用卡</SelectItem>
                                                    <SelectItem value="cash">现金</SelectItem>
                                                    <SelectItem value="other">其他</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>支付备注</Label>
                                            <Textarea
                                                value={paymentNotes}
                                                onChange={(e) => setPaymentNotes(e.target.value)}
                                                placeholder="输入支付备注信息（可选）"
                                                rows={3}
                                            />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setEditPaymentOpen(false)}>
                                            取消
                                        </Button>
                                        <Button onClick={handleUpdatePayment} disabled={saving}>
                                            {saving ? '保存中...' : '保存'}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div>
                                <p className="text-sm text-muted-foreground">支付内容类型</p>
                                <p className="font-medium">{getPaymentContentTypeLabel(settlement.payment_content_type)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">支付方式</p>
                                <p className="font-medium">{getPaymentMethodLabel(settlement.payment_method)}</p>
                            </div>
                            {settlement.payment_notes && (
                                <div>
                                    <p className="text-sm text-muted-foreground">支付备注</p>
                                    <p className="text-sm">{settlement.payment_notes}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* 结算状态和操作 */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <FileText className="size-5 text-muted-foreground" />
                                <CardTitle>结算状态</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-3">
                                {settlement.settlement_status === 'settled' ? (
                                    <>
                                        <CheckCircle className="size-5 text-green-600" />
                                        <div>
                                            <p className="font-medium text-green-600">已结算</p>
                                            {settlement.settled_at && (
                                                <p className="text-sm text-muted-foreground">
                                                    结算时间：{format(new Date(settlement.settled_at), 'PPpp', { locale: zhCN })}
                                                </p>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <Clock className="size-5 text-orange-600" />
                                        <div>
                                            <p className="font-medium text-orange-600">待结算</p>
                                            <p className="text-sm text-muted-foreground">
                                                创建时间：{format(new Date(settlement.created_at), 'PPpp', { locale: zhCN })}
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* 操作按钮 */}
                            {settlement.settlement_status === 'pending' && (
                                <div className="pt-4">
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button className="w-full" disabled={settling}>
                                                <CheckCircle className="mr-2 size-4" />
                                                标记为已结算
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>确认标记为已结算？</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    此操作将：<br />
                                                    1. 将订单结算状态更新为"已结算"<br />
                                                    2. 更新技师账户余额（{Number(settlement.settlement_amount) >= 0 ? '+' : ''}{formatCurrency(settlement.settlement_amount)}）<br />
                                                    <br />
                                                    此操作无法撤销，请确认数据无误。
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>取消</AlertDialogCancel>
                                                <AlertDialogAction onClick={handleMarkAsSettled} disabled={settling}>
                                                    {settling ? '处理中...' : '确认'}
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    )
}
