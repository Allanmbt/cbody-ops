export type SlideLinkType = 'none' | 'internal' | 'external'
export type SlideLocale = 'en' | 'zh' | 'th'
export type SlideImages = Partial<Record<SlideLocale, string>>

export interface HomeSlide {
    slot: number
    image_path: string
    image_paths?: SlideImages
    link_type: SlideLinkType
    link_target: string | null
    created_at: string
    updated_at: string
}

export type SlideResult<T = undefined> =
    | { ok: true; data: T; warning?: string }
    | { ok: false; error: string; warning?: string }
