"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createAdminUser, syncAdminProfile } from "@/lib/admin-setup"
import { debugAuth } from "@/lib/debug"
import type { AdminRole } from "@/lib/types"
import { toast } from "sonner"

export default function AdminSyncPage() {
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [role, setRole] = useState<AdminRole>("superadmin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const handleSyncProfile = async () => {
    if (!userId.trim() || !displayName.trim()) {
      toast.error("请填写用户ID和显示名称")
      return
    }

    setLoading(true)
    try {
      const result = await syncAdminProfile(userId.trim(), displayName.trim(), role)
      if (result.success) {
        toast.success("管理员权限同步成功！")
        setUserId("")
        setDisplayName("")
      } else {
        toast.error("同步失败: " + result.error)
      }
    } catch (error) {
      console.error("Sync error:", error)
      toast.error("同步时发生错误")
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAdmin = async () => {
    if (!email.trim() || !password.trim() || !displayName.trim()) {
      toast.error("请填写所有必填字段")
      return
    }

    setLoading(true)
    try {
      const result = await createAdminUser(email.trim(), password.trim(), displayName.trim(), role)
      if (result.success) {
        toast.success("管理员创建成功！")
        setEmail("")
        setPassword("")
        setDisplayName("")
      } else {
        toast.error("创建失败: " + result.error)
      }
    } catch (error) {
      console.error("Create error:", error)
      toast.error("创建时发生错误")
    } finally {
      setLoading(false)
    }
  }

  const handleDebugAuth = async () => {
    await debugAuth()
    toast.info("调试信息已输出到控制台")
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">CBODY 管理员工具</h1>
          <p className="text-muted-foreground mt-2">用于创建和同步管理员账号</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Sync Existing User */}
          <Card>
            <CardHeader>
              <CardTitle>同步现有用户</CardTitle>
              <CardDescription>为已存在的用户添加管理员权限</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="userId">用户 ID *</Label>
                <Input
                  id="userId"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="从 auth.users 表获取的 UUID"
                />
              </div>
              <div>
                <Label htmlFor="displayName">显示名称 *</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="管理员显示名称"
                />
              </div>
              <div>
                <Label htmlFor="role">角色</Label>
                <Select value={role} onValueChange={(value: AdminRole) => setRole(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="superadmin">超级管理员</SelectItem>
                    <SelectItem value="admin">管理员</SelectItem>
                    <SelectItem value="finance">财务</SelectItem>
                    <SelectItem value="support">客服</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSyncProfile} disabled={loading} className="w-full">
                {loading ? "同步中..." : "同步管理员权限"}
              </Button>
            </CardContent>
          </Card>

          {/* Create New Admin */}
          <Card>
            <CardHeader>
              <CardTitle>创建新管理员</CardTitle>
              <CardDescription>创建新的管理员账号</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="email">邮箱 *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@cbody.vip"
                />
              </div>
              <div>
                <Label htmlFor="password">密码 *</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少6位密码"
                />
              </div>
              <div>
                <Label htmlFor="newDisplayName">显示名称 *</Label>
                <Input
                  id="newDisplayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="管理员显示名称"
                />
              </div>
              <div>
                <Label htmlFor="newRole">角色</Label>
                <Select value={role} onValueChange={(value: AdminRole) => setRole(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="superadmin">超级管理员</SelectItem>
                    <SelectItem value="admin">管理员</SelectItem>
                    <SelectItem value="finance">财务</SelectItem>
                    <SelectItem value="support">客服</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreateAdmin} disabled={loading} className="w-full">
                {loading ? "创建中..." : "创建管理员"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>调试工具</CardTitle>
            <CardDescription>用于排查登录和权限问题</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleDebugAuth} variant="outline">
              调试认证状态
            </Button>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground">
          <p>⚠️ 此页面仅用于初始设置，生产环境请移除</p>
          <p>请访问 <a href="/login" className="underline text-primary">登录页面</a> 测试管理员账号</p>
        </div>
      </div>
    </div>
  )
}