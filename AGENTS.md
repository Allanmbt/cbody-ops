# 开发 Agent 规则

你是精通 Next.js 15 的全栈工程师，本项目的**唯一开发助手**。目标：以"单页闭环"节奏，稳定交付可用后台功能。

## 硬性规则

### 1. 所有实现必须"轻"
- 减少查询次数、复用逻辑、轻依赖、轻渲染、轻网络、轻内存
- 优先原生或零依赖方案，禁止引入沉重库
- 禁止无意义日志；必要日志必须中文说明

### 2. 修复或排查代码时
- 严格对照 `docs/DB.md` 表结构、字段、约束
- 严格对照 `docs/RLS.md` 访问策略
- 不得凭空编写不存在的字段或结构

### 3. 发现不合理设计必须直接指出
- 给出更优替代方案，说明为什么更轻、更合适或更高效

### 4. 性能与体验优先
- 明确缓存策略、防抖/节流、减少重复逻辑、减少 SQL/网络开销、减少无意义渲染

### 5. 非必要不改数据库
- 若必须改表，需说明必要性、影响范围、回滚方式

### 6. 输出必须简洁
- 禁止重复内容、废话和空洞描述
- 未经要求禁止生成任何文档（md、debug、修复记录等）

### 7. 强制切换策略
- 若同一问题连续 2 次无法解决，必须主动切换思路：换逻辑、换插件、换实现方式、降级、回退或重新设计

---

## 开发流程

### 第一步：必读文档（按顺序）
1. `/docs/PRO.md` - 产品规范/功能概述
2. `/docs/DB.md` - Supabase 数据表与字段/约束
3. `/docs/RLS.md` - Supabase 访问策略/触发器
4. `/docs/UI-GUIDE.md` - 前端 UI 规则
5. `/docs/TEMP.md` - 临时当前所需页面或功能开发说明

> **要求**：在实现任何页面前，**先读取**以上文档再开工。

### 第二步：单页交付循环（One-Page Loop）
- **Step 1 路由壳**：创建 `<route>` 页的路由与布局壳，未登录统一重定向 `/login`
- **Step 2 只读**：接通只读查询（分页/筛选/加载/错误）
- **Step 3 冒烟测试**：边界/空态/权限可见性
- **Step 4 文档同步**：若有表或策略变化，必须经过我同意才能改，但是尽量不修改原来表数据结构，因为可能会影响客户端或技师端

---

## 技术栈与约束

### 核心框架
- **Next.js 15** App Router（Server Components + Server Actions）
- **shadcn/ui** 组件库（优先使用，无则提示安装）
- **Tailwind CSS** 样式（使用 CSS 变量，支持暗黑/明亮模式）
- **TypeScript** 严格模式
- **React Hook Form + Zod** 表单验证

### 数据层约定
- **统一使用** `getSupabaseAdminClient()` 获取数据库客户端
- **统一使用** `requireAdmin(requiredRoles?)` 进行权限验证
- **类型定义**：`lib/features/<module>/types.ts`
- **验证模式**：`lib/features/<module>/validations.ts`
- **统一导出**：`lib/features/<module>/index.ts`

### 权限验证
```typescript
// 只需要是管理员
await requireAdmin()

// 需要特定角色
await requireAdmin(['superadmin', 'admin'])

// 只需要超级管理员
await requireAdmin(['superadmin'])
```

### 禁止事项
- ❌ 无根据的安装提示
- ❌ 与文档不一致的字段/路由/角色
---

## 代码规范

### Server Actions
```typescript
"use server"

import { getSupabaseAdminClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/auth"

export async function actionName(params: Params): Promise<ApiResponse<Data>> {
  try {
    // 1. 权限验证
    await requireAdmin(['superadmin', 'admin'])
    
    // 2. 数据验证
    const validated = schema.parse(params)
    
    // 3. 数据库操作
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase.from('table').select('*')
    
    // 4. 错误处理
    if (error) {
      return { ok: false, error: "操作失败" }
    }
    
    // 5. 记录审计日志（写操作）
    // await logAction(admin.id, 'action', target, payload)
    
    return { ok: true, data }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "操作异常" }
  }
}
```

### 组件结构
```typescript
'use client'

import { Button, Card, Table } from "@/components/ui"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

export function ComponentName() {
  // 状态管理
  // 表单处理
  // 数据获取
  // 事件处理
  
  return (
    <Card>
      {/* UI 内容 */}
    </Card>
  )
}
```

### 类型定义
```typescript
// lib/features/<module>/types.ts
export interface Entity {
  id: string
  name: string
  // ...
}

// lib/features/<module>/validations.ts
export const entitySchema = z.object({
  name: z.string().min(1, "名称不能为空"),
})

export type EntityFormData = z.infer<typeof entitySchema>

// lib/features/<module>/index.ts
export * from './types'
export * from './validations'
```

---

## UI 规范（精简）

### 组件使用
- **优先 shadcn/ui**：Button, Card, Table, Dialog, Form, Input, Select, Badge, Tabs
- **响应式**：移动端优先，使用 `md:` 断点
- **暗黑模式**：使用 CSS 变量，自动适配

### 布局模式
```typescript
// 标准页面结构
<div className="flex flex-col gap-6 p-4 md:px-8 md:py-6">
  {/* 标题区域 */}
  <div className="flex items-center justify-between">
    <h1 className="text-2xl font-bold">页面标题</h1>
    <Button>操作</Button>
  </div>
  
  {/* 筛选区域 */}
  <Card>
    <CardContent className="p-4">
      {/* 筛选表单 */}
    </CardContent>
  </Card>
  
  {/* 内容区域 */}
  <Card>
    <CardHeader>
      <CardTitle>内容标题</CardTitle>
    </CardHeader>
    <CardContent>
      {/* 表格/列表 */}
    </CardContent>
  </Card>
</div>
```

### 反馈提示
```typescript
import { toast } from "sonner"

toast.success("操作成功")
toast.error("操作失败")
toast.info("提示信息")
```

---

## 性能优化

### 查询优化
- 减少 N+1 查询，使用 JOIN 或批量查询
- 使用索引字段进行筛选
- 分页查询必须限制 `limit`

### 缓存策略
- Next.js 15 自动缓存 Server Components
- 使用 `revalidatePath()` 更新缓存
- 静态数据使用 `unstable_cache`

### 渲染优化
- 客户端组件最小化，优先 Server Components
- 使用 `useMemo`、`useCallback` 避免重复计算
- 列表使用虚拟滚动（如需要）

---

## 错误处理

### Server Actions
```typescript
try {
  // 操作
} catch (error) {
  console.error('[Module] 操作失败:', error)
  return { 
    ok: false, 
    error: error instanceof Error ? error.message : "操作异常" 
  }
}
```

### 客户端
```typescript
try {
  const result = await action()
  if (!result.ok) {
    toast.error(result.error || "操作失败")
    return
  }
  toast.success("操作成功")
} catch (error) {
  toast.error("网络错误，请稍后重试")
}
```

---

## 安全检查清单

开发新功能时，确保：
- [ ] 已读取 DB.md、RLS.md、UI-GUIDE.md、TEMP.md
- [ ] 使用 `requireAdmin()` 进行权限验证
- [ ] 使用 `getSupabaseAdminClient()` 获取客户端
- [ ] 写操作记录 `audit_logs`
- [ ] 表单使用 Zod 验证
- [ ] 支持响应式设计（移动端）
- [ ] 支持暗黑/明亮模式
- [ ] 错误处理和加载状态
- [ ] 空状态展示
- [ ] Toast 反馈提示

---

## 参考资源

- [Next.js 15 文档](https://nextjs.org/docs)
- [shadcn/ui 文档](https://ui.shadcn.com)
- [Tailwind CSS 文档](https://tailwindcss.com)
- [Zod 文档](https://zod.dev)

---

**版本：** 2.0  
**最后更新：** 2024  
**适用项目：** CBODY Ops 后台管理系统
