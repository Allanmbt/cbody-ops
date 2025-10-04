"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ButtonLoading } from "@/components/ui/loading"
import { toast } from "sonner"
import { serviceFormSchema, type ServiceFormData } from "@/lib/validations/service"
import type { Service, Category, ServiceBadge } from "@/lib/types/service"
import { createService, updateService, getCategories } from "@/app/dashboard/services/actions"

interface ServiceFormDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    service?: Service | null
    onSuccess: () => void
}

const badgeOptions: { value: ServiceBadge; label: string; color: string }[] = [
    { value: 'HOT', label: '热门', color: 'destructive' },
    { value: 'NEW', label: '新品', color: 'default' },
    { value: 'TOP_PICK', label: '精选', color: 'secondary' },
]

export function ServiceFormDialog({
    open,
    onOpenChange,
    service,
    onSuccess
}: ServiceFormDialogProps) {
    const [loading, setLoading] = useState(false)
    const [categories, setCategories] = useState<Category[]>([])
    const [selectedBadges, setSelectedBadges] = useState<ServiceBadge[]>([])

    const isEdit = !!service

    const form = useForm<ServiceFormData>({
        resolver: zodResolver(serviceFormSchema) as any,
        defaultValues: {
            code: '',
            category_id: 1, // 默认选择第一个分类
            title: { en: '', zh: '', th: '' },
            description: { en: '', zh: '', th: '' },
            badge: null,
            is_active: true,
            is_visible_to_thai: true,
            is_visible_to_english: true,
            min_user_level: 0,
            sort_order: 999,
        }
    })

    // 加载分类列表
    useEffect(() => {
        async function loadCategories() {
            const result = await getCategories()
            if (result.ok && result.data) {
                setCategories(result.data)
                // 找到 wellness 分类并设为默认值
                const wellnessCategory = result.data.find(cat => cat.code === 'wellness')
                if (wellnessCategory && !service) {
                    form.setValue('category_id', wellnessCategory.id)
                }
            }
        }
        if (open) {
            loadCategories()
        }
    }, [open, service, form])

    // 设置表单默认值
    useEffect(() => {
        if (service && open) {
            form.reset({
                code: service.code,
                category_id: service.category_id,
                title: service.title,
                description: service.description,
                badge: service.badge,
                is_active: service.is_active,
                is_visible_to_thai: service.is_visible_to_thai,
                is_visible_to_english: service.is_visible_to_english,
                min_user_level: service.min_user_level,
                sort_order: service.sort_order,
            })
            setSelectedBadges(service.badge ? [service.badge] : [])
        } else if (!service && open && categories.length > 0) {
            // 找到 wellness 分类作为默认值
            const wellnessCategory = categories.find(cat => cat.code === 'wellness')
            const defaultCategoryId = wellnessCategory ? wellnessCategory.id : categories[0]?.id || 1

            form.reset({
                code: '',
                category_id: defaultCategoryId,
                title: { en: '', zh: '', th: '' },
                description: { en: '', zh: '', th: '' },
                badge: null,
                is_active: true,
                is_visible_to_thai: true,
                is_visible_to_english: true,
                min_user_level: 0,
                sort_order: 999,
            })
            setSelectedBadges([])
        }
    }, [service, open, form])

    const handleBadgeToggle = (badge: ServiceBadge) => {
        if (selectedBadges.includes(badge)) {
            setSelectedBadges([])
            form.setValue('badge', null)
        } else {
            setSelectedBadges([badge])
            form.setValue('badge', badge)
        }
    }

    const onSubmit = async (data: ServiceFormData) => {
        setLoading(true)
        try {
            const result = isEdit && service
                ? await updateService(service.id, data)
                : await createService(data)

            if (result.ok) {
                toast.success(isEdit ? '服务更新成功' : '服务创建成功')
                onOpenChange(false)
                onSuccess()
            } else {
                toast.error(result.error || '操作失败')
            }
        } catch (error) {
            console.error('提交表单失败:', error)
            toast.error('操作失败，请重试')
        } finally {
            setLoading(false)
        }
    }

    const handleClose = () => {
        if (!loading) {
            onOpenChange(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {isEdit ? '编辑服务' : '新建服务'}
                    </DialogTitle>
                    <DialogDescription>
                        {isEdit ? '修改服务信息' : '创建新的服务项目'}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4 items-start">
                            <FormField
                                control={form.control}
                                name="code"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>服务代码 *</FormLabel>
                                        <FormControl>
                                            <Input placeholder="thai_massage" {...field} disabled={loading} />
                                        </FormControl>
                                        <FormDescription>
                                            唯一标识符，只能包含字母、数字、下划线和连字符
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="category_id"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>分类 *</FormLabel>
                                        <Select
                                            value={field.value?.toString() || ''}
                                            onValueChange={(value) => field.onChange(parseInt(value))}
                                            disabled={loading}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="选择分类" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {categories.map((category) => (
                                                    <SelectItem key={category.id} value={category.id.toString()}>
                                                        {category.name.zh || category.name.en || category.name.th || category.code}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormDescription className="text-transparent">占位文本保持对齐</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div>
                            <FormLabel>徽章标识</FormLabel>
                            <div className="flex gap-2 mt-2">
                                {badgeOptions.map((option) => (
                                    <Badge
                                        key={option.value}
                                        variant={selectedBadges.includes(option.value) ? option.color as any : 'outline'}
                                        className="cursor-pointer"
                                        onClick={() => handleBadgeToggle(option.value)}
                                    >
                                        {option.label}
                                    </Badge>
                                ))}
                                {selectedBadges.length > 0 && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setSelectedBadges([])
                                            form.setValue('badge', null)
                                        }}
                                        disabled={loading}
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                )}
                            </div>
                        </div>

                        <Tabs defaultValue="zh" className="w-full">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="zh">中文</TabsTrigger>
                                <TabsTrigger value="en">English</TabsTrigger>
                                <TabsTrigger value="th">ไทย</TabsTrigger>
                            </TabsList>

                            <TabsContent value="zh" className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="title.zh"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>中文标题</FormLabel>
                                            <FormControl>
                                                <Input placeholder="泰式按摩" {...field} disabled={loading} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="description.zh"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>中文描述</FormLabel>
                                            <FormControl>
                                                <Input placeholder="正宗泰式按摩服务" {...field} disabled={loading} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </TabsContent>

                            <TabsContent value="en" className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="title.en"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>English Title</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Thai Massage" {...field} disabled={loading} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="description.en"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>English Description</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Authentic Thai massage service" {...field} disabled={loading} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </TabsContent>

                            <TabsContent value="th" className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="title.th"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Thai Title</FormLabel>
                                            <FormControl>
                                                <Input placeholder="นวดแผนไทย" {...field} disabled={loading} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="description.th"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Thai Description</FormLabel>
                                            <FormControl>
                                                <Input placeholder="บริการนวดแผนไทยแท้" {...field} disabled={loading} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </TabsContent>
                        </Tabs>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="min_user_level"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>最低用户等级</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={10}
                                                {...field}
                                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                                disabled={loading}
                                            />
                                        </FormControl>
                                        <FormDescription>0-10，0表示所有用户可见</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="sort_order"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>排序权重</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={9999}
                                                {...field}
                                                onChange={(e) => field.onChange(parseInt(e.target.value) || 999)}
                                                disabled={loading}
                                            />
                                        </FormControl>
                                        <FormDescription>数值越小越靠前</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="space-y-3">
                            <FormField
                                control={form.control}
                                name="is_active"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                                disabled={loading}
                                            />
                                        </FormControl>
                                        <div className="space-y-1 leading-none">
                                            <FormLabel>启用服务</FormLabel>
                                            <FormDescription>
                                                启用后用户可以看到并预订此服务
                                            </FormDescription>
                                        </div>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="is_visible_to_thai"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                                disabled={loading}
                                            />
                                        </FormControl>
                                        <div className="space-y-1 leading-none">
                                            <FormLabel>泰文用户可见</FormLabel>
                                            <FormDescription>
                                                使用泰文的用户可以看到此服务
                                            </FormDescription>
                                        </div>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="is_visible_to_english"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                                disabled={loading}
                                            />
                                        </FormControl>
                                        <div className="space-y-1 leading-none">
                                            <FormLabel>英文用户可见</FormLabel>
                                            <FormDescription>
                                                使用英文的用户可以看到此服务
                                            </FormDescription>
                                        </div>
                                    </FormItem>
                                )}
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                                取消
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? (
                                    <div className="flex items-center gap-2">
                                        <ButtonLoading />
                                        <span>{isEdit ? '更新中...' : '创建中...'}</span>
                                    </div>
                                ) : (
                                    isEdit ? '更新服务' : '创建服务'
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
