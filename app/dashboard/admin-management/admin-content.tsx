"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Eye,
  EyeOff,
  Shield,
  Edit,
  RotateCcw,
  Plus,
  Search,
  Filter,
  MoreVertical,
  AlertTriangle,
  CheckCircle,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { getCurrentAdminProfile, isSuperAdmin } from "@/lib/auth"
import { getSupabaseClient, getSupabaseAdminClient } from "@/lib/supabase"
import type { AdminProfile, AdminRole, AdminOperationLog } from "@/lib/types"
import { toast } from "sonner"

interface AdminWithStatus extends AdminProfile {
  last_login?: string
}

export function AdminContent() {
  const router = useRouter()
  const [currentAdmin, setCurrentAdmin] = useState<AdminProfile | null>(null)
  const [admins, setAdmins] = useState<AdminWithStatus[]>([])
  const [logs, setLogs] = useState<AdminOperationLog[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<AdminRole | "all">("all")
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false)
  const [selectedAdmin, setSelectedAdmin] = useState<AdminWithStatus | null>(null)
  const [displayName, setDisplayName] = useState("")
  const [newPassword, setNewPassword] = useState("")

  useEffect(() => {
    async function checkAuthAndLoadData() {
      try {
        const profile = await getCurrentAdminProfile()
        if (!profile || !isSuperAdmin(profile.role)) {
          router.push('/dashboard')
          return
        }
        setCurrentAdmin(profile)
        await loadAdmins()
        await loadLogs()
      } catch (error) {
        console.error('Auth check failed:', error)
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    checkAuthAndLoadData()
  }, [router])

  const loadAdmins = async () => {
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('admin_profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      setAdmins(data || [])
    } catch (error) {
      console.error('Failed to load admins:', error)
      toast.error('加载管理员列表失败')
    }
  }

  const loadLogs = async () => {
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('admin_operation_logs')
        .select(`
          *,
          operator:admin_profiles!operator_id(display_name),
          target:admin_profiles!target_admin_id(display_name)
        `)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        throw error
      }

      setLogs(data || [])
    } catch (error) {
      console.error('Failed to load logs:', error)
    }
  }

  const handleEditDisplayName = async () => {
    if (!selectedAdmin || !displayName.trim()) {
      toast.error('请输入有效的显示名称')
      return
    }

    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase
        .from('admin_profiles')
        .update({
          display_name: displayName.trim(),
          updated_by: currentAdmin?.id,
          updated_at: new Date().toISOString()
        } as any)
        .eq('id', selectedAdmin.id)

      if (error) {
        throw error
      }

      // Log the operation
      await supabase
        .from('admin_operation_logs')
        .insert({
          operator_id: currentAdmin?.id,
          target_admin_id: selectedAdmin.id,
          operation_type: 'update_display_name',
          operation_details: {
            old_name: selectedAdmin.display_name,
            new_name: displayName.trim()
          }
        } as any)

      toast.success('显示名称更新成功')
      setIsEditDialogOpen(false)
      setSelectedAdmin(null)
      setDisplayName("")
      await loadAdmins()
      await loadLogs()
    } catch (error) {
      console.error('Update failed:', error)
      toast.error('更新显示名称失败')
    }
  }

  const handleResetPassword = async () => {
    if (!selectedAdmin || !newPassword.trim()) {
      toast.error('请输入有效的新密码')
      return
    }

    try {
      const supabaseAdmin = getSupabaseAdminClient()
      const { error } = await supabaseAdmin.auth.admin.updateUserById(
        selectedAdmin.id,
        { password: newPassword }
      )

      if (error) {
        throw error
      }

      // Log the operation
      const supabase = getSupabaseClient()
      await supabase
        .from('admin_operation_logs')
        .insert({
          operator_id: currentAdmin?.id,
          target_admin_id: selectedAdmin.id,
          operation_type: 'reset_password',
          operation_details: {
            admin_name: selectedAdmin.display_name
          }
        } as any)

      toast.success('密码重置成功')
      setIsResetPasswordDialogOpen(false)
      setSelectedAdmin(null)
      setNewPassword("")
      await loadLogs()
    } catch (error) {
      console.error('Password reset failed:', error)
      toast.error('重置密码失败')
    }
  }

  const handleToggleStatus = async (admin: AdminWithStatus) => {
    if (admin.id === currentAdmin?.id) {
      toast.error('不能禁用自己的账号')
      return
    }

    try {
      const supabase = getSupabaseClient()
      const newStatus = !admin.is_active

      const { error } = await supabase
        .from('admin_profiles')
        .update({
          is_active: newStatus,
          updated_by: currentAdmin?.id,
          updated_at: new Date().toISOString()
        } as any)
        .eq('id', admin.id)

      if (error) {
        throw error
      }

      // Log the operation
      await supabase
        .from('admin_operation_logs')
        .insert({
          operator_id: currentAdmin?.id,
          target_admin_id: admin.id,
          operation_type: 'toggle_status',
          operation_details: {
            admin_name: admin.display_name,
            new_status: newStatus ? 'active' : 'inactive'
          }
        } as any)

      toast.success(`已${newStatus ? '启用' : '禁用'}账号`)
      await loadAdmins()
      await loadLogs()
    } catch (error) {
      console.error('Toggle status failed:', error)
      toast.error('更改状态失败')
    }
  }

  const filteredAdmins = admins.filter(admin => {
    const matchesSearch = admin.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         admin.id.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesRole = roleFilter === "all" || admin.role === roleFilter
    return matchesSearch && matchesRole
  })

  const getRoleDisplayName = (role: AdminRole): string => {
    switch (role) {
      case 'superadmin':
        return '超级管理员'
      case 'admin':
        return '管理员'
      case 'finance':
        return '财务'
      case 'support':
        return '客服'
      default:
        return '未知角色'
    }
  }

  const getRoleBadgeVariant = (role: AdminRole) => {
    switch (role) {
      case 'superadmin':
        return 'default'
      case 'admin':
        return 'secondary'
      case 'finance':
        return 'outline'
      case 'support':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  if (loading) {
    return <div className="text-center p-8">加载中...</div>
  }

  if (!currentAdmin || !isSuperAdmin(currentAdmin.role)) {
    return <div className="text-center p-8">权限不足</div>
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">管理员管理</h1>
          <p className="text-muted-foreground">管理系统管理员账号和权限</p>
        </div>
        <Button className="gap-2">
          <Plus className="size-4" />
          添加管理员
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>管理员列表</CardTitle>
              <CardDescription>
                当前共有 {admins.length} 个管理员账号
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-6">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索管理员..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select
                  value={roleFilter}
                  onValueChange={(value) => setRoleFilter(value as AdminRole | "all")}
                >
                  <SelectTrigger className="w-40">
                    <Filter className="size-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有角色</SelectItem>
                    <SelectItem value="superadmin">超级管理员</SelectItem>
                    <SelectItem value="admin">管理员</SelectItem>
                    <SelectItem value="finance">财务</SelectItem>
                    <SelectItem value="support">客服</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>管理员</TableHead>
                      <TableHead>角色</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAdmins.map((admin) => (
                      <TableRow key={admin.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="size-8">
                              <AvatarFallback>
                                {admin.display_name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{admin.display_name}</div>
                              <div className="text-xs text-muted-foreground">
                                {admin.id.slice(0, 8)}...
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(admin.role)}>
                            {getRoleDisplayName(admin.role)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {admin.is_active ? (
                              <CheckCircle className="size-4 text-green-500" />
                            ) : (
                              <AlertTriangle className="size-4 text-red-500" />
                            )}
                            <span className={cn(
                              "text-sm",
                              admin.is_active ? "text-green-600" : "text-red-600"
                            )}>
                              {admin.is_active ? "正常" : "禁用"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(admin.created_at).toLocaleDateString('zh-CN')}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedAdmin(admin)
                                  setDisplayName(admin.display_name)
                                  setIsEditDialogOpen(true)
                                }}
                              >
                                <Edit className="size-4 mr-2" />
                                编辑显示名
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedAdmin(admin)
                                  setIsResetPasswordDialogOpen(true)
                                }}
                              >
                                <RotateCcw className="size-4 mr-2" />
                                重置密码
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleToggleStatus(admin)}
                                disabled={admin.id === currentAdmin?.id}
                              >
                                {admin.is_active ? (
                                  <EyeOff className="size-4 mr-2" />
                                ) : (
                                  <Eye className="size-4 mr-2" />
                                )}
                                {admin.is_active ? "禁用账号" : "启用账号"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>操作日志</CardTitle>
              <CardDescription>最近的管理员操作记录</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                      <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Shield className="size-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">
                          {getOperationDisplayName(log.operation_type)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          操作者: {(log as any).operator?.display_name || '未知'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleString('zh-CN')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Display Name Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑显示名</DialogTitle>
            <DialogDescription>
              修改 {selectedAdmin?.display_name} 的显示名称
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="displayName">显示名称</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="请输入新的显示名称"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleEditDisplayName}>
              确认修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={isResetPasswordDialogOpen} onOpenChange={setIsResetPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重置密码</DialogTitle>
            <DialogDescription>
              为 {selectedAdmin?.display_name} 设置新密码
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="newPassword">新密码</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="请输入新密码"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResetPasswordDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleResetPassword}>
              重置密码
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function getOperationDisplayName(operationType: string): string {
  switch (operationType) {
    case 'update_display_name':
      return '修改显示名称'
    case 'reset_password':
      return '重置密码'
    case 'toggle_status':
      return '切换账号状态'
    default:
      return '未知操作'
  }
}