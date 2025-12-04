"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LoadingSpinner } from "@/components/ui/loading"
import { toast } from "sonner"
import { Search, RefreshCw, Circle, Users2, TrendingUp } from "lucide-react"
import {
  getTherapistStats,
  getMonitoringTherapists,
  type TherapistStats,
  type MonitoringTherapistFilters
} from "@/app/dashboard/operations/therapists/actions"
import { MonitoringTherapistTable } from "./MonitoringTherapistTable"

// ✅ 优化：接收服务端传来的初始数据
interface TherapistMonitoringPageProps {
  initialTherapists: any[]
  initialTotal: number
}

export function TherapistMonitoringPage({ initialTherapists, initialTotal }: TherapistMonitoringPageProps) {
  const [stats, setStats] = useState<TherapistStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [therapists, setTherapists] = useState<any[]>(initialTherapists)
  const [loadingTherapists, setLoadingTherapists] = useState(false)
  const [total, setTotal] = useState(initialTotal)
  const isInitialMount = useRef(true)

  // 筛选条件
  const [filters, setFilters] = useState<MonitoringTherapistFilters>({
    search: '',
    status: ['available', 'busy'],  // 默认显示在线和忙碌
    city: undefined,
    only_abnormal: false,
    page: 1,
    limit: 50
  })

  // 搜索输入框的临时值（用于输入但未提交）
  const [searchInput, setSearchInput] = useState('')

  // 加载统计数据
  const loadStats = async () => {
    setLoadingStats(true)
    const result = await getTherapistStats()
    if (result.ok && result.data) {
      setStats(result.data)
    } else {
      toast.error(result.error || "加载统计数据失败")
    }
    setLoadingStats(false)
  }

  // 加载技师列表
  const loadTherapists = async () => {
    setLoadingTherapists(true)
    const result = await getMonitoringTherapists(filters)
    if (result.ok && result.data) {
      setTherapists(result.data.therapists)
      setTotal(result.data.total)
    } else {
      toast.error(result.error || "加载技师列表失败")
    }
    setLoadingTherapists(false)
  }

  // ✅ 优化：仅加载统计数据，技师列表已由服务端传入
  useEffect(() => {
    loadStats()
    isInitialMount.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 筛选条件变化时重新加载
  useEffect(() => {
    // 跳过初始挂载
    if (isInitialMount.current) {
      return
    }
    loadTherapists()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.city, filters.only_abnormal, filters.page])

  // 当 filters.search 变化时重新加载（由搜索按钮触发）
  useEffect(() => {
    if (isInitialMount.current) {
      return
    }
    loadTherapists()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search])

  // 刷新数据
  const handleRefresh = () => {
    loadStats()
    loadTherapists()
    toast.success("已刷新数据")
  }

  // 重置筛选
  const handleReset = () => {
    setSearchInput('')
    setFilters({
      search: '',
      status: ['available', 'busy'],
      city: undefined,
      only_abnormal: false,
      page: 1,
      limit: 50
    })
  }

  // 执行搜索
  const handleSearch = () => {
    setFilters({ ...filters, search: searchInput.trim(), page: 1 })
  }

  // 处理搜索输入框回车键
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  // 状态筛选切换
  const toggleStatus = (status: 'available' | 'busy' | 'offline') => {
    const currentStatuses = filters.status || []
    const newStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter(s => s !== status)
      : [...currentStatuses, status]
    setFilters({ ...filters, status: newStatuses as any, page: 1 })
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:px-8 md:py-6">
      {/* 页面标题 */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">技师状态监控</h1>
          <p className="text-sm text-muted-foreground mt-1">实时监控技师在线状态、位置、排队情况</p>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm" className="w-fit">
          <RefreshCw className="mr-2 h-4 w-4" />
          刷新
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {/* 在线 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">在线</CardTitle>
            <Circle className="h-4 w-4 text-green-500 fill-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {loadingStats ? "-" : stats?.online || 0}
              <span className="text-base font-normal text-muted-foreground ml-1">人</span>
            </div>
          </CardContent>
        </Card>

        {/* 忙碌 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">忙碌</CardTitle>
            <Circle className="h-4 w-4 text-orange-500 fill-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {loadingStats ? "-" : stats?.busy || 0}
              <span className="text-base font-normal text-muted-foreground ml-1">人</span>
            </div>
          </CardContent>
        </Card>

        {/* 离线 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">离线</CardTitle>
            <Circle className="h-4 w-4 text-gray-400 fill-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingStats ? "-" : stats?.offline || 0}
              <span className="text-base font-normal text-muted-foreground ml-1">人</span>
            </div>
          </CardContent>
        </Card>

        {/* 今日上线率 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">今日上线率</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingStats ? "-" : `${stats?.today_online_rate || 0}%`}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 筛选区域 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            {/* 第一行：搜索 */}
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex-1 flex gap-2">
                <Label htmlFor="search" className="sr-only">搜索</Label>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="搜索工号/姓名"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    className="pl-9"
                  />
                </div>
                <Button onClick={handleSearch} size="default">
                  <Search className="mr-2 h-4 w-4" />
                  搜索
                </Button>
              </div>
              <Select
                value={filters.city}
                onValueChange={(value) => setFilters({ ...filters, city: value === 'all' ? undefined : value, page: 1 })}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="全部城市" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部城市</SelectItem>
                  <SelectItem value="1">曼谷</SelectItem>
                  <SelectItem value="2">芭提雅</SelectItem>
                  <SelectItem value="3">普吉</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 第二行：状态筛选 */}
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="status-available"
                  checked={filters.status?.includes('available')}
                  onCheckedChange={() => toggleStatus('available')}
                />
                <label htmlFor="status-available" className="text-sm font-medium flex items-center gap-1">
                  <Circle className="h-3 w-3 text-green-500 fill-green-500" />
                  在线
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="status-busy"
                  checked={filters.status?.includes('busy')}
                  onCheckedChange={() => toggleStatus('busy')}
                />
                <label htmlFor="status-busy" className="text-sm font-medium flex items-center gap-1">
                  <Circle className="h-3 w-3 text-orange-500 fill-orange-500" />
                  忙碌
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="status-offline"
                  checked={filters.status?.includes('offline')}
                  onCheckedChange={() => toggleStatus('offline')}
                />
                <label htmlFor="status-offline" className="text-sm font-medium flex items-center gap-1">
                  <Circle className="h-3 w-3 text-gray-400 fill-gray-400" />
                  离线
                </label>
              </div>
              <div className="flex items-center space-x-2 ml-auto">
                <Checkbox
                  id="only-abnormal"
                  checked={filters.only_abnormal}
                  onCheckedChange={(checked) => setFilters({ ...filters, only_abnormal: !!checked, page: 1 })}
                />
                <label htmlFor="only-abnormal" className="text-sm font-medium">仅异常</label>
              </div>
              <Button variant="outline" size="sm" onClick={handleReset}>
                重置
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 技师列表 */}
      <Card>
        <CardHeader>
          <CardTitle>技师列表</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <MonitoringTherapistTable
            therapists={therapists}
            loading={loadingTherapists}
            onRefresh={loadTherapists}
          />
        </CardContent>
      </Card>

      {/* 分页 */}
      {total > 0 && (
        <div className="flex items-center justify-between px-2">
          <div className="text-sm text-muted-foreground">
            显示 {((filters.page || 1) - 1) * (filters.limit || 50) + 1} - {Math.min((filters.page || 1) * (filters.limit || 50), total)} 条，共 {total} 条
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilters({ ...filters, page: Math.max(1, (filters.page || 1) - 1) })}
              disabled={(filters.page || 1) === 1}
            >
              上一页
            </Button>
            <div className="text-sm">第 {filters.page || 1} 页</div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilters({ ...filters, page: (filters.page || 1) + 1 })}
              disabled={(filters.page || 1) * (filters.limit || 50) >= total}
            >
              下一页
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
