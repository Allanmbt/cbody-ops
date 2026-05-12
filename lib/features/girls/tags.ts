import type { LanguageContent } from "./types"

export interface GirlTagOption {
    id: number
    en: string
    zh: string
    th: string
}

export const GIRL_TAG_OPTIONS: GirlTagOption[] = [
    { id: 1, en: "Fair-Skin", zh: "白皙", th: "ผิวขาว" },
    { id: 2, en: "Cute", zh: "可爱", th: "น่ารัก" },
    { id: 3, en: "Sunny", zh: "元气", th: "สดใส" },
    { id: 4, en: "Classy", zh: "气质", th: "มีคลาส" },
    { id: 5, en: "Gentle", zh: "温柔", th: "อ่อนโยน" },
    { id: 6, en: "Aura", zh: "氛围", th: "ฟีลดี" },
    { id: 7, en: "Fresh", zh: "清新", th: "ลุคใส" },
    { id: 8, en: "Sweet", zh: "甜美", th: "หวาน" },
    { id: 9, en: "Mature", zh: "成熟", th: "ผู้ใหญ่" },
    { id: 10, en: "Natural", zh: "自然", th: "ธรรมชาติ" },
    { id: 11, en: "Leggy", zh: "长腿", th: "ขายาว" },
    { id: 12, en: "Waist", zh: "细腰", th: "เอวสวย" },
    { id: 13, en: "Slim", zh: "纤细", th: "หุ่นบาง" },
    { id: 14, en: "Toned", zh: "健美", th: "หุ่นฟิต" },
    { id: 15, en: "Lean", zh: "苗条", th: "หุ่นเพรียว" },
    { id: 16, en: "Curvy", zh: "丰盈", th: "มีทรง" },
    { id: 17, en: "Petite", zh: "小巧", th: "ตัวเล็ก" },
    { id: 18, en: "Tall", zh: "高挑", th: "สูง" },
    { id: 19, en: "Calm", zh: "安静", th: "สงบ" },
    { id: 20, en: "Chatty", zh: "健谈", th: "คุยเก่ง" },
    { id: 21, en: "Patient", zh: "耐心", th: "ใจเย็น" },
    { id: 22, en: "Friendly", zh: "亲和", th: "เป็นกันเอง" },
    { id: 23, en: "Warm", zh: "暖心", th: "อบอุ่น" },
    { id: 24, en: "Cheerful", zh: "开朗", th: "ร่าเริง" },
    { id: 25, en: "Steady", zh: "力稳", th: "แรงนิ่ง" },
    { id: 26, en: "Rhythm", zh: "节奏", th: "จังหวะดี" },
    { id: 27, en: "Caring", zh: "走心", th: "ใส่ใจ" },
    { id: 28, en: "Skilled", zh: "熟练", th: "ชำนาญ" },
    { id: 29, en: "Relaxing", zh: "放松", th: "ผ่อนคลาย" },
    { id: 30, en: "Pro", zh: "专业", th: "โปร" },
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
