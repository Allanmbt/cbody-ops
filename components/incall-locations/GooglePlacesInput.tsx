"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { MapPin, Loader2 } from "lucide-react"

export interface PlaceResult {
  name: string
  address: string
  lat: number
  lng: number
  place_id: string | null
}

interface GooglePlacesInputProps {
  onSelect: (place: PlaceResult) => void
  disabled?: boolean
  placeholder?: string
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    google?: any
    _gplacesLoaded?: boolean
  }
}

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (window._gplacesLoaded) return Promise.resolve()
  return new Promise((resolve, reject) => {
    if (document.getElementById("gplaces-script")) {
      const check = setInterval(() => {
        if (window.google?.maps?.places) {
          window._gplacesLoaded = true
          clearInterval(check)
          resolve()
        }
      }, 100)
      return
    }
    const script = document.createElement("script")
    script.id = "gplaces-script"
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=zh-CN`
    script.async = true
    script.onload = () => { window._gplacesLoaded = true; resolve() }
    script.onerror = reject
    document.head.appendChild(script)
  })
}

export function GooglePlacesInput({
  onSelect,
  disabled,
  placeholder = "搜索地点名称或地址...",
}: GooglePlacesInputProps) {
  const [ready, setReady] = useState(false)
  const [query, setQuery] = useState("")
  const [predictions, setPredictions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const svcRef = useRef<any>(null)
  const detailRef = useRef<any>(null)
  const mapDivRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) return
    loadGoogleMapsScript(apiKey).then(() => setReady(true)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!ready || !mapDivRef.current) return
    svcRef.current = new window.google!.maps.places.AutocompleteService()
    detailRef.current = new window.google!.maps.places.PlacesService(mapDivRef.current)
  }, [ready])

  const search = useCallback((value: string) => {
    if (!svcRef.current || !value.trim()) {
      setPredictions([])
      setOpen(false)
      return
    }
    setLoading(true)
    svcRef.current.getPlacePredictions({ input: value, componentRestrictions: { country: 'th' } }, (results: any, status: any) => {
      setLoading(false)
      if (status === window.google!.maps.places.PlacesServiceStatus.OK && results) {
        setPredictions(results)
        setOpen(true)
      } else {
        setPredictions([])
        setOpen(false)
      }
    })
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(value), 300)
  }

  const handleSelect = (p: any) => {
    if (!detailRef.current) return
    setQuery(p.description)
    setOpen(false)
    setPredictions([])
    detailRef.current.getDetails(
      { placeId: p.place_id, fields: ["name", "formatted_address", "geometry", "place_id"] },
      (place: any, status: any) => {
        if (status === window.google!.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
          onSelect({
            name: place.name || p.structured_formatting.main_text,
            address: place.formatted_address || p.description,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
            place_id: place.place_id || null,
          })
        }
      }
    )
  }

  return (
    <div className="relative">
      <div ref={mapDivRef} className="hidden" />

      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        )}
        <Input
          value={query}
          onChange={handleChange}
          onFocus={() => predictions.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          disabled={disabled || !ready}
          placeholder={ready ? placeholder : "地图加载中..."}
          className="pl-9"
          autoComplete="off"
        />
      </div>

      {open && predictions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg overflow-hidden">
          {predictions.map((p) => (
            <button
              key={p.place_id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(p) }}
              className="w-full text-left px-3 py-2.5 hover:bg-accent flex items-start gap-2 text-sm transition-colors"
            >
              <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <div className="font-medium truncate">{p.structured_formatting.main_text}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {p.structured_formatting.secondary_text}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
