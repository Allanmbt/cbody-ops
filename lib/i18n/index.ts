import zhTranslations from './locales/zh.json'
import thTranslations from './locales/th.json'

export type Locale = 'zh' | 'th'

const translations = {
  zh: zhTranslations,
  th: thTranslations,
}

/**
 * 获取指定语言的翻译对象
 */
export function getTranslation(locale: Locale = 'zh') {
  return translations[locale] || translations.zh
}

/**
 * 从嵌套对象中获取翻译值
 * @param obj 翻译对象
 * @param path 路径，如 'configs.bankAccounts.title'
 * @param defaultValue 默认值
 */
export function t(obj: any, path: string, defaultValue: string = ''): string {
  const keys = path.split('.')
  let result = obj
  for (const key of keys) {
    result = result?.[key]
    if (result === undefined) return defaultValue
  }
  return result
}

/**
 * 语言配置
 */
export const localeConfig = {
  zh: {
    label: '中文',
    flag: '🇨🇳',
  },
  th: {
    label: 'ไทย',
    flag: '🇹🇭',
  },
} as const
