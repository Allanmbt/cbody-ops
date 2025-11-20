"use client"

import { useEffect, useRef } from "react"

// 声明 Google Maps 全局类型
declare global {
  interface Window {
    google?: any
  }
}

interface GoogleMapsLocationProps {
  lat: number
  lng: number
}

export function GoogleMapsLocation({ lat, lng }: GoogleMapsLocationProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    if (!apiKey) {
      console.error('[Google Maps] API Key 未配置')
      return
    }

    // 检查 Google Maps 是否已加载
    const initMap = () => {
      if (!mapRef.current || !window.google) return

      // 创建地图
      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat, lng },
        zoom: 15,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      })

      // 添加标记
      new window.google.maps.Marker({
        position: { lat, lng },
        map: map,
        title: "技师当前位置",
      })

      mapInstanceRef.current = map
    }

    // 加载 Google Maps 脚本（防止重复加载）
    if (!window.google) {
      // 检查是否已经有脚本在加载中
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
      if (!existingScript) {
        const script = document.createElement('script')
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
        script.async = true
        script.defer = true
        script.onload = initMap
        document.head.appendChild(script)
      } else {
        // 脚本正在加载，等待加载完成
        existingScript.addEventListener('load', initMap)
      }
    } else {
      initMap()
    }

    // 清理
    return () => {
      mapInstanceRef.current = null
    }
  }, [lat, lng])

  // 更新地图中心
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setCenter({ lat, lng })
    }
  }, [lat, lng])

  return (
    <div className="w-full h-[300px] sm:h-[400px] rounded-lg overflow-hidden border">
      <div ref={mapRef} className="w-full h-full" />
    </div>
  )
}
