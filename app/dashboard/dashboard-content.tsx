"use client"

import { Card, CardContent } from "@/components/ui/card"

export function DashboardContent() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-2xl w-full">
        <CardContent className="flex flex-col items-center justify-center py-16 px-8 text-center space-y-6">
          <div className="space-y-3">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              欢迎来到 CBODY 管理后台
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground">
              ยินดีต้อนรับสู่ระบบจัดการ CBODY
            </p>
          </div>

          <div className="pt-6 text-sm text-muted-foreground max-w-md">
            <p className="mb-2">请从左侧菜单选择功能模块开始管理</p>
            <p>กรุณาเลือกเมนูด้านซ้ายเพื่อเริ่มการจัดการ</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}