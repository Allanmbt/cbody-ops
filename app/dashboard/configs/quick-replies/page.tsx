"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, ChevronDown, ChevronUp, FolderOpen, MessageSquare, Pencil, Plus, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { getQuickRepliesConfig, updateQuickRepliesConfig } from "../actions"
import {
  quickReplyCategorySchema,
  quickReplyItemSchema,
  quickRepliesConfigSchema,
  type AppConfig,
  type QuickReplyCategory,
  type QuickReplyItem,
  type QuickRepliesConfig,
} from "@/lib/features/configs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { LoadingSpinner } from "@/components/ui/loading"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
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

type CategoryFormValues = z.infer<typeof quickReplyCategorySchema>
type ItemFormValues = z.infer<typeof quickReplyItemSchema>

const EMPTY_CONFIG: QuickRepliesConfig = {
  categories: [],
  items: [],
}

const EMPTY_LOCALIZED_TEXT = {
  en: "",
  zh: "",
  th: "",
}

function sortCategories(categories: QuickReplyCategory[]) {
  return [...categories].sort((a, b) => a.sort_order - b.sort_order || a.code.localeCompare(b.code))
}

function sortItems(items: QuickReplyItem[], categories: QuickReplyCategory[]) {
  const categoryOrderMap = new Map(
    sortCategories(categories).map((category, index) => [category.code, index])
  )

  return [...items].sort((a, b) => {
    const categoryCompare =
      (categoryOrderMap.get(a.category_code) ?? Number.MAX_SAFE_INTEGER) -
      (categoryOrderMap.get(b.category_code) ?? Number.MAX_SAFE_INTEGER)
    if (categoryCompare !== 0) return categoryCompare
    if (a.rank_weight !== b.rank_weight) return b.rank_weight - a.rank_weight
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return a.id.localeCompare(b.id)
  })
}

function normalizeConfig(config: QuickRepliesConfig): QuickRepliesConfig {
  const parsed = quickRepliesConfigSchema.safeParse(config)
  if (!parsed.success) {
    return EMPTY_CONFIG
  }

  return {
    categories: sortCategories(parsed.data.categories),
    items: sortItems(parsed.data.items, parsed.data.categories),
  }
}

function createDefaultCategory(): CategoryFormValues {
  return {
    code: "",
    label: { ...EMPTY_LOCALIZED_TEXT },
    sort_order: 999,
    is_active: true,
  }
}

function createDefaultItem(categoryCode?: string): ItemFormValues {
  return {
    id: "",
    category_code: categoryCode || "",
    text: { ...EMPTY_LOCALIZED_TEXT },
    sort_order: 999,
    rank_weight: 0,
    is_active: true,
  }
}

function CategoryDialog({
  open,
  mode,
  initialValue,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  mode: "create" | "edit"
  initialValue: QuickReplyCategory | null
  onOpenChange: (open: boolean) => void
  onSubmit: (values: CategoryFormValues) => void
}) {
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(quickReplyCategorySchema),
    defaultValues: createDefaultCategory(),
  })

  useEffect(() => {
    if (!open) return

    form.reset(initialValue ? { ...initialValue } : createDefaultCategory())
  }, [form, initialValue, open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "新增分类" : "编辑分类"}</DialogTitle>
          <DialogDescription>维护快捷回复分类标识、三语名称、排序和启用状态。</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => {
              onSubmit(values)
              onOpenChange(false)
            })}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>分类标识</FormLabel>
                    <FormControl>
                      <Input placeholder="例如：home_order" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sort_order"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>排序</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="1"
                        {...field}
                        value={field.value}
                        onChange={(event) => field.onChange(event.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="label.en"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>英文分类名</FormLabel>
                    <FormControl>
                      <Input placeholder="English label" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="label.zh"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>中文分类名</FormLabel>
                    <FormControl>
                      <Input placeholder="中文分类名" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="label.th"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>泰文分类名</FormLabel>
                    <FormControl>
                      <Input placeholder="ชื่อหมวดหมู่" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-1">
                    <FormLabel>启用分类</FormLabel>
                    <p className="text-sm text-muted-foreground">关闭后分类仍保留，但前端读取时可按状态过滤。</p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button type="submit">{mode === "create" ? "添加分类" : "保存分类"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function ItemDialog({
  open,
  mode,
  categories,
  initialValue,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  mode: "create" | "edit"
  categories: QuickReplyCategory[]
  initialValue: QuickReplyItem | null
  onOpenChange: (open: boolean) => void
  onSubmit: (values: ItemFormValues) => void
}) {
  const form = useForm<ItemFormValues>({
    resolver: zodResolver(quickReplyItemSchema),
    defaultValues: createDefaultItem(categories[0]?.code),
  })

  useEffect(() => {
    if (!open) return

    form.reset(
      initialValue
        ? { ...initialValue }
        : createDefaultItem(categories[0]?.code)
    )
  }, [categories, form, initialValue, open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "新增快捷回复" : "编辑快捷回复"}</DialogTitle>
          <DialogDescription>维护回复标识、所属分类、三语内容、排序和置顶权重。</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => {
              onSubmit(values)
              onOpenChange(false)
            })}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>回复标识</FormLabel>
                    <FormControl>
                      <Input placeholder="例如：home_on_the_way_001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>所属分类</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="请选择分类" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sortCategories(categories).map((category) => (
                          <SelectItem key={category.code} value={category.code}>
                            {category.label.zh || category.label.en || category.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="sort_order"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>同分类排序</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="1"
                        {...field}
                        value={field.value}
                        onChange={(event) => field.onChange(event.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rank_weight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>置顶权重</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="1"
                        {...field}
                        value={field.value}
                        onChange={(event) => field.onChange(event.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4">
              <FormField
                control={form.control}
                name="text.en"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>英文内容</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="English quick reply" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="text.zh"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>中文内容</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="中文快捷回复内容" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="text.th"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>泰文内容</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="ข้อความตอบกลับด่วน" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-1">
                    <FormLabel>启用快捷回复</FormLabel>
                    <p className="text-sm text-muted-foreground">关闭后仍保留在配置中，但可被前端过滤隐藏。</p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button type="submit">{mode === "create" ? "添加回复" : "保存回复"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default function QuickRepliesConfigPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [configId, setConfigId] = useState("")
  const [draftConfig, setDraftConfig] = useState<QuickRepliesConfig>(EMPTY_CONFIG)
  const [savedConfig, setSavedConfig] = useState<QuickRepliesConfig>(EMPTY_CONFIG)

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [categoryDialogMode, setCategoryDialogMode] = useState<"create" | "edit">("create")
  const [editingCategoryCode, setEditingCategoryCode] = useState<string | null>(null)

  const [itemDialogOpen, setItemDialogOpen] = useState(false)
  const [itemDialogMode, setItemDialogMode] = useState<"create" | "edit">("create")
  const [editingItemId, setEditingItemId] = useState<string | null>(null)

  const sortedCategories = sortCategories(draftConfig.categories)
  const sortedItems = sortItems(draftConfig.items, draftConfig.categories)
  const hasChanges = JSON.stringify(draftConfig) !== JSON.stringify(savedConfig)

  const editingCategory = editingCategoryCode
    ? draftConfig.categories.find((category) => category.code === editingCategoryCode) || null
    : null
  const editingItem = editingItemId
    ? draftConfig.items.find((item) => item.id === editingItemId) || null
    : null

  useEffect(() => {
    async function loadConfig() {
      try {
        const result = await getQuickRepliesConfig()
        if (!result.ok || !result.data) {
          toast.error(result.error || "获取快捷回复配置失败")
          return
        }

        const config = result.data as AppConfig
        setConfigId(config.id)

        const parsed = quickRepliesConfigSchema.safeParse(config.value_json ?? EMPTY_CONFIG)
        if (!parsed.success) {
          toast.error("快捷回复配置结构异常，已按空配置加载")
          setDraftConfig(EMPTY_CONFIG)
          setSavedConfig(EMPTY_CONFIG)
          return
        }

        const normalized = normalizeConfig(parsed.data)
        setDraftConfig(normalized)
        setSavedConfig(normalized)
      } catch (error) {
        console.error("[QuickReplies] 加载配置失败:", error)
        toast.error("加载快捷回复配置失败")
      } finally {
        setLoading(false)
      }
    }

    loadConfig()
  }, [])

  function updateDraft(nextConfig: QuickRepliesConfig) {
    setDraftConfig(normalizeConfig(nextConfig))
  }

  function handleCategorySubmit(values: CategoryFormValues) {
    const normalizedValues: QuickReplyCategory = {
      ...values,
      code: values.code.trim(),
    }

    if (
      draftConfig.categories.some(
        (category) =>
          category.code === normalizedValues.code &&
          category.code !== editingCategoryCode
      )
    ) {
      toast.error(`分类标识已存在：${normalizedValues.code}`)
      return
    }

    if (categoryDialogMode === "create") {
      updateDraft({
        ...draftConfig,
        categories: [...draftConfig.categories, normalizedValues],
      })
      toast.success("分类已添加到草稿")
      return
    }

    updateDraft({
      ...draftConfig,
      categories: draftConfig.categories.map((category) =>
        category.code === editingCategoryCode ? normalizedValues : category
      ),
      items: draftConfig.items.map((item) =>
        item.category_code === editingCategoryCode
          ? { ...item, category_code: normalizedValues.code }
          : item
      ),
    })
    toast.success("分类草稿已更新")
  }

  function handleItemSubmit(values: ItemFormValues) {
    const normalizedValues: QuickReplyItem = {
      ...values,
      id: values.id.trim(),
      category_code: values.category_code.trim(),
    }

    if (
      draftConfig.items.some(
        (item) => item.id === normalizedValues.id && item.id !== editingItemId
      )
    ) {
      toast.error(`快捷回复标识已存在：${normalizedValues.id}`)
      return
    }

    if (!draftConfig.categories.some((category) => category.code === normalizedValues.category_code)) {
      toast.error("所属分类不存在，请先创建分类")
      return
    }

    if (itemDialogMode === "create") {
      updateDraft({
        ...draftConfig,
        items: [...draftConfig.items, normalizedValues],
      })
      toast.success("快捷回复已添加到草稿")
      return
    }

    updateDraft({
      ...draftConfig,
      items: draftConfig.items.map((item) =>
        item.id === editingItemId ? normalizedValues : item
      ),
    })
    toast.success("快捷回复草稿已更新")
  }

  function handleDeleteCategory(code: string) {
    const linkedCount = draftConfig.items.filter((item) => item.category_code === code).length
    if (linkedCount > 0) {
      toast.error(`该分类下仍有 ${linkedCount} 条快捷回复，请先处理回复项`)
      return
    }

    if (!window.confirm(`确定删除分类 ${code} 吗？`)) {
      return
    }

    updateDraft({
      ...draftConfig,
      categories: draftConfig.categories.filter((category) => category.code !== code),
    })
    toast.success("分类已从草稿删除")
  }

  function handleDeleteItem(id: string) {
    if (!window.confirm(`确定删除快捷回复 ${id} 吗？`)) {
      return
    }

    updateDraft({
      ...draftConfig,
      items: draftConfig.items.filter((item) => item.id !== id),
    })
    toast.success("快捷回复已从草稿删除")
  }

  function moveCategory(code: string, direction: "up" | "down") {
    const ordered = sortCategories(draftConfig.categories)
    const index = ordered.findIndex((category) => category.code === code)
    const targetIndex = direction === "up" ? index - 1 : index + 1

    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) {
      return
    }

    const current = ordered[index]
    const target = ordered[targetIndex]

    updateDraft({
      ...draftConfig,
      categories: draftConfig.categories.map((category) => {
        if (category.code === current.code) {
          return { ...category, sort_order: target.sort_order }
        }
        if (category.code === target.code) {
          return { ...category, sort_order: current.sort_order }
        }
        return category
      }),
    })
  }

  function moveItem(id: string, direction: "up" | "down") {
    const item = draftConfig.items.find((entry) => entry.id === id)
    if (!item) return

    const siblings = [...draftConfig.items]
      .filter((entry) => entry.category_code === item.category_code)
      .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))

    const index = siblings.findIndex((entry) => entry.id === id)
    const targetIndex = direction === "up" ? index - 1 : index + 1

    if (index < 0 || targetIndex < 0 || targetIndex >= siblings.length) {
      return
    }

    const current = siblings[index]
    const target = siblings[targetIndex]

    updateDraft({
      ...draftConfig,
      items: draftConfig.items.map((entry) => {
        if (entry.id === current.id) {
          return { ...entry, sort_order: target.sort_order }
        }
        if (entry.id === target.id) {
          return { ...entry, sort_order: current.sort_order }
        }
        return entry
      }),
    })
  }

  async function handleSave() {
    if (!configId) {
      toast.error("配置ID不存在")
      return
    }

    const validation = quickRepliesConfigSchema.safeParse(draftConfig)
    if (!validation.success) {
      toast.error(validation.error.issues[0]?.message || "配置校验失败")
      return
    }

    setSaving(true)
    try {
      const result = await updateQuickRepliesConfig(configId, draftConfig)
      if (!result.ok) {
        toast.error(result.error || "保存配置失败")
        return
      }

      const normalized = normalizeConfig(validation.data)
      setDraftConfig(normalized)
      setSavedConfig(normalized)
      toast.success("快捷回复配置已保存")
    } catch (error) {
      console.error("[QuickReplies] 保存失败:", error)
      toast.error("保存快捷回复配置失败")
    } finally {
      setSaving(false)
    }
  }

  function handleResetDraft() {
    setDraftConfig(savedConfig)
    toast.info("已恢复到上次保存的配置")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Link href="/dashboard/configs">
            <Button variant="ghost" size="sm" className="mb-2 gap-2">
              <ArrowLeft className="size-4" />
              返回配置管理
            </Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">快捷回复配置</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            统一维护聊天快捷回复配置 JSON，分类和回复都只在本地草稿中编辑，最终整份保存回 `app_configs.value_json`。
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleResetDraft} disabled={!hasChanges || saving}>
            还原草稿
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || saving}>
            {saving ? <LoadingSpinner className="mr-2 size-4" /> : <Save className="mr-2 size-4" />}
            保存配置
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">分类数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{draftConfig.categories.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">快捷回复数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{draftConfig.items.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">草稿状态</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={hasChanges ? "secondary" : "outline"}>
              {hasChanges ? "有未保存变更" : "已与数据库同步"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="size-5" />
              分类配置
            </CardTitle>
            <CardDescription>支持三语分类名、启停和排序。</CardDescription>
          </div>
          <Button
            onClick={() => {
              setEditingCategoryCode(null)
              setCategoryDialogMode("create")
              setCategoryDialogOpen(true)
            }}
          >
            <Plus className="mr-2 size-4" />
            新增分类
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {sortedCategories.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              还没有分类，先创建分类再配置快捷回复。
            </div>
          ) : (
            sortedCategories.map((category, index) => {
              const itemCount = draftConfig.items.filter((item) => item.category_code === category.code).length
              return (
                <div key={category.code} className="rounded-lg border p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{category.label.zh || category.label.en || category.code}</span>
                        <Badge variant="outline">{category.code}</Badge>
                        <Badge variant={category.is_active ? "default" : "secondary"}>
                          {category.is_active ? "启用" : "停用"}
                        </Badge>
                        <Badge variant="outline">排序 {category.sort_order}</Badge>
                        <Badge variant="outline">{itemCount} 条回复</Badge>
                      </div>
                      <div className="grid gap-1 text-sm text-muted-foreground md:grid-cols-3">
                        <p>EN: {category.label.en || "-"}</p>
                        <p>ZH: {category.label.zh || "-"}</p>
                        <p>TH: {category.label.th || "-"}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => moveCategory(category.code, "up")}
                        disabled={index === 0}
                        aria-label={`上移分类 ${category.code}`}
                      >
                        <ChevronUp className="size-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => moveCategory(category.code, "down")}
                        disabled={index === sortedCategories.length - 1}
                        aria-label={`下移分类 ${category.code}`}
                      >
                        <ChevronDown className="size-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          updateDraft({
                            ...draftConfig,
                            categories: draftConfig.categories.map((entry) =>
                              entry.code === category.code
                                ? { ...entry, is_active: !entry.is_active }
                                : entry
                            ),
                          })
                        }}
                      >
                        {category.is_active ? "停用" : "启用"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingCategoryCode(category.code)
                          setCategoryDialogMode("edit")
                          setCategoryDialogOpen(true)
                        }}
                      >
                        <Pencil className="mr-2 size-4" />
                        编辑
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteCategory(category.code)}>
                        <Trash2 className="mr-2 size-4" />
                        删除
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="size-5" />
              快捷回复配置
            </CardTitle>
            <CardDescription>按分类维护三语回复内容、排序和置顶权重。</CardDescription>
          </div>
          <Button
            onClick={() => {
              if (draftConfig.categories.length === 0) {
                toast.error("请先创建分类")
                return
              }
              setEditingItemId(null)
              setItemDialogMode("create")
              setItemDialogOpen(true)
            }}
          >
            <Plus className="mr-2 size-4" />
            新增回复
          </Button>
        </CardHeader>
        <CardContent>
          {sortedItems.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              还没有快捷回复，可以先新增回复项。
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>回复标识</TableHead>
                    <TableHead>所属分类</TableHead>
                    <TableHead>排序</TableHead>
                    <TableHead>置顶权重</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="min-w-[360px]">内容预览</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedItems.map((item) => {
                    const siblings = [...draftConfig.items]
                      .filter((entry) => entry.category_code === item.category_code)
                      .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))
                    const siblingIndex = siblings.findIndex((entry) => entry.id === item.id)
                    const category = draftConfig.categories.find((entry) => entry.code === item.category_code)

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.id}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span>{category?.label.zh || category?.label.en || item.category_code}</span>
                            <span className="text-xs text-muted-foreground">{item.category_code}</span>
                          </div>
                        </TableCell>
                        <TableCell>{item.sort_order}</TableCell>
                        <TableCell>{item.rank_weight}</TableCell>
                        <TableCell>
                          <Badge variant={item.is_active ? "default" : "secondary"}>
                            {item.is_active ? "启用" : "停用"}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="space-y-1 whitespace-normal text-sm">
                            <p><span className="font-medium">EN:</span> {item.text.en || "-"}</p>
                            <p><span className="font-medium">ZH:</span> {item.text.zh || "-"}</p>
                            <p><span className="font-medium">TH:</span> {item.text.th || "-"}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => moveItem(item.id, "up")}
                              disabled={siblingIndex === 0}
                              aria-label={`上移回复 ${item.id}`}
                            >
                              <ChevronUp className="size-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => moveItem(item.id, "down")}
                              disabled={siblingIndex === siblings.length - 1}
                              aria-label={`下移回复 ${item.id}`}
                            >
                              <ChevronDown className="size-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                updateDraft({
                                  ...draftConfig,
                                  items: draftConfig.items.map((entry) =>
                                    entry.id === item.id
                                      ? { ...entry, is_active: !entry.is_active }
                                      : entry
                                  ),
                                })
                              }}
                            >
                              {item.is_active ? "停用" : "启用"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingItemId(item.id)
                                setItemDialogMode("edit")
                                setItemDialogOpen(true)
                              }}
                            >
                              <Pencil className="mr-2 size-4" />
                              编辑
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => handleDeleteItem(item.id)}>
                              <Trash2 className="mr-2 size-4" />
                              删除
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="py-6 text-sm text-muted-foreground">
          保存前只会改本地草稿，不会立即写库。最终点击页面顶部“保存配置”后，整份 JSON 才会写回 `chat.quick_replies` 配置。
        </CardContent>
      </Card>

      <CategoryDialog
        open={categoryDialogOpen}
        mode={categoryDialogMode}
        initialValue={editingCategory}
        onOpenChange={setCategoryDialogOpen}
        onSubmit={handleCategorySubmit}
      />

      <ItemDialog
        open={itemDialogOpen}
        mode={itemDialogMode}
        categories={sortedCategories}
        initialValue={editingItem}
        onOpenChange={setItemDialogOpen}
        onSubmit={handleItemSubmit}
      />
    </div>
  )
}
