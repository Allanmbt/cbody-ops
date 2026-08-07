export const PRIVATE_SKIN_TONE_CODES = [
  "very_fair",
  "fair",
  "light",
  "light_medium",
  "medium",
  "tan",
  "deep",
] as const

export type PrivateSkinToneCode = (typeof PRIVATE_SKIN_TONE_CODES)[number]

export const PRIVATE_SKIN_TONE_OPTIONS: ReadonlyArray<{
  code: PrivateSkinToneCode
  label: string
  english: string
}> = [
  { code: "very_fair", label: "冷白", english: "Very Fair" },
  { code: "fair", label: "白皙", english: "Fair" },
  { code: "light", label: "浅肤", english: "Light" },
  { code: "light_medium", label: "自然偏白", english: "Light-Medium" },
  { code: "medium", label: "自然肤色", english: "Medium" },
  { code: "tan", label: "小麦肤色", english: "Tan" },
  { code: "deep", label: "深肤色", english: "Deep" },
]

export function isPrivateSkinToneCode(value: unknown): value is PrivateSkinToneCode {
  return typeof value === "string" && PRIVATE_SKIN_TONE_CODES.includes(value as PrivateSkinToneCode)
}

export const PRIVATE_BODY_TYPE_CODES = [
  "petite",
  "slim",
  "balanced",
  "toned",
  "athletic",
  "curvy",
  "full_figured",
  "tall_lean",
] as const

export type PrivateBodyTypeCode = (typeof PRIVATE_BODY_TYPE_CODES)[number]

export const PRIVATE_BODY_TYPE_OPTIONS: ReadonlyArray<{
  code: PrivateBodyTypeCode
  label: string
  english: string
}> = [
  { code: "petite", label: "娇小", english: "Petite" },
  { code: "slim", label: "纤细", english: "Slim" },
  { code: "balanced", label: "匀称", english: "Balanced" },
  { code: "toned", label: "紧致", english: "Toned" },
  { code: "athletic", label: "健美", english: "Athletic" },
  { code: "curvy", label: "曲线型", english: "Curvy" },
  { code: "full_figured", label: "丰满", english: "Full-Figured" },
  { code: "tall_lean", label: "大长腿", english: "Tall & Lean" },
]

export function isPrivateBodyTypeCode(value: unknown): value is PrivateBodyTypeCode {
  return typeof value === "string" && PRIVATE_BODY_TYPE_CODES.includes(value as PrivateBodyTypeCode)
}

export const PRIVATE_PROFILE_TAG_CODES = [
  "natural",
  "peachy",
  "mandarin",
  "fair",
  "sweet_sexy",
  "boss",
  "petite",
  "college",
  "top",
  "vibes",
  "genz",
  "gorgeous",
  "chatty",
  "attentive",
  "gfe",
  "sweetheart",
  "stockings",
  "milf",
] as const

export type PrivateProfileTagCode = (typeof PRIVATE_PROFILE_TAG_CODES)[number]

export const PRIVATE_PROFILE_TAG_OPTIONS: ReadonlyArray<{
  code: PrivateProfileTagCode
  label: string
  english: string
}> = [
  { code: "natural", label: "天然🐻", english: "Natural Bust" },
  { code: "peachy", label: "蜜桃臀", english: "Peachy" },
  { code: "mandarin", label: "中文好", english: "Mandarin" },
  { code: "fair", label: "嫩白肤", english: "Fair Skin" },
  { code: "sweet_sexy", label: "纯欲风", english: "Sweet & Sexy" },
  { code: "boss", label: "御姐", english: "Boss Lady" },
  { code: "petite", label: "萝莉感", english: "Petite" },
  { code: "college", label: "大学生", english: "College Girl" },
  { code: "top", label: "顶美", english: "Top-Tier" },
  { code: "vibes", label: "情绪价值", english: "Good Vibes" },
  { code: "genz", label: "00后", english: "Gen Z" },
  { code: "gorgeous", label: "高颜值", english: "Gorgeous" },
  { code: "chatty", label: "健谈", english: "Chatty" },
  { code: "attentive", label: "服务好", english: "Attentive" },
  { code: "gfe", label: "女友感", english: "GFE" },
  { code: "sweetheart", label: "初恋感", english: "Sweetheart" },
  { code: "stockings", label: "丝袜女王", english: "Stocking Queen" },
  { code: "milf", label: "妈妈感", english: "MILF Vibe" },
]

export function isPrivateProfileTagCode(value: unknown): value is PrivateProfileTagCode {
  return typeof value === "string" && PRIVATE_PROFILE_TAG_CODES.includes(value as PrivateProfileTagCode)
}
