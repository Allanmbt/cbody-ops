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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { LoadingSpinner } from "@/components/ui/loading"
import { X, Upload, Search, Loader2, XCircle } from "lucide-react"
import { girlFormSchema, type GirlFormData } from "@/lib/validations/girl"
import { 
    createGirl, 
    updateGirl, 
    getCities, 
    getCategories,
    searchUsers,
    checkUsernameExists 
} from "@/app/dashboard/girls/actions"
import type { GirlWithStatus, UserSearchResult } from "@/lib/types/girl"
import { GirlImageCropper } from "@/components/girls/GirlImageCropper"
import { getSupabaseClient } from "@/lib/supabase"

interface GirlFormDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    girl?: GirlWithStatus | null
    onSuccess: () => void
}

// 语言选项
const LANGUAGE_OPTIONS = [
    { value: 'EN_Base' as const, label: '英文(基础)' },
    { value: 'EN' as const, label: '英文(流利)' },
    { value: 'ZH_Base' as const, label: '中文(基础)' },
    { value: 'ZH' as const, label: '中文(流利)' },
    { value: 'TH_Base' as const, label: '泰语(基础)' },
    { value: 'TH' as const, label: '泰语(流利)' },
    { value: 'KO_Base' as const, label: '韩语(基础)' },
    { value: 'KO' as const, label: '韩语(流利)' },
    { value: 'YUE_Base' as const, label: '粤语(基础)' },
    { value: 'YUE' as const, label: '粤语(流利)' },
    { value: 'JA_Base' as const, label: '日语(基础)' },
    { value: 'JA' as const, label: '日语(流利)' },
] as const

// 生成时间选项（30分钟步进）
const generateTimeOptions = () => {
    const options: string[] = []
    for (let h = 0; h < 24; h++) {
        options.push(`${String(h).padStart(2, '0')}:00`)
        options.push(`${String(h).padStart(2, '0')}:30`)
    }
    return options
}

export function GirlFormDialog({ open, onOpenChange, girl, onSuccess }: GirlFormDialogProps) {
    const [loading, setLoading] = useState(false)
    const [cities, setCities] = useState<any[]>([])
    const [categories, setCategories] = useState<any[]>([])
    
    // User ID绑定相关
    const [userQuery, setUserQuery] = useState('')
    const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([])
    const [searchingUsers, setSearchingUsers] = useState(false)
    const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null)
    
    // Username唯一性检查
    const [checkingUsername, setCheckingUsername] = useState(false)
    const [usernameError, setUsernameError] = useState('')
    
    // 头像上传和裁剪
    const [avatarFile, setAvatarFile] = useState<File | null>(null)
    const [avatarPreview, setAvatarPreview] = useState<string>("")
    const [showAvatarCropper, setShowAvatarCropper] = useState(false)
    const [avatarToProcess, setAvatarToProcess] = useState<File | null>(null)

    const form = useForm<GirlFormData>({
        resolver: zodResolver(girlFormSchema) as any,
        defaultValues: {
            user_id: null,
            telegram_id: null,
            username: '',
            name: '',
            profile: { en: '', zh: '', th: '' },
            avatar_url: null,
            birth_date: null,
            height: null,
            weight: null,
            measurements: null,
            gender: 0,
            languages: [],
            tags: { en: '', zh: '', th: '' },
            badge: null,
            rating: 0,
            total_sales: 0,
            total_reviews: 0,
            max_travel_distance: 10,
            work_hours: { start: '19:00', end: '10:00' },
            is_verified: false,
            is_blocked: false,
            is_visible_to_thai: true,
            sort_order: 999,
            city_id: null,
            category_ids: [],
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
                user_id: girl.user_id || null,
                telegram_id: girl.telegram_id || null,
                username: girl.username,
                name: girl.name,
                profile: girl.profile,
                avatar_url: girl.avatar_url || null,
                birth_date: girl.birth_date || null,
                height: girl.height || null,
                weight: girl.weight || null,
                measurements: girl.measurements || null,
                gender: girl.gender,
                languages: (girl.languages || []) as any,
                tags: girl.tags,
                badge: girl.badge || null,
                rating: girl.rating || 0,
                total_sales: girl.total_sales || 0,
                total_reviews: girl.total_reviews || 0,
                max_travel_distance: girl.max_travel_distance,
                work_hours: girl.work_hours || { start: '19:00', end: '10:00' },
                is_verified: girl.is_verified,
                is_blocked: girl.is_blocked,
                is_visible_to_thai: girl.is_visible_to_thai,
                sort_order: girl.sort_order,
                city_id: girl.city_id || null,
                category_ids: girl.category_ids || [],
            })
            setAvatarPreview(girl.avatar_url || '')
            
            // 如果有user_id，加载用户信息用于显示
            if (girl.user_id) {
                loadUserInfo(girl.user_id)
            } else {
                setSelectedUser(null)
            }
        } else if (!girl && open) {
            form.reset({
                user_id: null,
                telegram_id: null,
                username: '',
                name: '',
                profile: { en: '', zh: '', th: '' },
                avatar_url: null,
                birth_date: null,
                height: null,
                weight: null,
                measurements: null,
                gender: 0,
                languages: [],
                tags: { en: '', zh: '', th: '' },
                badge: null,
                rating: 0,
                total_sales: 0,
                total_reviews: 0,
                max_travel_distance: 10,
                work_hours: { start: '19:00', end: '10:00' },
                is_verified: false,
                is_blocked: false,
                is_visible_to_thai: true,
                sort_order: 999,
                city_id: null,
                category_ids: [],
            })
            setAvatarPreview('')
            setSelectedUser(null)
        }
    }, [girl, open, form])

    // 加载用户信息（用于显示已绑定的用户）
    const loadUserInfo = async (userId: string) => {
        try {
            const result = await searchUsers(userId)
            if (result.ok && result.data && result.data.length > 0) {
                setSelectedUser(result.data[0])
            }
        } catch (error) {
            console.error('加载用户信息失败:', error)
        }
    }

    // 搜索用户（按回车）
    const handleUserSearch = async () => {
        if (!userQuery || userQuery.length < 3) {
            toast.error("请输入至少3个字符")
            return
        }

        setSearchingUsers(true)
        try {
            const result = await searchUsers(userQuery)
            if (result.ok && result.data) {
                setUserSearchResults(result.data)
                if (result.data.length === 0) {
                    toast.error("User not found")
                }
            } else {
                toast.error(result.error || "搜索失败")
            }
        } finally {
            setSearchingUsers(false)
        }
    }

    // 选择用户绑定
    const handleUserSelect = (user: UserSearchResult) => {
        setSelectedUser(user)
        form.setValue('user_id', user.id)
        setUserSearchResults([])
        setUserQuery('')
        toast.success("用户绑定成功")
    }

    // 解绑用户
    const handleUserUnbind = () => {
        setSelectedUser(null)
        form.setValue('user_id', null)
        toast.success("用户已解绑")
    }

    // Username唯一性检查
    const handleUsernameCheck = async (username: string) => {
        if (!username || username.length < 3) {
            setUsernameError('')
            return
        }

        setCheckingUsername(true)
        setUsernameError('')

        try {
            const result = await checkUsernameExists(username, girl?.id)
            if (result.ok && result.data) {
                setUsernameError("Username already exists")
            }
        } catch (error) {
            console.error('检查username失败:', error)
        } finally {
            setCheckingUsername(false)
        }
    }

    // 头像选择（触发裁剪器）
    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0]
            setAvatarToProcess(file)
            setShowAvatarCropper(true)
        }
    }

    // 裁剪完成回调
    const handleAvatarCropComplete = (blob: Blob) => {
        const croppedFile = new File([blob], `${Date.now()}_avatar.jpg`, { type: 'image/jpeg' })
        setAvatarFile(croppedFile)
        setAvatarPreview(URL.createObjectURL(blob))
    }

    // 上传头像到 Supabase Storage
    // 路径格式: avatars/{girl_id}/{timestamp}_{filename}
    const uploadAvatar = async (file: File, girlId: string): Promise<string | null> => {
        try {
            const supabase = getSupabaseClient()
            const fileName = `${Date.now()}_${file.name}`
            
            // 使用技师ID作为文件夹名
            const folderPath = `avatars/${girlId}/${fileName}`
            
            const { data, error } = await supabase.storage
                .from('upload')
                .upload(folderPath, file, {
                    cacheControl: '3600',
                    upsert: false
                })

            if (error) {
                console.error('头像上传失败:', error)
                toast.error("头像上传失败: " + error.message)
                return null
            }

            const { data: { publicUrl } } = supabase.storage
                .from('upload')
                .getPublicUrl(folderPath)

            return publicUrl
        } catch (error) {
            console.error('头像上传异常:', error)
            toast.error("头像上传失败")
            return null
        }
    }

    // 表单提交
    const onSubmit = async (data: GirlFormData) => {
        if (usernameError) {
            toast.error("请先解决用户名重复问题")
            return
        }

        try {
            setLoading(true)

            // 编辑模式：先上传头像再更新
            if (girl) {
                if (avatarFile) {
                    const avatarUrl = await uploadAvatar(avatarFile, girl.id)
                    if (avatarUrl) {
                        data.avatar_url = avatarUrl
                    } else {
                        toast.error("头像上传失败，请重试")
                        setLoading(false)
                        return
                    }
                }

                const result = await updateGirl(girl.id, data)
                if (result.ok) {
                    toast.success("技师更新成功")
                    onSuccess()
                    onOpenChange(false)
                } else {
                    toast.error(result.error || "更新失败")
                }
            } 
            // 新建模式：先创建技师，再上传头像并更新
            else {
                // 1. 先创建技师（不带头像）
                const createResult = await createGirl(data)
                
                if (!createResult.ok) {
                    toast.error(createResult.error || "创建失败")
                    setLoading(false)
                    return
                }

                const newGirlId = createResult.data?.id

                // 2. 如果有头像，上传到技师ID文件夹并更新
                if (avatarFile && newGirlId) {
                    const avatarUrl = await uploadAvatar(avatarFile, newGirlId)
                    if (avatarUrl) {
                        // 3. 更新技师的头像URL
                        const updateData = { ...data, avatar_url: avatarUrl }
                        await updateGirl(newGirlId, updateData)
                    }
                }

                toast.success("技师创建成功")
                onSuccess()
                onOpenChange(false)
            }
        } catch (error) {
            console.error('提交表单失败:', error)
            toast.error("操作失败，请重试")
        } finally {
            setLoading(false)
        }
    }

    // 切换语言选择
    const toggleLanguage = (langCode: string) => {
        const currentValue = form.getValues('languages')
        // 安全转换为字符串数组
        const currentLangs: string[] = Array.isArray(currentValue) 
            ? currentValue.filter((l: any): l is string => typeof l === 'string') 
            : []
        
        if (currentLangs.includes(langCode)) {
            form.setValue('languages', currentLangs.filter((l: string) => l !== langCode) as any)
        } else {
            form.setValue('languages', [...currentLangs, langCode] as any)
        }
    }

    // 切换分类选择
    const toggleCategory = (categoryId: number) => {
        const currentCategories = form.getValues('category_ids') || []
        if (currentCategories.includes(categoryId)) {
            form.setValue('category_ids', currentCategories.filter(id => id !== categoryId))
        } else {
            form.setValue('category_ids', [...currentCategories, categoryId])
        }
    }

    const timeOptions = generateTimeOptions()

    return (
        <>
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl mx-4 sm:mx-auto max-h-[90vh] overflow-y-auto">
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
                        {/* 两个Section Tab */}
                        <Tabs defaultValue="basic" className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="basic">基础信息</TabsTrigger>
                                <TabsTrigger value="business">业务维度</TabsTrigger>
                            </TabsList>

                            {/* 基础信息标签页 */}
                            <TabsContent value="basic" className="space-y-4 pt-4">
                                {/* 头像 */}
                                <div className="flex flex-col items-center space-y-2">
                                    <FormLabel>头像</FormLabel>
                                    <Avatar 
                                        className="w-24 h-24 cursor-pointer relative group" 
                                        onClick={() => document.getElementById('avatar-upload')?.click()}
                                    >
                                        <AvatarImage src={avatarPreview || undefined} />
                                        <AvatarFallback className="bg-muted">
                                            <Upload className="h-8 w-8 text-muted-foreground" />
                                        </AvatarFallback>
                                        <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                            <span className="text-white text-xs">上传头像</span>
                                        </div>
                                    </Avatar>
                                    <input
                                        id="avatar-upload"
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleAvatarChange}
                                    />
                                </div>

                                {/* User ID绑定 */}
                                <div className="space-y-2">
                                    <FormLabel>用户绑定 (可选)</FormLabel>
                                    {selectedUser ? (
                                        <div className="flex items-center gap-2 p-3 border-2 border-primary rounded-md bg-primary/5">
                                            <div className="flex-1 space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="default" className="font-normal">
                                                        {selectedUser.phone || selectedUser.email || selectedUser.display_name}
                                                    </Badge>
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {selectedUser.display_name && (selectedUser.phone || selectedUser.email) && (
                                                        <span className="font-medium">{selectedUser.display_name} • </span>
                                                    )}
                                                    <span className="font-mono">{selectedUser.id}</span>
                                                </div>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleUserUnbind}
                                                className="hover:bg-destructive/10 hover:text-destructive"
                                            >
                                                <XCircle className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="flex gap-2">
                                                <Input
                                                    placeholder="输入邮箱或手机号..."
                                                    value={userQuery}
                                                    onChange={(e) => setUserQuery(e.target.value)}
                                                    onKeyPress={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault()
                                                            handleUserSearch()
                                                        }
                                                    }}
                                                    disabled={loading}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={handleUserSearch}
                                                    disabled={searchingUsers || loading}
                                                >
                                                    {searchingUsers ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                            {userSearchResults.length > 0 && (
                                                <div className="border rounded-md divide-y max-h-40 overflow-y-auto">
                                                    {userSearchResults.map((user) => (
                                                        <div
                                                            key={user.id}
                                                            className="p-2 hover:bg-muted cursor-pointer"
                                                            onClick={() => handleUserSelect(user)}
                                                        >
                                                            <div className="text-sm font-medium">{user.display_name || user.email}</div>
                                                            <div className="text-xs text-muted-foreground">{user.id}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <FormDescription>按回车搜索用户，点击选择绑定</FormDescription>
                                        </div>
                                    )}
                                </div>

                                {/* Telegram ID 和 Username 同一行 */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Telegram ID */}
                                    <FormField
                                        control={form.control}
                                        name="telegram_id"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Telegram ID</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        placeholder="Telegram用户或群组ID"
                                                        {...field}
                                                        value={field.value === null ? '' : field.value}
                                                        onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                                                        disabled={loading}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {/* Username */}
                                    <FormField
                                        control={form.control}
                                        name="username"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>用户名 * (唯一)</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Input 
                                                            placeholder="lisa123" 
                                                            {...field} 
                                                            disabled={loading}
                                                            onBlur={(e) => handleUsernameCheck(e.target.value)}
                                                        />
                                                        {checkingUsername && (
                                                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </FormControl>
                                                {usernameError && <p className="text-sm text-destructive">{usernameError}</p>}
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                {/* 昵称、性别、城市 同一行 */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    {/* 显示昵称 */}
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

                                    {/* 性别 */}
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

                                    {/* 城市 */}
                                    <FormField
                                        control={form.control}
                                        name="city_id"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>城市</FormLabel>
                                                <Select
                                                    value={field.value?.toString() || 'none'}
                                                    onValueChange={(value) => field.onChange(value === 'none' ? null : parseInt(value))}
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
                                </div>

                                {/* 分类多选 - 单独一行 */}
                                <FormField
                                    control={form.control}
                                    name="category_ids"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>分类（多选）</FormLabel>
                                            <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[40px]">
                                                {categories.map((category) => {
                                                    const isSelected = (field.value || []).includes(category.id)
                                                    return (
                                                        <Badge
                                                            key={category.id}
                                                            variant={isSelected ? "default" : "outline"}
                                                            className="cursor-pointer"
                                                            onClick={() => toggleCategory(category.id)}
                                                        >
                                                            {category.name.zh || category.name.en || category.name.th}
                                                            {isSelected && <X className="ml-1 h-3 w-3" />}
                                                        </Badge>
                                                    )
                                                })}
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* 语言能力 */}
                                <FormField
                                    control={form.control}
                                    name="languages"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>语言能力（多选）</FormLabel>
                                            <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[40px]">
                                                {LANGUAGE_OPTIONS.map((option) => {
                                                    const langArray = Array.isArray(field.value) ? field.value : []
                                                    const isSelected = langArray.includes(option.value)
                                                    return (
                                                        <Badge
                                                            key={option.value}
                                                            variant={isSelected ? "default" : "outline"}
                                                            className="cursor-pointer"
                                                            onClick={() => toggleLanguage(option.value)}
                                                        >
                                                            {option.label}
                                                            {isSelected && <X className="ml-1 h-3 w-3" />}
                                                        </Badge>
                                                    )
                                                })}
                                            </div>
                                            <FormDescription>点击选择语言，再次点击取消</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* 多语言简介 */}
                                <div className="space-y-2">
                                    <FormLabel>个人简介</FormLabel>
                                    <Tabs defaultValue="zh" className="w-full">
                                        <TabsList className="grid w-full grid-cols-3">
                                            <TabsTrigger value="zh">中文</TabsTrigger>
                                            <TabsTrigger value="en">English</TabsTrigger>
                                            <TabsTrigger value="th">ไทย</TabsTrigger>
                                        </TabsList>

                                        <TabsContent value="zh">
                                            <FormField
                                                control={form.control}
                                                name="profile.zh"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormControl>
                                                            <Textarea
                                                                placeholder="中文简介..."
                                                                className="min-h-[80px]"
                                                                {...field}
                                                                disabled={loading}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </TabsContent>

                                        <TabsContent value="en">
                                            <FormField
                                                control={form.control}
                                                name="profile.en"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormControl>
                                                            <Textarea
                                                                placeholder="English profile..."
                                                                className="min-h-[80px]"
                                                                {...field}
                                                                disabled={loading}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </TabsContent>

                                        <TabsContent value="th">
                                            <FormField
                                                control={form.control}
                                                name="profile.th"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormControl>
                                                            <Textarea
                                                                placeholder="ใส่โปรไฟล์..."
                                                                className="min-h-[80px]"
                                                                {...field}
                                                                disabled={loading}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </TabsContent>
                                    </Tabs>
                                </div>

                                {/* 物理信息 */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="birth_date"
                                        render={({ field }) => (
                                            <FormItem className="col-span-2">
                                                <FormLabel>出生日期</FormLabel>
                                                <FormControl>
                                                    <Input 
                                                        type="date" 
                                                        {...field} 
                                                        value={field.value || ''}
                                                        disabled={loading} 
                                                    />
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
                                                <FormLabel>身高(cm)</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        placeholder="165"
                                                        {...field}
                                                        value={field.value === null ? '' : field.value}
                                                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
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
                                                <FormLabel>体重(kg)</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        placeholder="50"
                                                        {...field}
                                                        value={field.value === null ? '' : field.value}
                                                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
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
                                                <Input 
                                                    placeholder="90-60-90" 
                                                    {...field} 
                                                    value={field.value || ''}
                                                    disabled={loading} 
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </TabsContent>

                            {/* 业务维度标签页 */}
                            <TabsContent value="business" className="space-y-4 pt-4">
                                {/* 业务数据 */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="rating"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>评分(0-5)</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        step="0.1"
                                                        min="0"
                                                        max="5"
                                                        {...field}
                                                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                                        disabled={loading}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="total_sales"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>销量</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
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
                                        name="total_reviews"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>评论数</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        {...field}
                                                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                                        disabled={loading}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                {/* 工作时间 */}
                                <div className="space-y-2">
                                    <FormLabel>当前在线时段</FormLabel>
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="work_hours.start"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>开始时间</FormLabel>
                                                    <Select
                                                        value={field.value}
                                                        onValueChange={field.onChange}
                                                        disabled={loading}
                                                    >
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="选择时间" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent className="max-h-[200px]">
                                                            {timeOptions.map((time) => (
                                                                <SelectItem key={time} value={time}>
                                                                    {time}
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
                                            name="work_hours.end"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>结束时间</FormLabel>
                                                    <Select
                                                        value={field.value}
                                                        onValueChange={field.onChange}
                                                        disabled={loading}
                                                    >
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="选择时间" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent className="max-h-[200px]">
                                                            {timeOptions.map((time) => (
                                                                <SelectItem key={time} value={time}>
                                                                    {time}
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

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="max_travel_distance"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>服务距离(km)</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        {...field}
                                                        onChange={(e) => field.onChange(parseInt(e.target.value) || 10)}
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

                                {/* 开关选项 */}
                                <div className="space-y-3">
                                    <FormField
                                        control={form.control}
                                        name="is_visible_to_thai"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                                <div className="space-y-0.5">
                                                    <FormLabel>泰国用户可见</FormLabel>
                                                </div>
                                                <FormControl>
                                                    <Switch
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                        disabled={loading}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="is_verified"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                                <div className="space-y-0.5">
                                                    <FormLabel>已认证</FormLabel>
                                                </div>
                                                <FormControl>
                                                    <Switch
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                        disabled={loading}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="is_blocked"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 bg-red-50 dark:bg-red-950">
                                                <div className="space-y-0.5">
                                                    <FormLabel>屏蔽账号</FormLabel>
                                                </div>
                                                <FormControl>
                                                    <Switch
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                        disabled={loading}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </TabsContent>
                        </Tabs>

                        {/* 按钮 */}
                        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto" disabled={loading}>
                                取消
                            </Button>
                            <Button type="submit" disabled={loading || !!usernameError} className="w-full sm:w-auto">
                                {loading && <LoadingSpinner size="sm" className="mr-2" />}
                                {girl ? '更新技师' : '创建技师'}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>

        {/* 头像裁剪器 */}
        <GirlImageCropper
            open={showAvatarCropper}
            onOpenChange={setShowAvatarCropper}
            imageFile={avatarToProcess}
            onCropComplete={handleAvatarCropComplete}
            title="裁剪头像"
        />
    </>
    )
}
