"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Eye,
  EyeOff,
  Edit,
  RotateCcw,
  Plus,
  Search,
  Filter,
  MoreVertical,
  AlertTriangle,
  CheckCircle,
  Copy,
  Check,
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { PageLoading } from "@/components/ui/loading"
import { cn } from "@/lib/utils"
import { getCurrentAdminProfile, isSuperAdmin } from "@/lib/auth"
import { getSupabaseAdminClient } from "@/lib/supabase"
import type { AdminProfile, AdminRole } from "@/lib/types/admin"
import { toast } from "sonner"

interface AdminWithStatus extends AdminProfile {
  last_login?: string
}

const createAdminSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少6位字符').refine(
    (val) => /^(?=.*[a-zA-Z])(?=.*\d)/.test(val),
    { message: '密码必须包含字母和数字' }
  ),
  confirmPassword: z.string(),
  display_name: z.string().min(2, '显示名至少2个字符').max(50, '显示名不超过50个字符'),
  role: z.enum(['superadmin', 'admin', 'finance', 'support'])
}).refine((data) => data.password === data.confirmPassword, {
  message: '两次输入的密码不一致',
  path: ['confirmPassword']
})

type CreateAdminForm = z.infer<typeof createAdminSchema>

export function ManagementContent() {
  const router = useRouter()
  const [currentAdmin, setCurrentAdmin] = useState<AdminProfile | null>(null)
  const [admins, setAdmins] = useState<AdminWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<AdminRole | "all">("all")
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false)
  const [selectedAdmin, setSelectedAdmin] = useState<AdminWithStatus | null>(null)
  const [displayName, setDisplayName] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const createForm = useForm<CreateAdminForm>({
    resolver: zodResolver(createAdminSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      display_name: '',
      role: 'support'
    }
  })

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
      // 使用admin客户端绕过RLS限制，因为这个页面只有超级管理员能访问
      const supabase = getSupabaseAdminClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
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


  const handleEditDisplayName = async () => {
    if (!selectedAdmin || !displayName.trim()) {
      toast.error('请输入有效的显示名称')
      return
    }

    try {
      // 继续使用admin客户端进行更新操作
      const supabase = getSupabaseAdminClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('admin_profiles')
        .update({
          display_name: displayName.trim(),
          updated_by: currentAdmin?.id || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedAdmin.id)

      if (error) {
        throw error
      }


      toast.success('显示名称更新成功')
      setIsEditDialogOpen(false)
      setSelectedAdmin(null)
      setDisplayName("")
      await loadAdmins()
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


      toast.success('密码重置成功')
      setIsResetPasswordDialogOpen(false)
      setSelectedAdmin(null)
      setNewPassword("")
    } catch (error) {
      console.error('Password reset failed:', error)
      toast.error('重置密码失败')
    }
  }

  const handleCreateAdmin = async (data: CreateAdminForm) => {
    try {
      const supabaseAdmin = getSupabaseAdminClient()

      // 创建用户账号
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true
      })

      if (authError || !authData.user) {
        throw authError || new Error('创建用户失败')
      }

      // 创建管理员配置
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: profileError } = await (supabaseAdmin as any)
        .from('admin_profiles')
        .insert({
          id: authData.user.id,
          display_name: data.display_name,
          role: data.role,
          is_active: true,
          created_by: currentAdmin?.id || null
        })

      if (profileError) {
        // 如果配置创建失败，删除已创建的用户
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        throw profileError
      }

      toast.success('管理员添加成功')
      setIsCreateDialogOpen(false)
      createForm.reset()
      await loadAdmins()
    } catch (error) {
      console.error('Create admin failed:', error)
      const errorMessage = error instanceof Error ? error.message : '添加管理员失败'
      toast.error(errorMessage)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(text)
      toast.success('ID已复制到剪贴板')
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error('复制失败')
    }
  }

  const handleToggleStatus = async (admin: AdminWithStatus) => {
    if (admin.id === currentAdmin?.id) {
      toast.error('不能禁用自己的账号')
      return
    }

    try {
      const supabase = getSupabaseAdminClient()
      const newStatus = !admin.is_active

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('admin_profiles')
        .update({
          is_active: newStatus,
          updated_by: currentAdmin?.id || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', admin.id)

      if (error) {
        throw error
      }


      toast.success(`已${newStatus ? '启用' : '禁用'}账号`)
      await loadAdmins()
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
    return <PageLoading text="正在加载管理员信息..." />
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
        <Button
          className="gap-2"
          onClick={() => setIsCreateDialogOpen(true)}
        >
          <Plus className="size-4" />
          添加管理员
        </Button>
      </div>

      <div className="grid gap-6">
        <div>
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

              <div className="rounded-md border overflow-hidden">
                <div className="overflow-x-auto">
                  <TooltipProvider>
                    <Table className="min-w-[800px] w-full">
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
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div
                                        className="text-xs text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1 transition-colors"
                                        onClick={() => copyToClipboard(admin.id)}
                                      >
                                        <span>{admin.id.slice(0, 8)}...</span>
                                        {copiedId === admin.id ? (
                                          <Check className="size-3 text-green-500" />
                                        ) : (
                                          <Copy className="size-3" />
                                        )}
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <div className="flex flex-col items-center gap-1">
                                        <code className="text-xs bg-white px-2 py-1 rounded">
                                          {admin.id}
                                        </code>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
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
                  </TooltipProvider>
                </div>
              </div>
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

      {/* Create Admin Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>添加管理员</DialogTitle>
            <DialogDescription>
              创建新的管理员账号，请填写完整信息
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreateAdmin)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>邮箱地址</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder="请输入邮箱地址"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="display_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>显示名称</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="请输入显示名称"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>管理员角色</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择角色" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="support">客服</SelectItem>
                        <SelectItem value="finance">财务</SelectItem>
                        <SelectItem value="admin">管理员</SelectItem>
                        <SelectItem value="superadmin">超级管理员</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>密码</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="请输入密码"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>确认密码</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="请再次输入密码"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateDialogOpen(false)
                    createForm.reset()
                  }}
                >
                  取消
                </Button>
                <Button type="submit" disabled={createForm.formState.isSubmitting}>
                  {createForm.formState.isSubmitting ? '创建中...' : '创建管理员'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}

