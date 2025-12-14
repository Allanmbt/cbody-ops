"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Locale, getTranslation } from './index'

interface LocaleContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: any
}

const LocaleContext = createContext<LocaleContextType>({
  locale: 'zh',
  setLocale: () => {},
  t: {},
})

/**
 * 语言 Context Provider
 * 提供全局语言状态管理和翻译对象
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('zh')
  const [t, setT] = useState(() => getTranslation('zh'))

  // 初始化：从 localStorage 读取语言设置
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLocale = localStorage.getItem('locale') as Locale
      if (savedLocale && (savedLocale === 'zh' || savedLocale === 'th')) {
        setLocaleState(savedLocale)
        setT(getTranslation(savedLocale))
      }
    }
  }, [])

  // 切换语言
  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale)
    setT(getTranslation(newLocale))
    if (typeof window !== 'undefined') {
      localStorage.setItem('locale', newLocale)
    }
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  )
}

/**
 * 使用语言 Hook
 */
export function useLocale() {
  return useContext(LocaleContext)
}
