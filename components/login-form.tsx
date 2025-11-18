"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { ButtonLoading } from "@/components/ui/loading"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { loginAction } from "@/app/login/actions"

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
      const result = await loginAction(email, password)

      if (!result.ok) {
        setError(result.error || "登录失败")
        return
      }

      toast.success(`欢迎回来，${result.admin?.display_name}!`)
      router.push("/dashboard")
      router.refresh()
    } catch (err) {
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
        {loading ? (
          <div className="flex items-center gap-2">
            <ButtonLoading />
            <span>登录中...</span>
          </div>
        ) : (
          "立即登录"
        )}
      </Button>
    </form>
  )
}
