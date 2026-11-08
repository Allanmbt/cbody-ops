import type { HomeSlide, SlideImages, SlideLocale } from './types'

export const SLIDE_LOCALES: { value: SlideLocale; label: string }[] = [
    { value: 'zh', label: '中文' }, { value: 'en', label: 'English' }, { value: 'th', label: 'ไทย' },
]

export function getSlideImages(slide?: Pick<HomeSlide, 'image_path' | 'image_paths'>): SlideImages {
    if (!slide) return {}
    return Object.values(slide.image_paths || {}).some(Boolean) ? { ...slide.image_paths } : { en: slide.image_path }
}

export function getSlideImagePath(slide: Pick<HomeSlide, 'image_path' | 'image_paths'>, locale: SlideLocale): string {
    return slide.image_paths?.[locale] || slide.image_paths?.en || slide.image_path
}

export function getAllSlideImages(slide: Pick<HomeSlide, 'image_path' | 'image_paths'>): string[] {
    return [...new Set([slide.image_path, ...Object.values(slide.image_paths || {})].filter(Boolean))]
}
