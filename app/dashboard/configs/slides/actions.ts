'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import { getSupabaseAdminClient } from '@/lib/supabase'
import {
    SLIDES_BUCKET, SLIDE_MAX_BYTES, SLIDE_MIME_EXTENSIONS,
    slideUploadSchema, slideImagePathSchema, saveSlideSchema, deleteSlideSchema,
    getAllSlideImages, getSlideImages,
    type HomeSlide, type SlideResult,
} from '@/lib/features/slides'

const conflictMessage = '该位置已被其他管理员修改，请刷新页面后重试'

async function auditSlide(adminId: string, action: string, details: Record<string, unknown>): Promise<string | undefined> {
    try {
        const { error } = await (getSupabaseAdminClient() as any).from('admin_operation_logs').insert({
            operator_id: adminId,
            target_admin_id: adminId,
            operation_type: action,
            operation_details: details,
        })
        if (!error) return undefined
        console.error('记录首页幻灯片审计失败:', error)
    } catch (error) { console.error('记录首页幻灯片审计异常:', error) }
    return '操作已完成，但审计日志记录失败，请联系管理员检查'
}

// 只清理本桶的规范路径，且确认没有任何已发布记录引用；数据库检查失败时保留文件。
async function removeUnusedImage(imagePath: string): Promise<string | undefined> {
    try {
        if (!slideImagePathSchema.safeParse(imagePath).success) return '图片路径不正确，未清理文件'
        const supabase = getSupabaseAdminClient()
        const { data, error } = await (supabase as any).from('home_slides')
            .select('image_path,image_paths').limit(3)
        if (error) return '无法确认图片引用，未清理文件，请稍后在 Storage 检查'
        if (data?.some((slide: HomeSlide) => getAllSlideImages(slide).includes(imagePath))) return undefined
        const { error: storageError } = await supabase.storage.from(SLIDES_BUCKET).remove([imagePath])
        if (storageError) {
            console.error('清理首页幻灯片图片失败:', storageError)
            return '记录已处理，但图片清理失败，请在 home-slides 存储桶中检查'
        }
    } catch (error) {
        console.error('清理首页幻灯片图片异常:', error)
        return '图片清理失败，请稍后在 home-slides 存储桶中检查'
    }
}

export async function getHomeSlides(): Promise<SlideResult<HomeSlide[]>> {
    try {
        await requireAdmin(['superadmin', 'admin'])
        const { data, error } = await (getSupabaseAdminClient() as any).from('home_slides')
            .select('*').order('slot', { ascending: true }).limit(3)
        if (error) return { ok: false, error: '读取幻灯片失败，请确认已执行安装 SQL' }
        return { ok: true, data: data || [] }
    } catch {
        return { ok: false, error: '无法读取幻灯片，请检查登录状态和权限' }
    }
}

export async function createSlideUpload(input: unknown): Promise<SlideResult<{ path: string; token: string }>> {
    try {
        await requireAdmin(['superadmin', 'admin'])
        const parsed = slideUploadSchema.safeParse(input)
        if (!parsed.success) return { ok: false, error: '请选择不超过 5 MiB 的 JPEG、PNG 或 WebP 图片' }
        const { slot, mime } = parsed.data
        const path = `${slot}/${crypto.randomUUID()}.${SLIDE_MIME_EXTENSIONS[mime]}`
        const { data, error } = await getSupabaseAdminClient().storage.from(SLIDES_BUCKET)
            .createSignedUploadUrl(path, { upsert: false })
        if (error) return { ok: false, error: '无法创建图片上传凭据，请确认 home-slides 存储桶已建立' }
        return { ok: true, data: { path, token: data.token } }
    } catch {
        return { ok: false, error: '无法上传图片，请检查登录状态和权限' }
    }
}

export async function discardSlideUpload(path: string): Promise<SlideResult> {
    try {
        await requireAdmin(['superadmin', 'admin'])
        const warning = await removeUnusedImage(path)
        return { ok: true, data: undefined, warning }
    } catch {
        return { ok: false, error: '清理未发布图片失败，请稍后检查 Storage' }
    }
}

export async function saveHomeSlide(input: unknown): Promise<SlideResult<HomeSlide>> {
    try {
        const admin = await requireAdmin(['superadmin', 'admin'])
        const parsed = saveSlideSchema.safeParse(input)
        if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message || '幻灯片资料不正确' }
        const { slot, image_path, image_paths, link_type, link_target, expected_updated_at } = parsed.data
        const supabase = getSupabaseAdminClient()
        const db = supabase as any
        const { data: previous, error: readError } = await db.from('home_slides')
            .select('*').eq('slot', slot).maybeSingle()
        if (readError) return { ok: false, error: '读取原幻灯片失败' }
        if ((previous?.updated_at ?? null) !== expected_updated_at) return { ok: false, error: conflictMessage }

        // 旧调用只修改跳转时保留已有多语言封面；明确替换默认图时也保留其他语言。
        const images = image_paths || {
            ...getSlideImages(previous || undefined),
            ...(previous?.image_path === image_path ? {} : { en: image_path }),
        }
        const defaultPath = images.en || images.zh || images.th || image_path
        const paths = [...new Set([defaultPath, ...Object.values(images)])]
        const checks = await Promise.all(paths.map(async path => {
            const { data: info, error } = await supabase.storage.from(SLIDES_BUCKET).info(path)
            const mime = info?.contentType ?? info?.metadata?.mimetype
            const size = info?.size ?? info?.metadata?.size
            return !error && info && typeof mime === 'string' && mime in SLIDE_MIME_EXTENSIONS &&
                Number.isInteger(size) && size > 0 && size <= SLIDE_MAX_BYTES &&
                path.endsWith(`.${SLIDE_MIME_EXTENSIONS[mime as keyof typeof SLIDE_MIME_EXTENSIONS]}`)
        }))
        if (checks.some(valid => !valid)) return { ok: false, error: '图片不存在、格式不支持或超过 5 MiB，请重新上传' }

        const values = { slot, image_path: defaultPath, image_paths: images, link_type, link_target: link_type === 'none' ? null : link_target }
        const query = previous
            ? db.from('home_slides').update(values).eq('slot', slot).eq('updated_at', expected_updated_at)
            : db.from('home_slides').insert(values)
        const { data: saved, error } = await query.select('*').maybeSingle()
        if (error) return { ok: false, error: error.code === '23505' ? conflictMessage : '保存幻灯片失败' }
        if (!saved) return { ok: false, error: conflictMessage }

        revalidatePath('/dashboard/configs/slides')
        revalidatePath('/dashboard/configs')
        const auditWarning = await auditSlide(admin.id, 'save_home_slide', { slot, previous, current: saved })
        const oldPaths = previous ? getAllSlideImages(previous).filter(path => !getAllSlideImages(saved).includes(path)) : []
        const cleanupWarning = (await Promise.all(oldPaths.map(removeUnusedImage))).filter(Boolean).join('；')
        const warning = [auditWarning, cleanupWarning].filter(Boolean).join('；') || undefined
        return { ok: true, data: saved, warning }
    } catch (error) {
        console.error('保存首页幻灯片失败:', error)
        return { ok: false, error: '保存失败，请检查登录状态、权限或网络后重试' }
    }
}

export async function deleteHomeSlide(input: unknown): Promise<SlideResult> {
    try {
        const admin = await requireAdmin(['superadmin', 'admin'])
        const parsed = deleteSlideSchema.safeParse(input)
        if (!parsed.success) return { ok: false, error: '删除参数不正确' }
        const { slot, expected_updated_at } = parsed.data
        const { data: removed, error } = await (getSupabaseAdminClient() as any).from('home_slides')
            .delete().eq('slot', slot).eq('updated_at', expected_updated_at).select('*').maybeSingle()
        if (error) return { ok: false, error: '删除幻灯片失败' }
        if (!removed) return { ok: false, error: conflictMessage }
        revalidatePath('/dashboard/configs/slides')
        revalidatePath('/dashboard/configs')
        const auditWarning = await auditSlide(admin.id, 'delete_home_slide', { slot, previous: removed })
        const cleanupWarning = (await Promise.all(getAllSlideImages(removed).map(removeUnusedImage))).filter(Boolean).join('；')
        const warning = [auditWarning, cleanupWarning].filter(Boolean).join('；') || undefined
        return { ok: true, data: undefined, warning }
    } catch (error) {
        console.error('删除首页幻灯片失败:', error)
        return { ok: false, error: '删除失败，请检查登录状态和权限' }
    }
}
