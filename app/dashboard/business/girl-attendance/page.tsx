"use client"

import { useCallback, useEffect, useState } from "react"
import { Info, RefreshCw, Search } from "lucide-react"
import { toast } from "sonner"

import { getCities, getCurrentAdminInfo, getGirlAttendanceStats, updateTrustScoresByAttendance } from "./actions"
import { GirlAttendanceTable } from "@/components/business/GirlAttendanceTable"
import { GirlPerformanceDialog } from "@/components/business/GirlPerformanceDialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { City, GirlAttendanceStats } from "@/lib/features/girl-attendance"
import { getGirlAttendanceCopy } from "@/lib/features/girl-attendance/copy"
import { useLocale } from "@/lib/i18n/LocaleProvider"

export default function GirlAttendancePage() {
  const { locale } = useLocale()
  const copy = getGirlAttendanceCopy(locale)
  const [data, setData] = useState<GirlAttendanceStats[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [search, setSearch] = useState("")
  const [cityId, setCityId] = useState<number | undefined>(undefined)
  const [sortBy, setSortBy] = useState<string>("booking_rate_percent")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [selectedGirl, setSelectedGirl] = useState<GirlAttendanceStats | null>(null)
  const [performanceOpen, setPerformanceOpen] = useState(false)

  useEffect(() => {
    const checkRole = async () => {
      try {
        const result = await getCurrentAdminInfo()
        if (result.ok) {
          setIsSuperAdmin(result.data.role === "superadmin")
        }
      } catch (error) {
        console.error(copy.adminRoleError, error)
      }
    }

    checkRole()
  }, [copy.adminRoleError])

  useEffect(() => {
    const loadCities = async () => {
      try {
        const result = await getCities()
        if (result.ok) {
          setCities(result.data)
        }
      } catch (error) {
        console.error(copy.loadCitiesError, error)
      }
    }

    loadCities()
  }, [copy.loadCitiesError])

  const loadData = useCallback(async () => {
    setLoading(true)

    try {
      const result = await getGirlAttendanceStats({
        search: search || undefined,
        city_id: cityId,
        sort_by: sortBy as
          | "girl_number"
          | "online_seconds"
          | "order_count"
          | "order_duration_seconds"
          | "booking_rate_percent"
          | "extension_rate"
          | "performance_index",
        sort_order: sortOrder,
      })

      if (result.ok) {
        setData(result.data)
      } else {
        toast.error(result.error || copy.loadAttendanceError)
      }
    } catch (error) {
      console.error(copy.loadAttendanceError, error)
      toast.error(copy.loadAttendanceError)
    } finally {
      setLoading(false)
    }
  }, [cityId, copy.loadAttendanceError, search, sortBy, sortOrder])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData()
    }, 300)

    return () => clearTimeout(timer)
  }, [loadData])

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder((current) => (current === "asc" ? "desc" : "asc"))
      return
    }

    setSortBy(field)
    setSortOrder("desc")
  }

  const handleViewPerformance = (girl: GirlAttendanceStats) => {
    setSelectedGirl(girl)
    setPerformanceOpen(true)
  }

  const getCityName = (city: City) => {
    if (locale === "th") {
      return city.name.th || city.name.en || city.name.zh || `เมือง ${city.id}`
    }

    return city.name.zh || city.name.en || city.name.th || `城市 ${city.id}`
  }

  const handleUpdateTrustScores = async () => {
    if (!confirm(copy.confirmTrustScoreUpdate)) {
      return
    }

    setUpdating(true)

    try {
      const result = await updateTrustScoresByAttendance()

      if (result.ok) {
        toast.success(copy.trustScoreUpdateSuccess(result.data.updated_count))
      } else {
        toast.error(result.error || copy.trustScoreUpdateError)
      }
    } catch (error) {
      console.error(copy.trustScoreUpdateError, error)
      toast.error(copy.trustScoreUpdateError)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:px-8 md:py-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{copy.pageTitle}</h1>
          <p className="text-sm text-muted-foreground">{copy.pageDescription}</p>
        </div>
        {isSuperAdmin && (
          <Button
            onClick={handleUpdateTrustScores}
            disabled={updating}
            variant="default"
            className="mt-4 md:mt-0"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${updating ? "animate-spin" : ""}`} />
            {updating ? copy.updatingTrustScores : copy.updateTrustScores}
          </Button>
        )}
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>{copy.bookingRateFormulaLabel}</strong>{copy.bookingRateFormulaValue}
          <span className="ml-4 text-muted-foreground">{copy.bookingRateFormulaHint}</span>
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={copy.searchPlaceholder}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={cityId?.toString() || "all"}
              onValueChange={(value) => setCityId(value === "all" ? undefined : parseInt(value, 10))}
            >
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder={copy.cityPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{copy.allCities}</SelectItem>
                {cities.map((city) => (
                  <SelectItem key={city.id} value={city.id.toString()}>
                    {getCityName(city)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{copy.detailsTitle}</CardTitle>
          <CardDescription>{copy.detailsDescription(data.length)}</CardDescription>
        </CardHeader>
        <CardContent>
          <GirlAttendanceTable
            data={data}
            loading={loading}
            onSort={handleSort}
            onViewPerformance={handleViewPerformance}
            sortBy={sortBy}
            sortOrder={sortOrder}
          />
        </CardContent>
      </Card>

      <GirlPerformanceDialog
        girl={selectedGirl}
        open={performanceOpen}
        onOpenChange={setPerformanceOpen}
      />
    </div>
  )
}
