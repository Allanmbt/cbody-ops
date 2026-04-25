"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { IncallLocationTable } from "@/components/incall-locations/IncallLocationTable"
import { AddIncallLocationDialog } from "@/components/incall-locations/AddIncallLocationDialog"
import { EditIncallLocationDialog } from "@/components/incall-locations/EditIncallLocationDialog"
import { getIncallLocations, getCities } from "./actions"
import type { IncallLocationListParams, IncallLocation, PaginatedResponse } from "@/lib/features/incall-locations"

type City = { id: number; code: string; name: { en: string; zh: string; th: string } }

export default function IncallLocationsPage() {
  const [locations, setLocations] = useState<IncallLocation[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [editingLocation, setEditingLocation] = useState<IncallLocation | null>(null)

  const [searchInput, setSearchInput] = useState("")
  const [filters, setFilters] = useState<IncallLocationListParams>({
    page: 1,
    limit: 20,
    search: "",
    city_id: undefined,
    is_active: undefined,
  })

  useEffect(() => {
    getCities().then((res) => {
      if (res.ok && res.data) setCities(res.data)
    })
  }, [])

  const loadLocations = useCallback(async (params?: IncallLocationListParams) => {
    setLoading(true)
    try {
      const result = await getIncallLocations(params || filters)
      if (result.ok && result.data) {
        const d = result.data as PaginatedResponse<IncallLocation>
        setLocations(d.data)
        setPagination({ page: d.page, limit: d.limit, total: d.total, totalPages: d.totalPages })
      } else {
        toast.error(result.error || "加载地址列表失败")
      }
    } catch {
      toast.error("加载地址列表失败")
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    loadLocations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applyFilters = (next: IncallLocationListParams) => {
    setFilters(next)
    loadLocations(next)
  }

  const handleSearch = () => {
    applyFilters({ ...filters, search: searchInput.trim(), page: 1 })
  }

  const handleCityFilter = (val: string) => {
    applyFilters({ ...filters, city_id: val === "all" ? undefined : parseInt(val), page: 1 })
  }

  const handleActiveFilter = (checked: boolean) => {
    applyFilters({ ...filters, is_active: checked ? true : undefined, page: 1 })
  }

  const handleReset = () => {
    setSearchInput("")
    const next: IncallLocationListParams = { page: 1, limit: 20, search: "", city_id: undefined, is_active: undefined }
    applyFilters(next)
  }

  const handlePageChange = (newPage: number) => {
    applyFilters({ ...filters, page: newPage })
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:px-8 md:py-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold">到店地址管理</h1>
        </div>
        <AddIncallLocationDialog cities={cities} onCreated={() => loadLocations()} />
      </div>

      <EditIncallLocationDialog
        location={editingLocation}
        cities={cities}
        onClose={() => setEditingLocation(null)}
        onUpdated={() => loadLocations()}
      />

      {/* 筛选区域 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="搜索地点名称或地址..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-10 pr-4"
                />
              </div>
            </div>
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-1" />
              搜索
            </Button>

            <div className="w-full md:w-44">
              <Select
                value={filters.city_id?.toString() || "all"}
                onValueChange={handleCityFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择城市" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部城市</SelectItem>
                  {cities.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.name?.zh || c.name?.en || c.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="active-only"
                checked={filters.is_active === true}
                onCheckedChange={handleActiveFilter}
              />
              <Label htmlFor="active-only" className="text-sm cursor-pointer">
                仅显示激活
              </Label>
            </div>

            <Button variant="outline" onClick={handleReset}>
              重置
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>地址列表</span>
            {!loading && (
              <span className="text-sm font-normal text-muted-foreground">
                共 {pagination.total} 条
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <IncallLocationTable
            locations={locations}
            loading={loading}
            onRefresh={() => loadLocations()}
            onEdit={setEditingLocation}
          />

          {!loading && pagination.total > 0 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                显示 {(pagination.page - 1) * pagination.limit + 1}–
                {Math.min(pagination.page * pagination.limit, pagination.total)} 条，共 {pagination.total} 条
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                >
                  上一页
                </Button>
                <Button variant="outline" size="sm" disabled>
                  第 {pagination.page} 页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
