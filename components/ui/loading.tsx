"use client"

import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg"
  className?: string
}

export function LoadingSpinner({
  size = "md",
  className
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "size-4",
    md: "size-6",
    lg: "size-8"
  }

  return (
    <Loader2 className={cn(sizeClasses[size], "animate-spin text-primary", className)} />
  )
}

// 页面级别的加载组件
export function PageLoading({ text }: { text?: string } = {}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
      <LoadingSpinner size="lg" />
      {text && (
        <p className="text-sm text-muted-foreground">{text}</p>
      )}
    </div>
  )
}

// 内容区域加载组件
export function ContentLoading() {
  return (
    <div className="flex items-center justify-center py-12">
      <LoadingSpinner size="md" />
    </div>
  )
}

// 按钮内加载组件
export function ButtonLoading() {
  return <LoadingSpinner size="sm" />
}