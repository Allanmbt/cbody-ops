'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { ImagePlus, Loader2, Pencil, Trash2 } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase'
import {
    SLIDES_BUCKET, SLIDE_MAX_BYTES, SLIDE_MIME_EXTENSIONS, slideLinkFormSchema,
    SLIDE_LOCALES, getSlideImages, getSlideImagePath,
    type HomeSlide, type SlideLinkFormData, type SlideImages, type SlideLocale,
} from '@/lib/features/slides'
import { createSlideUpload, discardSlideUpload, saveHomeSlide, deleteHomeSlide } from '@/app/dashboard/configs/slides/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const LINK_LABELS = { none: '不跳转', internal: '应用内页面', external: '外部链接' }
const publicImageUrl = (path: string) => getSupabaseClient().storage.from(SLIDES_BUCKET).getPublicUrl(path).data.publicUrl

export function SlidesManager({ initialSlides }: { initialSlides: HomeSlide[] }) {
    const [slides, setSlides] = useState(initialSlides)
    useEffect(() => { setSlides(initialSlides) }, [initialSlides])
    return (
        <div className="grid gap-4 lg:grid-cols-3">
            {[1, 2, 3].map(slot => (
                <SlideSlot key={slot} slot={slot} slide={slides.find(slide => slide.slot === slot)}
                    onSaved={saved => setSlides(current => [...current.filter(slide => slide.slot !== slot), saved])}
                    onDeleted={() => setSlides(current => current.filter(slide => slide.slot !== slot))} />
            ))}
            <p className="text-xs leading-6 text-muted-foreground lg:col-span-3">
                每张幻灯片可分别上传中英泰封面。建议比例 2.8:1（如 1120×400），JPEG / PNG / WebP，单张最多 5 MiB。图片原样上传，不压缩、不裁剪。
            </p>
        </div>
    )
}

function SlideSlot({ slot, slide, onSaved, onDeleted }: {
    slot: number; slide?: HomeSlide; onSaved: (slide: HomeSlide) => void; onDeleted: () => void
}) {
    const [locale, setLocale] = useState<SlideLocale>('zh')
    const [editing, setEditing] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const deleteVersion = useRef<string | null>(null)
    const [deleting, setDeleting] = useState(false)
    const deleteLock = useRef(false)

    const remove = async () => {
        if (!slide || deleteLock.current) return
        deleteLock.current = true
        setDeleting(true)
        try {
            const result = await deleteHomeSlide({ slot, expected_updated_at: deleteVersion.current })
            if (!result.ok) { toast.error(result.error); return }
            onDeleted()
            setConfirmDelete(false)
            toast.success('幻灯片已删除')
            if (result.warning) toast.warning(result.warning)
        } catch { toast.error('删除失败，请稍后重试') } finally {
            deleteLock.current = false
            setDeleting(false)
        }
    }

    return (
        <>
            <Card className="overflow-hidden rounded-2xl">
                <CardHeader className="pb-3"><CardTitle className="text-base">位置 {slot}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-1">{SLIDE_LOCALES.map(lang => <Button key={lang.value} size="sm" variant={locale === lang.value ? 'secondary' : 'ghost'} onClick={() => setLocale(lang.value)}>{lang.label}</Button>)}</div>
                    <div className="relative flex aspect-[2.8/1] items-center justify-center overflow-hidden rounded-2xl bg-muted">
                        {slide ? <Image src={publicImageUrl(getSlideImagePath(slide, locale))} alt={`首页幻灯片 ${slot}`} fill unoptimized className="object-cover" />
                            : <span className="text-sm text-muted-foreground">未上传</span>}
                    </div>
                    {slide && <div className="space-y-2">
                        <Badge variant="secondary">{LINK_LABELS[slide.link_type]}</Badge>
                        {slide.link_target && <p className="break-all text-xs text-muted-foreground">{slide.link_target}</p>}
                    </div>}
                    <div className="flex gap-2">
                        <Button variant={slide ? 'outline' : 'default'} onClick={() => setEditing(true)} disabled={deleting}>
                            {slide ? <Pencil className="size-4" /> : <ImagePlus className="size-4" />}{slide ? '编辑' : '上传图片'}
                        </Button>
                        {slide && <Button variant="ghost" onClick={() => { deleteVersion.current = slide.updated_at; setConfirmDelete(true) }} disabled={deleting} aria-label={`删除位置 ${slot} 的幻灯片`}>
                            <Trash2 className="size-4" />删除
                        </Button>}
                    </div>
                </CardContent>
            </Card>
            {editing && <SlideEditor slot={slot} slide={slide} onClose={() => setEditing(false)} onSaved={onSaved} />}
            <AlertDialog open={confirmDelete} onOpenChange={open => { if (!deleting) setConfirmDelete(open) }}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>删除位置 {slot} 的幻灯片？</AlertDialogTitle>
                        <AlertDialogDescription>删除后客户端不再展示这张图片，对应存储文件也会清理。</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
                        <AlertDialogAction disabled={deleting} onClick={event => { event.preventDefault(); void remove() }}>
                            {deleting && <Loader2 className="size-4 animate-spin" />}确认删除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}

function SlideEditor({ slot, slide: initialSlide, onClose, onSaved }: {
    slot: number; slide?: HomeSlide; onClose: () => void; onSaved: (slide: HomeSlide) => void
}) {
    // 编辑期间保留打开时的版本，避免其他位置保存触发刷新后用新版本覆盖旧表单。
    const [slide] = useState(initialSlide)
    const [files, setFiles] = useState<Partial<Record<SlideLocale, File>>>({})
    const [locale, setLocale] = useState<SlideLocale>('zh')
    const [preview, setPreview] = useState<{ file: File; url: string } | null>(null)
    const [saving, setSaving] = useState(false)
    const savingLock = useRef(false)
    const form = useForm<SlideLinkFormData>({
        resolver: zodResolver(slideLinkFormSchema),
        defaultValues: { link_type: slide?.link_type || 'none', link_target: slide?.link_target || '' },
    })
    const linkType = form.watch('link_type')
    const file = files[locale]
    useEffect(() => {
        if (!file) { setPreview(null); return }
        const url = URL.createObjectURL(file)
        setPreview({ file, url })
        return () => URL.revokeObjectURL(url)
    }, [file])

    const submit = async (values: SlideLinkFormData) => {
        if (savingLock.current) return
        if (Object.keys(files).length === 0 && !slide) { toast.error('请至少选择一种语言封面'); return }
        savingLock.current = true
        setSaving(true)
        const uploadedPaths: string[] = []
        let committed = false
        try {
            const imagePaths: SlideImages = getSlideImages(slide)
            for (const language of SLIDE_LOCALES) {
                const file = files[language.value]
                if (!file) continue
                const upload = await createSlideUpload({ slot, mime: file.type, size: file.size })
                if (!upload.ok) { toast.error(upload.error); return }
                uploadedPaths.push(upload.data.path)
                const { error } = await getSupabaseClient().storage.from(SLIDES_BUCKET)
                    .uploadToSignedUrl(upload.data.path, upload.data.token, file, { contentType: file.type, cacheControl: '31536000' })
                if (error) { toast.error('图片上传失败，请重试'); return }
                imagePaths[language.value] = upload.data.path
            }
            const result = await saveHomeSlide({ ...values, slot, image_path: imagePaths.en || imagePaths.zh || imagePaths.th, image_paths: imagePaths, expected_updated_at: slide?.updated_at ?? null })
            if (!result.ok) { toast.error(result.error); return }
            committed = true
            onSaved(result.data)
            toast.success('幻灯片已保存')
            if (result.warning) toast.warning(result.warning)
            onClose()
        } catch { toast.error('保存失败，请检查网络后重试') } finally {
            if (!committed) {
                await Promise.all(uploadedPaths.map(async path => {
                    try {
                        const cleanup = await discardSlideUpload(path)
                        if (!cleanup.ok) toast.warning(cleanup.error)
                        else if (cleanup.warning) toast.warning(cleanup.warning)
                    } catch { toast.warning('未发布图片清理失败，请稍后检查 Storage') }
                }))
            }
            savingLock.current = false
            setSaving(false)
        }
    }

    const imageUrl = (preview?.file === file ? preview?.url : null) || (slide ? publicImageUrl(getSlideImagePath(slide, locale)) : null)
    return (
        <Dialog open onOpenChange={open => { if (!open && !savingLock.current) onClose() }}>
            <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-xl">
                <DialogHeader><DialogTitle>编辑位置 {slot}</DialogTitle>
                    <DialogDescription>预览比例为 2.8:1，保存后发布。未设置跳转时，点击图片无动作。</DialogDescription>
                </DialogHeader>
                <Form {...form}><form className="space-y-4" onSubmit={form.handleSubmit(submit)}>
                    <div className="flex flex-wrap gap-1">{SLIDE_LOCALES.map(lang => <Button key={lang.value} type="button" size="sm" disabled={saving} variant={locale === lang.value ? 'secondary' : 'ghost'} onClick={() => setLocale(lang.value)}>{lang.label}{(files[lang.value] || getSlideImages(slide)[lang.value]) ? ' ✓' : ''}</Button>)}</div>
                    <p className="text-xs text-muted-foreground">至少上传一种语言封面。缺少当前语言时使用英文，再使用默认封面。三种语言共用跳转设置。</p>
                    <div className="relative flex aspect-[2.8/1] items-center justify-center overflow-hidden rounded-2xl bg-muted">
                        {imageUrl ? <Image src={imageUrl} alt="幻灯片预览" fill unoptimized className="object-cover" /> : <ImagePlus className="size-8 text-muted-foreground" />}
                    </div>
                    <div className="space-y-2">
                        <label htmlFor={`slide-file-${slot}`} className="text-sm font-medium">{SLIDE_LOCALES.find(lang => lang.value === locale)?.label}封面（可选）</label>
                        <Input key={locale} id={`slide-file-${slot}`} type="file" accept="image/jpeg,image/png,image/webp" disabled={saving} onChange={event => {
                            const selected = event.target.files?.[0]
                            if (!selected) return
                            if (!(selected.type in SLIDE_MIME_EXTENSIONS) || selected.size <= 0 || selected.size > SLIDE_MAX_BYTES) {
                                toast.error('请选择不超过 5 MiB 的 JPEG、PNG 或 WebP 图片')
                                setFiles(current => { const next = { ...current }; delete next[locale]; return next })
                                event.target.value = ''
                                return
                            }
                            setFiles(current => ({ ...current, [locale]: selected }))
                        }} />
                        <p className="text-xs text-muted-foreground">建议 1120×400，最多 5 MiB；图片原样上传。</p>
                    </div>
                    <FormField control={form.control} name="link_type" render={({ field }) => (
                        <FormItem><FormLabel>点击跳转</FormLabel>
                            <Select value={field.value} disabled={saving} onValueChange={value => {
                                field.onChange(value)
                                form.setValue('link_target', '', { shouldDirty: true })
                                form.clearErrors('link_target')
                            }}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>{Object.entries(LINK_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                            </Select><FormMessage />
                        </FormItem>
                    )} />
                    {linkType !== 'none' && <FormField control={form.control} name="link_target" render={({ field }) => (
                        <FormItem><FormLabel>{linkType === 'internal' ? '应用内路径' : '外部 HTTPS 地址'}</FormLabel>
                            <FormControl><Input {...field} disabled={saving} placeholder={linkType === 'internal' ? '填写客户端支持的 / 开头路径' : 'https://…'} maxLength={2048} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />}
                    <DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={onClose}>取消</Button>
                        <Button type="submit" disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" />}{saving ? '保存中…' : '保存'}</Button>
                    </DialogFooter>
                </form></Form>
            </DialogContent>
        </Dialog>
    )
}
