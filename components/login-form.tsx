"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signIn, getAdminProfile } from "@/lib/auth"
import { debugAuth } from "@/lib/debug"
import { toast } from "sonner"

export function LoginForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError("")

    const formData = new FormData(event.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    try {
      const { data, error: authError } = await signIn(email, password)

      if (authError) {
        setError("邮箱或密码错误: " + authError.message)
        return
      }

      if (!data.user) {
        setError("登录失败，请重试")
        return
      }

      console.log("Login successful, user:", data.user.id)

      // Debug auth state
      await debugAuth()

      // Check if user is admin
      const adminProfile = await getAdminProfile(data.user.id)
      if (!adminProfile) {
        setError("您没有管理员权限，请联系超级管理员。用户ID: " + data.user.id)
        return
      }

      if (!adminProfile.is_active) {
        setError("您的账号已被禁用，请联系超级管理员")
        return
      }

      toast.success(`欢迎回来，${adminProfile.display_name}!`)
      router.push("/dashboard")
      router.refresh()
    } catch (err) {
      console.error("Login error:", err)
      setError("登录时发生错误，请重试")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      {error && (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="grid gap-2">
        <Label htmlFor="email">邮箱</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="admin@cbody.vip"
          autoComplete="email"
          disabled={loading}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">密码</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          disabled={loading}
          required
        />
      </div>
      <div className="flex items-center justify-between">
        <label
          htmlFor="remember"
          className="flex cursor-pointer items-center gap-2 text-sm"
        >
          <Checkbox id="remember" name="remember" disabled={loading} />
          <span>记住我</span>
        </label>
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-sm font-medium"
          disabled={loading}
        >
          忘记密码？
        </Button>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "登录中..." : "立即登录"}
      </Button>
    </form>
  )
}
