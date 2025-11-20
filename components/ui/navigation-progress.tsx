'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import NProgress from 'nprogress'

// 配置 NProgress
NProgress.configure({
    showSpinner: false,
    trickleSpeed: 200,
    minimum: 0.08,
    easing: 'ease',
    speed: 500
})

export function NavigationProgress() {
    const pathname = usePathname()
    const searchParams = useSearchParams()

    useEffect(() => {
        // 路由切换完成，停止加载条
        NProgress.done()
    }, [pathname, searchParams])

    return null
}
