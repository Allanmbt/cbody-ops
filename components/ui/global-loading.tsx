"use client"

import { useEffect, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"

/**
 * 全局加载指示器
 * 在路由切换时显示顶部加载条
 */
export function GlobalLoading() {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        setLoading(true)
        const timeout = setTimeout(() => setLoading(false), 100)
        return () => clearTimeout(timeout)
    }, [pathname, searchParams])

    if (!loading) return null

    return (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500">
            <div className="h-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 animate-pulse"
                style={{
                    animation: 'loading-bar 1s ease-in-out infinite',
                    width: '100%'
                }}
            />
            <style jsx>{`
        @keyframes loading-bar {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
        </div>
    )
}
