"use client"

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { UserTable } from '@/components/users/UserTable'
import { LoadingSpinner } from '@/components/ui/loading'
import type { UserListItem, UserListParams } from '@/lib/types/user'
import { getUserList } from './actions'

export default function UsersPage() {
    const [users, setUsers] = useState<UserListItem[]>([])
    const [loading, setLoading] = useState(false)
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        hasNext: false,
        hasPrev: false
    })

    const [filters, setFilters] = useState<Omit<UserListParams, 'page' | 'limit'>>({
        search: '',
        country_code: undefined,
        language_code: undefined,
        is_banned: undefined,
        level: undefined,
        date_from: undefined,
        date_to: undefined,
        sort_by: 'created_at',
        sort_order: 'desc'
    })

    // 加载用户列表
    const loadUsers = async (params?: Partial<UserListParams>) => {
        try {
            setLoading(true)
            const queryParams: UserListParams = {
                page: pagination.page,
                limit: pagination.limit,
                ...filters,
                ...params
            }

            const result = await getUserList(queryParams)

            if (result.success && result.data) {
                setUsers(result.data.users)
                setPagination({
                    page: result.data.page,
                    limit: result.data.limit,
                    total: result.data.total,
                    hasNext: result.data.hasNext,
                    hasPrev: result.data.hasPrev
                })
            } else {
                toast.error(result.error || "获取用户列表失败")
            }
        } catch (error) {
            console.error('加载用户列表失败:', error)
            toast.error("加载用户列表失败")
        } finally {
            setLoading(false)
        }
    }

    // 初始加载
    useEffect(() => {
        // 首次加载时显示加载状态
        setLoading(true)
        loadUsers()
    }, [])

    // 处理搜索
    const handleSearch = (search: string) => {
        setFilters(prev => ({ ...prev, search }))
        setPagination(prev => ({ ...prev, page: 1 }))
        loadUsers({ search, page: 1 })
    }

    // 处理筛选
    const handleFilter = (key: keyof UserListParams, value: string | boolean | number | undefined) => {
        setFilters(prev => ({ ...prev, [key]: value }))
        setPagination(prev => ({ ...prev, page: 1 }))
        loadUsers({ [key]: value, page: 1 })
    }

    // 处理分页
    const handlePageChange = (page: number) => {
        setPagination(prev => ({ ...prev, page }))
        loadUsers({ page })
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">用户管理</h1>
                    <p className="text-muted-foreground">
                        查看和管理平台用户信息
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>用户列表</CardTitle>
                </CardHeader>
                <CardContent>
                    <UserTable
                        users={users}
                        total={pagination.total}
                        currentPage={pagination.page}
                        limit={pagination.limit}
                        hasNext={pagination.hasNext}
                        hasPrev={pagination.hasPrev}
                        loading={loading}
                        onSearch={handleSearch}
                        onFilter={handleFilter}
                        onPageChange={handlePageChange}
                    />
                </CardContent>
            </Card>
        </div>
    )
}

