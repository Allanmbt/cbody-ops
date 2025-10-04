"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import {
    Dialog,
    DialogContent,
    DialogDescription,
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { LoadingSpinner } from "@/components/ui/loading"
import { X } from "lucide-react"
import { girlFormSchema, type GirlFormData } from "@/lib/validations/girl"
import { createGirl, updateGirl, getCities, getCategories } from "@/app/dashboard/girls/actions"
import type { GirlWithStatus } from "@/lib/types/girl"

interface GirlFormDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    girl?: GirlWithStatus | null
    onSuccess: () => void
}

export function GirlFormDialog({ open, onOpenChange, girl, onSuccess }: GirlFormDialogProps) {
    const [loading, setLoading] = useState(false)
    const [cities, setCities] = useState<any[]>([])
    const [categories, setCategories] = useState<any[]>([])
    const [selectedBadges, setSelectedBadges] = useState<string[]>([])

    const form = useForm<GirlFormData>({
        resolver: zodResolver(girlFormSchema) as any,
        defaultValues: {
            girl_number: 0,
            username: '',
            name: '',
            profile: { en: '', zh: '', th: '' },
            avatar_url: '',
            birth_date: '',
            height: undefined,
            weight: undefined,
            measurements: '',
            gender: 0,
            languages: {},
            tags: { en: '', zh: '', th: '' },
            badge: null,
            max_travel_distance: 10,
            work_hours: { start: '19:00', end: '10:00' },
            is_verified: false,
            is_blocked: false,
            is_visible_to_thai: true,
            sort_order: 999,
            city_id: undefined,
            category_id: undefined,
        }
    })

    // 加载城市和分类
    useEffect(() => {
        async function loadData() {
            const [citiesResult, categoriesResult] = await Promise.all([
                getCities(),
                getCategories()
            ])

            if (citiesResult.ok && citiesResult.data) {
                setCities(citiesResult.data)
            }

            if (categoriesResult.ok && categoriesResult.data) {
                setCategories(categoriesResult.data)
            }
        }

        if (open) {
            loadData()
        }
    }, [open])

    // 设置表单默认值
    useEffect(() => {
        if (girl && open) {
            form.reset({
                girl_number: girl.girl_number,
                username: girl.username,
                name: girl.name,
                profile: girl.profile,
                avatar_url: girl.avatar_url || '',
                birth_date: girl.birth_date || '',
                height: girl.height,
                weight: girl.weight,
                measurements: girl.measurements || '',
                gender: girl.gender,
                languages: girl.languages || {},
                tags: girl.tags,
                badge: girl.badge,
                max_travel_distance: girl.max_travel_distance,
                work_hours: girl.work_hours,
                is_verified: girl.is_verified,
                is_blocked: girl.is_blocked,
                is_visible_to_thai: girl.is_visible_to_thai,
                sort_order: girl.sort_order,
                city_id: girl.city_id,
                category_id: girl.category_id,
            })
            setSelectedBadges(girl.badge ? [girl.badge] : [])
        } else if (!girl && open) {
            form.reset({
                girl_number: 0,
                username: '',
                name: '',
                profile: { en: '', zh: '', th: '' },
                avatar_url: '',
                birth_date: '',
                height: undefined,
                weight: undefined,
                measurements: '',
                gender: 0,
                languages: {},
                tags: { en: '', zh: '', th: '' },
                badge: null,
                max_travel_distance: 10,
                work_hours: { start: '19:00', end: '10:00' },
                is_verified: false,
                is_blocked: false,
                is_visible_to_thai: true,
                sort_order: 999,
                city_id: undefined,
                category_id: undefined,
            })
            setSelectedBadges([])
        }
    }, [girl, open, form])

    const onSubmit = async (data: GirlFormData) => {
        try {
            setLoading(true)

            const result = girl
                ? await updateGirl(girl.id, data)
                : await createGirl(data)

            if (result.ok) {
                toast.success(girl ? "技师更新成功" : "技师创建成功")
                onSuccess()
                onOpenChange(false)
            } else {
                toast.error(result.error || "操作失败")
            }
        } catch (error) {
            console.error('提交表单失败:', error)
            toast.error("操作失败，请重试")
        } finally {
            setLoading(false)
        }
    }

    const badgeOptions = [
        { value: 'new', label: '新人', color: 'bg-blue-100 text-blue-800' },
        { value: 'hot', label: '热门', color: 'bg-red-100 text-red-800' },
        { value: 'top_rated', label: '优质', color: 'bg-purple-100 text-purple-800' },
    ]

    const toggleBadge = (badgeValue: string) => {
        const currentBadge = form.getValues('badge')
        if (currentBadge === badgeValue) {
            form.setValue('badge', null)
            setSelectedBadges([])
        } else {
            form.setValue('badge', badgeValue as any)
            setSelectedBadges([badgeValue])
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl mx-4 sm:mx-auto max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-lg sm:text-xl">
                        {girl ? '编辑技师' : '新建技师'}
                    </DialogTitle>
                    <DialogDescription className="text-sm">
                        {girl ? '修改技师的基本信息和设置' : '添加新的技师到系统'}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
                        {/* 基本信息 */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-medium text-muted-foreground">基本信息</h3>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                                <FormField
                                    control={form.control}
                                    name="girl_number"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>工号 *</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="001"
                                                    {...field}
                                                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                                    disabled={loading}
                                                />
                                            </FormControl>
                                            <FormDescription>
                                                唯一标识符，用于搜索和识别
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="username"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>用户名 *</FormLabel>
                                            <FormControl>
                                                <Input placeholder="lisa123" {...field} disabled={loading} />
                                            </FormControl>
                                            <FormDescription className="text-transparent">占位文本保持对齐</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>显示昵称 *</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Lisa" {...field} disabled={loading} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="gender"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>性别 *</FormLabel>
                                            <Select
                                                value={field.value?.toString() || '0'}
                                                onValueChange={(value) => field.onChange(parseInt(value) as 0 | 1)}
                                                disabled={loading}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="选择性别" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="0">女</SelectItem>
                                                    <SelectItem value="1">男</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="city_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>城市</FormLabel>
                                            <Select
                                                value={field.value?.toString() || 'none'}
                                                onValueChange={(value) => field.onChange(value === 'none' ? undefined : parseInt(value))}
                                                disabled={loading}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="选择城市" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="none">不选择</SelectItem>
                                                    {cities.map((city) => (
                                                        <SelectItem key={city.id} value={city.id.toString()}>
                                                            {city.name.zh || city.name.en || city.name.th}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="category_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>分类</FormLabel>
                                            <Select
                                                value={field.value?.toString() || 'none'}
                                                onValueChange={(value) => field.onChange(value === 'none' ? undefined : parseInt(value))}
                                                disabled={loading}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="选择分类" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="none">不选择</SelectItem>
                                                    {categories.map((category) => (
                                                        <SelectItem key={category.id} value={category.id.toString()}>
                                                            {category.name.zh || category.name.en || category.name.th}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        {/* 多语言简介 */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-medium text-muted-foreground">个人简介</h3>
                            <Tabs defaultValue="zh" className="w-full">
                                <TabsList className="grid w-full grid-cols-3">
                                    <TabsTrigger value="zh">中文</TabsTrigger>
                                    <TabsTrigger value="en">English</TabsTrigger>
                                    <TabsTrigger value="th">ไทย</TabsTrigger>
                                </TabsList>

                                <TabsContent value="zh" className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="profile.zh"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>中文简介</FormLabel>
                                                <FormControl>
                                                    <Textarea
                                                        placeholder="请输入中文简介..."
                                                        className="min-h-[80px]"
                                                        {...field}
                                                        disabled={loading}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="tags.zh"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>中文标签</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder="温柔,专业,贴心"
                                                        {...field}
                                                        disabled={loading}
                                                    />
                                                </FormControl>
                                                <FormDescription>用逗号分隔多个标签</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </TabsContent>

                                <TabsContent value="en" className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="profile.en"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>English Profile</FormLabel>
                                                <FormControl>
                                                    <Textarea
                                                        placeholder="Enter English profile..."
                                                        className="min-h-[80px]"
                                                        {...field}
                                                        disabled={loading}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="tags.en"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>English Tags</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder="gentle,professional,caring"
                                                        {...field}
                                                        disabled={loading}
                                                    />
                                                </FormControl>
                                                <FormDescription>Separate multiple tags with commas</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </TabsContent>

                                <TabsContent value="th" className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="profile.th"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Thai Profile</FormLabel>
                                                <FormControl>
                                                    <Textarea
                                                        placeholder="ใส่โปรไฟล์ภาษาไทย..."
                                                        className="min-h-[80px]"
                                                        {...field}
                                                        disabled={loading}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="tags.th"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Thai Tags</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder="อ่อนโยน,มืออาชีพ,ใส่ใจ"
                                                        {...field}
                                                        disabled={loading}
                                                    />
                                                </FormControl>
                                                <FormDescription>แยกแท็กหลายๆ อันด้วยเครื่องหมายจุลภาค</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </TabsContent>
                            </Tabs>
                        </div>

                        {/* 物理信息 */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-medium text-muted-foreground">物理信息</h3>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <FormField
                                    control={form.control}
                                    name="birth_date"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>出生日期</FormLabel>
                                            <FormControl>
                                                <Input type="date" {...field} disabled={loading} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="height"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>身高 (cm)</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="165"
                                                    {...field}
                                                    onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                                                    disabled={loading}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="weight"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>体重 (kg)</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="50"
                                                    {...field}
                                                    onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                                                    disabled={loading}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="measurements"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>三围</FormLabel>
                                        <FormControl>
                                            <Input placeholder="90-60-90" {...field} disabled={loading} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* 工作设置 */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-medium text-muted-foreground">工作设置</h3>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="max_travel_distance"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>服务距离 (km) *</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="10"
                                                    {...field}
                                                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                                    disabled={loading}
                                                />
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
                                            <FormLabel>排序权重</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="999"
                                                    {...field}
                                                    onChange={(e) => field.onChange(parseInt(e.target.value) || 999)}
                                                    disabled={loading}
                                                />
                                            </FormControl>
                                            <FormDescription>数值越小排序越靠前</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* 徽章选择 */}
                            <FormField
                                control={form.control}
                                name="badge"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>徽章</FormLabel>
                                        <FormControl>
                                            <div className="flex flex-wrap gap-2">
                                                {badgeOptions.map((option) => (
                                                    <Badge
                                                        key={option.value}
                                                        variant={selectedBadges.includes(option.value) ? "default" : "outline"}
                                                        className={`cursor-pointer ${selectedBadges.includes(option.value) ? option.color : ''}`}
                                                        onClick={() => toggleBadge(option.value)}
                                                    >
                                                        {option.label}
                                                        {selectedBadges.includes(option.value) && (
                                                            <X className="ml-1 h-3 w-3" />
                                                        )}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </FormControl>
                                        <FormDescription>点击选择徽章，再次点击取消选择</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
                                取消
                            </Button>
                            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                                {loading && <LoadingSpinner size="sm" className="mr-2" />}
                                {girl ? '更新技师' : '创建技师'}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
