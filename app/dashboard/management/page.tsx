import { redirect } from "next/navigation"
import { ManagementContent } from "./management-content"
import { getAdminManagementInit } from "./actions"

/**
 * 管理员管理页面
 * 优化：使用 Server Component 在服务端获取数据，减少客户端等待时间
 */
export default async function ManagementPage() {
  // 服务端直接获取数据
  const result = await getAdminManagementInit()

  // 权限验证失败，重定向
  if (!result.ok) {
    if (result.error === "未登录") {
      redirect("/login")
    }
    redirect("/dashboard")
  }

  // 传递初始数据给客户端组件
  return (
    <ManagementContent
      initialCurrentAdmin={result.currentAdmin!}
      initialAdmins={result.admins || []}
    />
  )
}