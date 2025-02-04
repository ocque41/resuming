'use client'

import { createContext, useContext, ReactNode } from 'react'

type I18nContextType = {
  t: (key: string) => string
}

const defaultTranslations = {
  'theme.toggle.label': 'Toggle theme',
  'theme.light': 'Light mode',
  'theme.dark': 'Dark mode',
  'theme.switch.to': 'Switch to {mode} mode',
}

const I18nContext = createContext<I18nContextType>({
  t: (key: string) => {
    return defaultTranslations[key as keyof typeof defaultTranslations] || key
  },
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const value = {
    t: (key: string) => {
      return defaultTranslations[key as keyof typeof defaultTranslations] || key
    },
  }

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export const useI18n = () => useContext(I18nContext)
