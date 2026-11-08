import type { LanguageContent } from "./types"

export interface GirlTagOption {
    id: number
    en: string
    zh: string
    th: string
}

export const GIRL_TAG_MAX_COUNT = 5

export const GIRL_TAG_OPTIONS: GirlTagOption[] = [
    { id: 1, en: "Professional", zh: "专业", th: "มืออาชีพ" },
    { id: 2, en: "Skilled", zh: "夯爆了", th: "ฝีมือขั้นเทพ" },
    { id: 3, en: "Experienced", zh: "经验拉满", th: "ประสบการณ์แน่น" },
    { id: 4, en: "Gentle Touch", zh: "力道轻柔", th: "น้ำหนักมือเบา" },
    { id: 5, en: "Precise", zh: "点位精准", th: "นวดตรงจุด" },
    { id: 6, en: "Attentive", zh: "细节拉满", th: "ใส่ใจทุกรายละเอียด" },
    { id: 7, en: "Patient", zh: "耐心", th: "ใจเย็น" },
    { id: 8, en: "Relaxing", zh: "解压舒缓", th: "ผ่อนคลายสบายตัว" },
    { id: 9, en: "Punctual", zh: "守时", th: "ตรงเวลา" },
    { id: 10, en: "Friendly", zh: "态度亲和", th: "เป็นกันเอง" },
    { id: 11, en: "Cheerful", zh: "元气满满", th: "สดใสร่าเริง" },
    { id: 12, en: "Warm", zh: "服务贴心", th: "ดูแลอบอุ่น" },
    { id: 13, en: "Calm", zh: "沉稳", th: "สุขุมใจเย็น" },
    { id: 14, en: "Natural", zh: "手法自然", th: "นวดเป็นธรรมชาติ" },
    { id: 15, en: "Elegant", zh: "优雅", th: "สง่างาม" },
    { id: 16, en: "Good Communication", zh: "沟通顺畅", th: "สื่อสารเข้าใจง่าย" },
    { id: 17, en: "Yoga", zh: "瑜伽", th: "โยคะ" },
    { id: 18, en: "Pilates", zh: "普拉提", th: "พิลาทิส" },
    { id: 19, en: "Stretching", zh: "拉伸", th: "ยืดเหยียด" },
    { id: 20, en: "Spa", zh: "SPA 护理", th: "สปา" },
    { id: 21, en: "Beauty", zh: "美容", th: "เสริมสวย" },
    { id: 22, en: "Nails", zh: "美甲", th: "ทำเล็บ" },
    { id: 23, en: "Housekeeping", zh: "家政", th: "งานบ้าน" },
    { id: 24, en: "Organizing", zh: "收纳", th: "จัดระเบียบบ้าน" },
    { id: 25, en: "New", zh: "新晋入驻", th: "สมาชิกใหม่" },
    { id: 26, en: "Fast Reply", zh: "秒回在线", th: "ตอบแชทไว" },
    { id: 27, en: "Top Rated", zh: "口碑超夯", th: "รีวิวปัง" },
    { id: 28, en: "Popular", zh: "人气爆棚", th: "ฮอตสุดๆ" },
    { id: 29, en: "Verified", zh: "已认证", th: "ยืนยันตัวตนแล้ว" },
    { id: 30, en: "Fast Arrival", zh: "极速达", th: "ถึงไว" },
]

const splitTags = (value?: string) =>
    value
        ? value.split(",").map((item) => item.trim()).filter(Boolean)
        : []

export function buildGirlTagsFromIds(ids: number[]): LanguageContent {
    const selected = ids
        .map((id) => GIRL_TAG_OPTIONS.find((option) => option.id === id))
        .filter((option): option is GirlTagOption => Boolean(option))

    return {
        en: selected.map((option) => option.en).join(","),
        zh: selected.map((option) => option.zh).join(","),
        th: selected.map((option) => option.th).join(","),
    }
}

export function matchGirlTagIds(tags?: LanguageContent | null): number[] | null {
    const en = splitTags(tags?.en)
    const zh = splitTags(tags?.zh)
    const th = splitTags(tags?.th)

    if (en.length === 0 && zh.length === 0 && th.length === 0) {
        return []
    }

    if (en.length !== zh.length || zh.length !== th.length) {
        return null
    }

    const ids = en.map((enTag, index) => {
        const match = GIRL_TAG_OPTIONS.find((option) =>
            option.en === enTag &&
            option.zh === zh[index] &&
            option.th === th[index]
        )

        return match?.id ?? null
    })

    return ids.some((id) => id === null) ? null : ids as number[]
}

export function hasGirlTagContent(tags?: LanguageContent | null): boolean {
    return Boolean(tags?.en?.trim() || tags?.zh?.trim() || tags?.th?.trim())
}
