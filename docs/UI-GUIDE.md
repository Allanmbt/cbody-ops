# 🎨 CBODY Ops 后台管理系统 UI 设计规范

---

## ✨ 设计理念

**Professional Minimal UI** - 专为后台管理系统设计的专业、简洁、高效的设计语言。

**核心原则：**
1. **专业高效** - 信息密度适中，操作流程清晰，减少认知负担
2. **简洁优雅** - 去除冗余装饰，聚焦核心功能，保持视觉清爽
3. **响应式优先** - 完美适配桌面端、平板和移动端（H5）
4. **暗黑/明亮双模式** - 支持系统级主题切换，护眼舒适
5. **一致性** - 统一的组件库、间距系统、交互模式
6. **无障碍友好** - 符合 WCAG 2.1 AA 标准，支持键盘导航和屏幕阅读器

**关键词：** 专业 · 简洁 · 高效 · 响应式 · 可访问性

---

## 🎨 颜色系统

### 明亮模式 (Light Mode)

| 角色 | CSS 变量 | 颜色值 | 用途 |
|------|----------|--------|------|
| **Primary** | `--primary` | `oklch(0.205 0 0)` | 主要操作按钮、链接、强调色 |
| **Primary Foreground** | `--primary-foreground` | `oklch(0.985 0 0)` | 主色上的文字 |
| **Secondary** | `--secondary` | `oklch(0.97 0 0)` | 次要按钮、背景区块 |
| **Secondary Foreground** | `--secondary-foreground` | `oklch(0.205 0 0)` | 次要色上的文字 |
| **Accent** | `--accent` | `oklch(0.97 0 0)` | 悬停状态、选中状态 |
| **Accent Foreground** | `--accent-foreground` | `oklch(0.205 0 0)` | 强调色上的文字 |
| **Muted** | `--muted` | `oklch(0.97 0 0)` | 禁用状态、占位背景 |
| **Muted Foreground** | `--muted-foreground` | `oklch(0.556 0 0)` | 辅助文字、说明文字 |
| **Destructive** | `--destructive` | `oklch(0.577 0.245 27.325)` | 危险操作、删除按钮 |
| **Background** | `--background` | `oklch(1 0 0)` | 页面主背景 |
| **Foreground** | `--foreground` | `oklch(0.145 0 0)` | 主要文字颜色 |
| **Card** | `--card` | `oklch(1 0 0)` | 卡片背景 |
| **Card Foreground** | `--card-foreground` | `oklch(0.145 0 0)` | 卡片内文字 |
| **Border** | `--border` | `oklch(0.922 0 0)` | 边框、分割线 |
| **Input** | `--input` | `oklch(0.922 0 0)` | 输入框边框 |
| **Ring** | `--ring` | `oklch(0.708 0 0)` | 焦点环、选中指示器 |

### 暗黑模式 (Dark Mode)

| 角色 | CSS 变量 | 颜色值 | 用途 |
|------|----------|--------|------|
| **Primary** | `--primary` | `oklch(0.922 0 0)` | 主要操作按钮、链接、强调色 |
| **Primary Foreground** | `--primary-foreground` | `oklch(0.205 0 0)` | 主色上的文字 |
| **Secondary** | `--secondary` | `oklch(0.269 0 0)` | 次要按钮、背景区块 |
| **Secondary Foreground** | `--secondary-foreground` | `oklch(0.985 0 0)` | 次要色上的文字 |
| **Accent** | `--accent` | `oklch(0.269 0 0)` | 悬停状态、选中状态 |
| **Accent Foreground** | `--accent-foreground` | `oklch(0.985 0 0)` | 强调色上的文字 |
| **Muted** | `--muted` | `oklch(0.269 0 0)` | 禁用状态、占位背景 |
| **Muted Foreground** | `--muted-foreground` | `oklch(0.708 0 0)` | 辅助文字、说明文字 |
| **Destructive** | `--destructive` | `oklch(0.704 0.191 22.216)` | 危险操作、删除按钮 |
| **Background** | `--background` | `oklch(0.145 0 0)` | 页面主背景 |
| **Foreground** | `--foreground` | `oklch(0.985 0 0)` | 主要文字颜色 |
| **Card** | `--card` | `oklch(0.205 0 0)` | 卡片背景 |
| **Card Foreground** | `--card-foreground` | `oklch(0.985 0 0)` | 卡片内文字 |
| **Border** | `--border` | `oklch(1 0 0 / 10%)` | 边框、分割线 |
| **Input** | `--input` | `oklch(1 0 0 / 15%)` | 输入框边框 |
| **Ring** | `--ring` | `oklch(0.556 0 0)` | 焦点环、选中指示器 |

### 状态颜色

| 状态 | 明亮模式 | 暗黑模式 | 用途 |
|------|----------|----------|------|
| **Success** | `oklch(0.646 0.222 41.116)` | `oklch(0.488 0.243 264.376)` | 成功提示、完成状态 |
| **Warning** | `oklch(0.828 0.189 84.429)` | `oklch(0.627 0.265 303.9)` | 警告提示、待处理状态 |
| **Info** | `oklch(0.6 0.118 184.704)` | `oklch(0.696 0.17 162.48)` | 信息提示、中性状态 |
| **Error** | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` | 错误提示、危险操作 |

**颜色使用原则：**
- 使用 CSS 变量而非硬编码颜色值
- 确保文字与背景对比度 ≥ 4.5:1（AA 标准）
- 暗黑模式使用柔和对比，避免刺眼
- 状态颜色保持语义一致性

---

## 📐 布局与间距

### 间距系统 (Spacing Scale)

| Token | 值 | 用途 |
|-------|-----|------|
| **XS** | `8px` (0.5rem) | 紧密元素间距、图标与文字间距 |
| **SM** | `12px` (0.75rem) | 小元素间距、表单字段间距 |
| **MD** | `16px` (1rem) | 默认间距、卡片内边距 |
| **LG** | `24px` (1.5rem) | 区块间距、卡片间距 |
| **XL** | `32px` (2rem) | 大区块间距、页面边距 |
| **2XL** | `48px` (3rem) | 主要区块间距、页面顶部间距 |
| **3XL** | `64px` (4rem) | 超大区块间距、Hero 区域 |

**Tailwind 类名映射：**
- `gap-2` = 8px, `gap-3` = 12px, `gap-4` = 16px
- `gap-6` = 24px, `gap-8` = 32px, `gap-12` = 48px

### 容器与内边距

| 元素 | 内边距 | 说明 |
|------|--------|------|
| **页面容器** | `p-4 md:px-8 md:py-6` | 移动端 16px，桌面端水平 32px 垂直 24px |
| **卡片** | `p-6` (24px) | 标准卡片内边距 |
| **紧凑卡片** | `p-4` (16px) | 信息密集场景 |
| **表单字段** | `px-3 py-2` | 输入框内边距 |
| **按钮** | `px-4 py-2` (默认) | 标准按钮内边距 |
| **侧边栏** | `px-4 py-6` | 侧边栏内容区域 |

### 响应式断点

| 断点 | 宽度 | 用途 |
|------|------|------|
| **Mobile** | `< 768px` | 移动端手机 |
| **Tablet** | `768px - 1024px` | 平板设备 |
| **Desktop** | `≥ 1024px` | 桌面端 |

**使用示例：**
```tsx
<div className="p-4 md:px-8 md:py-6">
  {/* 移动端 16px，桌面端 32px/24px */}
</div>
```

### 圆角系统 (Border Radius)

| Token | 值 | 用途 |
|-------|-----|------|
| **None** | `0` | 无圆角 |
| **SM** | `4px` (0.25rem) | 小元素、标签 |
| **MD** | `8px` (0.5rem) | 默认圆角、按钮、输入框 |
| **LG** | `12px` (0.75rem) | 卡片、对话框 |
| **XL** | `16px` (1rem) | 大卡片、模态框 |
| **Full** | `50%` | 圆形头像、徽章 |

**CSS 变量：**
- `--radius-sm`: `calc(var(--radius) - 4px)`
- `--radius-md`: `calc(var(--radius) - 2px)`
- `--radius-lg`: `var(--radius)` (默认 10px)
- `--radius-xl`: `calc(var(--radius) + 4px)`

---

## 🖋 字体系统

### 字体族

- **Sans Serif**: `var(--font-geist-sans)` (Geist Sans)
- **Monospace**: `var(--font-geist-mono)` (Geist Mono，用于代码、数据)

### 字体大小

| 类型 | 大小 | 字重 | 行高 | 用途 |
|------|------|------|------|------|
| **Hero Title** | `32px` (2rem) | `700` | `1.2` | 页面主标题 |
| **Page Title** | `24px` (1.5rem) | `700` | `1.3` | 页面标题 |
| **Section Title** | `20px` (1.25rem) | `600` | `1.4` | 区块标题 |
| **Card Title** | `18px` (1.125rem) | `600` | `1.4` | 卡片标题 |
| **Body Large** | `16px` (1rem) | `400` | `1.5` | 正文大号 |
| **Body** | `14px` (0.875rem) | `400` | `1.5` | 正文默认 |
| **Body Small** | `13px` | `400` | `1.4` | 正文小号 |
| **Caption** | `12px` (0.75rem) | `400` | `1.4` | 说明文字、标签 |
| **Label** | `14px` (0.875rem) | `500` | `1.4` | 表单标签 |

**Tailwind 类名：**
- `text-3xl` (30px), `text-2xl` (24px), `text-xl` (20px)
- `text-lg` (18px), `text-base` (16px), `text-sm` (14px), `text-xs` (12px)

### 字重

| 字重 | 值 | 用途 |
|------|-----|------|
| **Regular** | `400` | 正文、默认文字 |
| **Medium** | `500` | 标签、次要标题 |
| **Semibold** | `600` | 卡片标题、按钮文字 |
| **Bold** | `700` | 页面标题、强调文字 |

### 字间距

- **大标题**: `-0.02em` (更紧凑)
- **正文**: `0` (默认)
- **小字**: `0.01em` (略宽松，提升可读性)

---

## 🧩 组件规范

### 组件库使用原则

**优先使用 shadcn/ui 组件：**
```tsx
import { 
  Button, 
  Card, 
  Table, 
  Dialog, 
  Form, 
  Input, 
  Select,
  Badge,
  Tabs,
  Sheet,
  DropdownMenu
} from "@/components/ui"
```

**如果 shadcn/ui 没有所需组件：**
1. 先提示安装最新版 shadcn/ui 组件
2. 确实没有或特殊需求时，使用 Tailwind 创建自定义组件
3. 自定义组件按功能模块放在对应文件夹：
   - 技师相关：`/components/girls/`
   - 用户相关：`/components/users/`
   - 服务相关：`/components/services/`
   - 媒体相关：`/components/media/`

### 按钮 (Button)

**变体：**
- `default`: 主要操作（提交、确认）
- `secondary`: 次要操作
- `outline`: 边框按钮（取消、返回）
- `ghost`: 幽灵按钮（图标按钮、菜单项）
- `destructive`: 危险操作（删除、禁用）
- `link`: 链接样式

**尺寸：**
- `sm`: `h-8` (32px)
- `default`: `h-9` (36px)
- `lg`: `h-10` (40px)
- `icon`: `size-9` (36×36px)

**使用示例：**
```tsx
<Button variant="default" size="default">
  确认操作
</Button>
<Button variant="outline" size="sm">
  取消
</Button>
<Button variant="destructive">
  删除
</Button>
```

### 卡片 (Card)

**结构：**
```tsx
<Card>
  <CardHeader>
    <CardTitle>标题</CardTitle>
    <CardDescription>描述</CardDescription>
  </CardHeader>
  <CardContent>
    {/* 内容 */}
  </CardContent>
  <CardFooter>
    {/* 操作按钮 */}
  </CardFooter>
</Card>
```

**样式：**
- 背景：`bg-card`
- 边框：`border border-border`
- 圆角：`rounded-lg` (12px)
- 阴影：`shadow-sm` (浅阴影)
- 内边距：`p-6` (24px)

### 表格 (Table)

**响应式处理：**
- 移动端：使用卡片布局或横向滚动
- 桌面端：标准表格布局

**样式：**
```tsx
<div className="rounded-md border">
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>列名</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow>
        <TableCell>数据</TableCell>
      </TableRow>
    </TableBody>
  </Table>
</div>
```

**移动端适配：**
```tsx
<div className="overflow-x-auto">
  <Table>
    {/* 表格内容 */}
  </Table>
</div>
```

### 对话框 (Dialog)

**使用场景：**
- 表单编辑
- 确认操作
- 详细信息展示

**尺寸：**
- 默认：`max-w-lg` (512px)
- 大尺寸：`max-w-2xl` (672px)
- 全屏（移动端）：`max-w-full`

**示例：**
```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="max-w-lg">
    <DialogHeader>
      <DialogTitle>标题</DialogTitle>
    </DialogHeader>
    {/* 内容 */}
  </DialogContent>
</Dialog>
```

### 表单 (Form)

**使用 React Hook Form + Zod：**
```tsx
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

const formSchema = z.object({
  name: z.string().min(1, "名称不能为空"),
})

const form = useForm<z.infer<typeof formSchema>>({
  resolver: zodResolver(formSchema),
})
```

**表单字段：**
```tsx
<FormField
  control={form.control}
  name="name"
  render={({ field }) => (
    <FormItem>
      <FormLabel>名称</FormLabel>
      <FormControl>
        <Input {...field} />
      </FormControl>
      <FormDescription>请输入名称</FormDescription>
      <FormMessage />
    </FormItem>
  )}
/>
```

### 徽章 (Badge)

**变体：**
- `default`: 默认样式
- `secondary`: 次要信息
- `destructive`: 错误/危险
- `outline`: 边框样式

**使用示例：**
```tsx
<Badge variant="default">已审核</Badge>
<Badge variant="secondary">待处理</Badge>
<Badge variant="destructive">已禁用</Badge>
```

### 标签页 (Tabs)

**使用场景：**
- 内容分类展示
- 多步骤表单
- 数据筛选

**示例：**
```tsx
<Tabs defaultValue="all">
  <TabsList>
    <TabsTrigger value="all">全部</TabsTrigger>
    <TabsTrigger value="pending">待审核</TabsTrigger>
  </TabsList>
  <TabsContent value="all">
    {/* 内容 */}
  </TabsContent>
</Tabs>
```

### 侧边抽屉 (Sheet)

**使用场景：**
- 移动端菜单
- 详情面板
- 筛选面板

**方向：**
- `left`: 左侧滑出
- `right`: 右侧滑出（默认）
- `top`: 顶部滑出
- `bottom`: 底部滑出

**示例：**
```tsx
<Sheet open={open} onOpenChange={setOpen}>
  <SheetContent side="right">
    <SheetHeader>
      <SheetTitle>标题</SheetTitle>
    </SheetHeader>
    {/* 内容 */}
  </SheetContent>
</Sheet>
```

---

## 🌊 阴影与深度

### 阴影层级

| 层级 | 用途 | Tailwind 类 | CSS |
|------|------|-------------|-----|
| **None** | 无阴影 | `shadow-none` | `none` |
| **XS** | 轻微悬浮 | `shadow-xs` | `0 1px 2px rgba(0,0,0,0.05)` |
| **SM** | 卡片、按钮 | `shadow-sm` | `0 1px 3px rgba(0,0,0,0.1)` |
| **MD** | 对话框、下拉菜单 | `shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` |
| **LG** | 模态框、浮动元素 | `shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` |
| **XL** | 大型浮动元素 | `shadow-xl` | `0 20px 25px rgba(0,0,0,0.1)` |

**暗黑模式调整：**
- 降低阴影不透明度
- 使用更柔和的阴影效果

---

## ✨ 动画与交互

### 过渡时间

| 类型 | 时间 | 缓动函数 | 用途 |
|------|------|----------|------|
| **Fast** | `150ms` | `ease-out` | 按钮点击、切换状态 |
| **Normal** | `200ms` | `ease-in-out` | 悬停效果、颜色变化 |
| **Slow** | `300ms` | `ease-in-out` | 页面过渡、模态框 |
| **Complex** | `400-500ms` | `cubic-bezier(0.4, 0, 0.2, 1)` | 复杂动画 |

### 交互反馈

**按钮点击：**
- 缩放：`scale(0.98)` (2% 缩小)
- 过渡：`transition-transform duration-150`

**悬停效果：**
- 背景色变化：`hover:bg-accent`
- 文字颜色变化：`hover:text-accent-foreground`
- 过渡：`transition-colors duration-200`

**焦点状态：**
- 焦点环：`focus-visible:ring-2 focus-visible:ring-ring`
- 轮廓：`focus-visible:outline-none`

**禁用状态：**
- 透明度：`opacity-50`
- 指针：`pointer-events-none`
- 光标：`cursor-not-allowed`

### 加载状态

**使用 Loading 组件：**
```tsx
import { LoadingSpinner } from "@/components/ui/loading"

{loading && <LoadingSpinner />}
```

**骨架屏：**
```tsx
import { Skeleton } from "@/components/ui/skeleton"

<Skeleton className="h-4 w-full" />
```

---

## 📱 响应式设计

### 移动端优先策略

1. **布局适配：**
   - 使用 Flexbox/Grid 自动适配
   - 移动端单列，桌面端多列

2. **导航适配：**
   - 移动端：侧边栏收起为图标模式
   - 使用 Sheet 组件作为移动端菜单

3. **表格适配：**
   - 移动端：卡片布局或横向滚动
   - 桌面端：标准表格

4. **表单适配：**
   - 移动端：全宽输入框
   - 桌面端：限制最大宽度

### 断点使用

```tsx
// 移动端隐藏，桌面端显示
<div className="hidden md:block">桌面内容</div>

// 移动端显示，桌面端隐藏
<div className="block md:hidden">移动内容</div>

// 响应式间距
<div className="p-4 md:px-8 md:py-6">内容</div>

// 响应式字体
<h1 className="text-2xl md:text-3xl">标题</h1>
```

### 触摸目标

- **最小尺寸：** `44×44px` (iOS HIG 标准)
- **按钮间距：** 至少 `8px`
- **表单字段高度：** 至少 `40px`

---

## 🎯 页面布局规范

### 标准页面结构

```tsx
<div className="flex flex-col gap-6">
  {/* 页面标题区域 */}
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-2xl font-bold">页面标题</h1>
      <p className="text-sm text-muted-foreground mt-1">页面描述</p>
    </div>
    <Button>操作按钮</Button>
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

### 列表页面模式

1. **顶部操作栏：**
   - 搜索框
   - 筛选器
   - 新增按钮

2. **数据展示：**
   - 表格（桌面端）
   - 卡片列表（移动端）

3. **分页：**
   - 底部分页器
   - 显示总数和当前页信息

### 详情页面模式

1. **面包屑导航：**
   - 显示当前位置
   - 支持快速返回

2. **详情卡片：**
   - 分组展示信息
   - 使用 Tabs 组织复杂内容

3. **操作按钮：**
   - 固定在顶部或底部
   - 危险操作使用 destructive 变体

---

## 🔔 反馈与提示

### Toast 通知

**使用 Sonner：**
```tsx
import { toast } from "sonner"

// 成功
toast.success("操作成功")

// 错误
toast.error("操作失败")

// 信息
toast.info("提示信息")

// 警告
toast.warning("警告信息")
```

**位置：** 默认右上角，移动端自动调整

### 确认对话框

**危险操作必须确认：**
```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">删除</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>确认删除</AlertDialogTitle>
      <AlertDialogDescription>
        此操作不可恢复，确定要删除吗？
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>取消</AlertDialogCancel>
      <AlertDialogAction onClick={handleDelete}>确认</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## ♿ 无障碍访问

### ARIA 标签

- 按钮：`aria-label` 描述操作
- 表单：`aria-describedby` 关联错误信息
- 对话框：`aria-labelledby` 关联标题

### 键盘导航

- Tab 键：顺序导航
- Enter/Space：激活按钮
- Esc：关闭对话框/下拉菜单
- 箭头键：列表导航

### 对比度

- 文字与背景：≥ 4.5:1 (AA 标准)
- 大文字：≥ 3:1
- 交互元素：清晰的焦点指示器

---

## 🎨 主题切换

### 实现方式

使用 `next-themes` 实现主题切换：

```tsx
import { useTheme } from "next-themes"

const { theme, setTheme } = useTheme()

// 切换主题
setTheme(theme === "dark" ? "light" : "dark")
```

### 主题切换按钮

建议在顶部导航栏添加主题切换按钮，使用 `Moon`/`Sun` 图标。

---

## 📋 代码规范

### 组件命名

- 组件文件：PascalCase，如 `GirlTable.tsx`
- 组件函数：PascalCase，如 `export function GirlTable()`
- 自定义 Hook：`use` 前缀，如 `useIsMobile`

### 文件组织

```
components/
  ├── ui/              # shadcn/ui 组件
  ├── girls/           # 技师相关组件
  ├── users/           # 用户相关组件
  ├── services/        # 服务相关组件
  └── media/           # 媒体相关组件
```

### 类型定义

- 类型文件：`lib/types/*.ts`
- 验证模式：`lib/validations/*.ts`
- 使用 TypeScript 严格模式

### 样式类名

- 优先使用 Tailwind 工具类
- 复杂样式使用 `cn()` 合并类名
- 避免内联样式

---

## ✅ 检查清单

开发新页面时，确保：

- [ ] 使用 shadcn/ui 组件
- [ ] 支持暗黑/明亮模式
- [ ] 响应式设计（移动端适配）
- [ ] 加载状态处理
- [ ] 错误状态处理
- [ ] 空状态展示
- [ ] 无障碍标签（ARIA）
- [ ] 键盘导航支持
- [ ] Toast 反馈提示
- [ ] 表单验证（Zod）
- [ ] 类型安全（TypeScript）

---

## 📚 参考资源

- [shadcn/ui 文档](https://ui.shadcn.com)
- [Tailwind CSS 文档](https://tailwindcss.com)
- [Next.js 15 文档](https://nextjs.org/docs)
- [React Hook Form](https://react-hook-form.com)
- [Zod 文档](https://zod.dev)
- [WCAG 2.1 指南](https://www.w3.org/WAI/WCAG21/quickref/)

---

**版本：** 1.0  
**最后更新：** 2024  
**适用项目：** CBODY Ops 后台管理系统  
**技术栈：** Next.js 15 + shadcn/ui + Tailwind CSS + TypeScript