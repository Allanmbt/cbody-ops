"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LoadingSpinner } from "@/components/ui/loading"
import { toast } from "sonner"
import { Clock, RefreshCw } from "lucide-react"
import { getBangkokGirls, updateGirlStatus } from "./actions"
import type { CbodyGirl } from "@/lib/features/cbody"

const BUSY_DURATION_OPTIONS = [
    { label: "30 นาที", value: 30 },
    { label: "60 นาที", value: 60 },
    { label: "90 นาที", value: 90 },
    { label: "2 ชั่วโมง", value: 120 },
    { label: "3 ชั่วโมง", value: 180 },
]

export function CbodyManagementContent() {
    const [girls, setGirls] = useState<CbodyGirl[]>([])
    const [loading, setLoading] = useState(true)
    const [updating, setUpdating] = useState<string | null>(null)
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)
    const [totalPages, setTotalPages] = useState(0)

    const loadGirls = async (currentPage: number = 1) => {
        setLoading(true)
        try {
            const result = await getBangkokGirls(currentPage, 20)
            if (!result.ok) {
                toast.error(result.error || "โหลดข้อมูลล้มเหลว")
                return
            }
            setGirls(result.data.data)
            setTotal(result.data.total)
            setPage(result.data.page)
            setTotalPages(result.data.totalPages)
        } catch (error) {
            console.error('[CBODY] โหลดข้อมูลล้มเหลว:', error)
            toast.error("โหลดข้อมูลล้มเหลว กรุณาลองใหม่อีกครั้ง")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadGirls(1)
    }, [])

    const handleStatusChange = async (girl: CbodyGirl, minutes?: number) => {
        setUpdating(girl.id)
        try {
            const result = await updateGirlStatus({
                girl_id: girl.id,
                minutes: minutes || 0
            })

            if (!result.ok) {
                toast.error(result.error || "อัปเดตสถานะล้มเหลว")
                return
            }

            toast.success("อัปเดตสถานะสำเร็จ")
            await loadGirls(page)
        } catch (error) {
            console.error('[CBODY] อัปเดตสถานะล้มเหลว:', error)
            toast.error("อัปเดตสถานะล้มเหลว กรุณาลองใหม่อีกครั้ง")
        } finally {
            setUpdating(null)
        }
    }

    const formatNextAvailable = (time: string | null) => {
        if (!time) return ""
        const date = new Date(time)
        const now = new Date()
        const diffMs = date.getTime() - now.getTime()
        const diffMins = Math.floor(diffMs / 60000)

        if (diffMins < 0) return "พร้อมแล้ว"
        if (diffMins < 60) return `${diffMins} นาที`
        const hours = Math.floor(diffMins / 60)
        const mins = diffMins % 60
        return mins > 0 ? `${hours} ชม. ${mins} นาที` : `${hours} ชม.`
    }

    return (
        <div className="flex flex-col gap-6 p-4 md:px-8 md:py-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">จัดการ CBODY (กรุงเทพ)</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        จัดการสถานะพนักงานนวด กรุงเทพ
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadGirls(page)}
                    disabled={loading}
                    className="gap-2"
                >
                    <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
                    รีเฟรช
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">
                        รายการพนักงาน ({total} คน)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <LoadingSpinner />
                        </div>
                    ) : girls.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <p>ไม่พบข้อมูลพนักงาน</p>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-3">
                                {girls.map((girl) => (
                                    <div
                                        key={girl.id}
                                        className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                                    >
                                        <Avatar className="size-12 flex-shrink-0">
                                            <AvatarImage src={girl.avatar_url || undefined} />
                                            <AvatarFallback>{girl.girl_number}</AvatarFallback>
                                        </Avatar>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <span className="font-medium break-words">{girl.name}</span>
                                                <Badge variant="outline" className="text-xs flex-shrink-0">
                                                    #{girl.girl_number}
                                                </Badge>
                                            </div>

                                            <div className="flex items-center gap-2 text-sm flex-wrap">
                                                {girl.status === 'available' ? (
                                                    <Badge className="bg-green-600 hover:bg-green-700 flex-shrink-0">
                                                        ว่าง
                                                    </Badge>
                                                ) : (
                                                    <>
                                                        <Badge variant="destructive" className="gap-1 flex-shrink-0">
                                                            <Clock className="size-3" />
                                                            ไม่ว่าง
                                                        </Badge>
                                                        {girl.next_available_time && (
                                                            <span className="text-xs text-muted-foreground break-words">
                                                                ถึง {formatNextAvailable(girl.next_available_time)}
                                                            </span>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex-shrink-0">
                                            {girl.status === 'busy' ? (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleStatusChange(girl)}
                                                    disabled={updating === girl.id}
                                                    className="whitespace-nowrap"
                                                >
                                                    {updating === girl.id ? "กำลังอัปเดต..." : "ตั้งว่าง"}
                                                </Button>
                                            ) : (
                                                <Select
                                                    disabled={updating === girl.id}
                                                    onValueChange={(value) => handleStatusChange(girl, parseInt(value))}
                                                >
                                                    <SelectTrigger className="w-[110px] h-9">
                                                        <SelectValue placeholder="ตั้งไม่ว่าง" />
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
                                ))}
                            </div>

                            {totalPages > 1 && (
                                <div className="flex items-center justify-between mt-6 pt-4 border-t">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => loadGirls(page - 1)}
                                        disabled={page === 1 || loading}
                                    >
                                        ก่อนหน้า
                                    </Button>
                                    <span className="text-sm text-muted-foreground">
                                        หน้า {page} จาก {totalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => loadGirls(page + 1)}
                                        disabled={page >= totalPages || loading}
                                    >
                                        ถัดไป
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
