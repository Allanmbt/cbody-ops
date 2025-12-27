"use client"

import { useState, useEffect } from "react"
import { Search, Info } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "sonner"
import { GirlAttendanceTable } from "@/components/business/GirlAttendanceTable"
import { getGirlAttendanceStats, getCities } from "./actions"
import type { GirlAttendanceStats, City } from "@/lib/features/girl-attendance"

export default function GirlAttendancePage() {
  const [data, setData] = useState<GirlAttendanceStats[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [cityId, setCityId] = useState<number | undefined>(undefined)
  const [sortBy, setSortBy] = useState<string>('booking_rate_percent')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // 加载城市列表
  useEffect(() => {
    const loadCities = async () => {
      try {
        const result = await getCities()
        if (result.ok) {
          setCities(result.data)
        }
      } catch (error) {
        console.error('加载城市列表失败:', error)
      }
    }
    loadCities()
  }, [])

  // 加载数据
  const loadData = async () => {
    setLoading(true)
    try {
      const result = await getGirlAttendanceStats({
        search: search || undefined,
        city_id: cityId,
        sort_by: sortBy as any,
        sort_order: sortOrder
      })

      if (result.ok) {
        setData(result.data)
      } else {
        toast.error(result.error || '加载考勤统计失败')
      }
    } catch (error) {
      console.error('加载考勤统计失败:', error)
      toast.error('加载考勤统计失败')
    } finally {
      setLoading(false)
    }
  }

  // 初始化加载
  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 搜索或筛选变化时重新加载
  useEffect(() => {
    const timer = setTimeout(() => {
      loadData()
    }, 300) // 防抖300ms

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, cityId, sortBy, sortOrder])

  // 处理排序
  const handleSort = (field: string) => {
    if (sortBy === field) {
      // 同一字段切换升降序
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      // 不同字段默认降序
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  // 获取城市名称（优先中文）
  const getCityName = (city: City) => {
    return city.name.zh || city.name.en || city.name.th || `城市 ${city.id}`
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:px-8 md:py-6">
      {/* 页面标题 */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">技师考勤统计</h1>
        <p className="text-sm text-muted-foreground">
          最近30天的技师在线时长、完成订单数和预订率统计
        </p>
      </div>

      {/* 说明提示 */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>预订率计算：</strong>订单时长 ÷ 在线时长 × 100%
          <span className="ml-4 text-muted-foreground">
            （预订率越高表示在线时间利用率越高）
          </span>
        </AlertDescription>
      </Alert>

      {/* 搜索和筛选栏 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索技师名称或工号..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={cityId?.toString() || 'all'}
              onValueChange={(value) => setCityId(value === 'all' ? undefined : parseInt(value))}
            >
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="筛选城市" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部城市</SelectItem>
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

      {/* 统计表格 */}
      <Card>
        <CardHeader>
          <CardTitle>考勤明细</CardTitle>
          <CardDescription>
            共 {data.length} 位已认证技师（已排除被屏蔽的技师）
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GirlAttendanceTable
            data={data}
            loading={loading}
            onSort={handleSort}
            sortBy={sortBy}
            sortOrder={sortOrder}
          />
        </CardContent>
      </Card>
    </div>
  )
}
