"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Clock, User, RefreshCw } from "lucide-react"
import { getChiangMaiGirls, updateGirlStatus } from "./actions"
import type { AlohaGirl } from "@/lib/features/aloha"
import { toast } from "sonner"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"

const BUSY_DURATION_OPTIONS = [
    { label: "30 นาที", value: 30 },
    { label: "60 นาที", value: 60 },
    { label: "90 นาที", value: 90 },
    { label: "2 ชั่วโมง", value: 120 },
    { label: "3 ชั่วโมง", value: 180 },
]

export function AlohaManagementContent() {
    const [girls, setGirls] = useState<AlohaGirl[]>([])
    const [loading, setLoading] = useState(true)
    const [updating, setUpdating] = useState<string | null>(null)

    // 分页
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [total, setTotal] = useState(0)
    const pageSize = 20

    useEffect(() => {
        loadGirls()
    }, [page])

    async function loadGirls() {
        try {
            setLoading(true)
            const result = await getChiangMaiGirls(page, pageSize)

            if (!result.ok) {
                toast.error(result.error || "โหลดข้อมูลไม่สำเร็จ")
                return
            }

            if (result.data) {
                setGirls(result.data.data)
                setTotalPages(result.data.totalPages)
                setTotal(result.data.total)
            }
        } catch (error) {
            console.error('[Aloha] 加载失败:', error)
            toast.error("โหลดข้อมูลไม่สำเร็จ")
        } finally {
            setLoading(false)
        }
    }

    async function handleSetAvailable(girlId: string) {
        try {
            setUpdating(girlId)
            const result = await updateGirlStatus({
                girl_id: girlId,
                minutes: 0 // 设为空闲，minutes 参数会被忽略
            })

            if (!result.ok) {
                toast.error(result.error || "ดำเนินการไม่สำเร็จ")
                return
            }

            toast.success("ตั้งค่าว่างแล้ว")
            await loadGirls()
        } catch (error) {
            console.error('[Aloha] 操作失败:', error)
            toast.error("ดำเนินการไม่สำเร็จ")
        } finally {
            setUpdating(null)
        }
    }

    async function handleSetBusy(girlId: string, minutes: number) {
        try {
            setUpdating(girlId)
            const result = await updateGirlStatus({
                girl_id: girlId,
                minutes
            })

            if (!result.ok) {
                toast.error(result.error || "ดำเนินการไม่สำเร็จ")
                return
            }

            toast.success(`ตั้งค่าไม่ว่างแล้ว ${minutes} นาที`)
            await loadGirls()
        } catch (error) {
            console.error('[Aloha] 操作失败:', error)
            toast.error("ดำเนินการไม่สำเร็จ")
        } finally {
            setUpdating(null)
        }
    }

    function formatNextAvailable(time: string | null): string {
        if (!time) return '-'
        try {
            return format(new Date(time), 'MM-dd HH:mm', { locale: zhCN })
        } catch {
            return '-'
        }
    }

    return (
        <div className="flex flex-col gap-4">
            {/* 标题 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold">จัดการสถานะนักบำบัดเชียงใหม่</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        ทั้งหมด {total} คน
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadGirls()}
                    disabled={loading}
                >
                    <RefreshCw className={`size-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    รีเฟรช
                </Button>
            </div>

            {/* 列表 */}
            {loading ? (
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-24 w-full" />
                    ))}
                </div>
            ) : girls.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <User className="size-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">ไม่มีนักบำบัดออนไลน์</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {girls.map((girl) => (
                        <Card key={girl.id} className="overflow-hidden">
                            <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                    {/* 头像 */}
                                    <Avatar className="size-14 flex-shrink-0">
                                        <AvatarImage src={girl.avatar_url || undefined} />
                                        <AvatarFallback>{girl.name?.[0] || '?'}</AvatarFallback>
                                    </Avatar>

                                    {/* 信息 */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <span className="font-medium break-words">{girl.name}</span>
                                            <Badge variant="outline" className="flex-shrink-0">
                                                #{girl.girl_number}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm flex-wrap">
                                            {girl.status === 'available' ? (
                                                <Badge className="bg-green-600 hover:bg-green-700 flex-shrink-0">
                                                    ว่าง
                                                </Badge>
                                            ) : (
                                                <Badge variant="destructive" className="gap-1 flex-shrink-0">
                                                    <Clock className="size-3" />
                                                    ไม่ว่าง
                                                </Badge>
                                            )}
                                            {girl.status === 'busy' && girl.next_available_time && (
                                                <span className="text-xs text-muted-foreground break-words">
                                                    ถึง {formatNextAvailable(girl.next_available_time)}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* 操作按钮 */}
                                    <div className="flex-shrink-0">
                                        {girl.status === 'busy' ? (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:hover:bg-green-900 dark:text-green-300 dark:border-green-800 whitespace-nowrap"
                                                onClick={() => handleSetAvailable(girl.id)}
                                                disabled={updating === girl.id}
                                            >
                                                {updating === girl.id ? 'กำลังดำเนินการ...' : 'ตั้งค่าว่าง'}
                                            </Button>
                                        ) : (
                                            <Select
                                                disabled={updating === girl.id}
                                                onValueChange={(value) => handleSetBusy(girl.id, parseInt(value))}
                                            >
                                                <SelectTrigger className="w-[110px] h-9">
                                                    <SelectValue placeholder="ตั้งค่าไม่ว่าง" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {BUSY_DURATION_OPTIONS.map((option) => (
                                                        <SelectItem key={option.value} value={option.value.toString()}>
                                                            {option.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* 分页 */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                    <p className="text-sm text-muted-foreground">
                        หน้า {page} จาก {totalPages}
                    </p>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1 || loading}
                        >
                            ก่อนหน้า
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages || loading}
                        >
                            ถัดไป
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
