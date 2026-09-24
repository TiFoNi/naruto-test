import { usePathname, useRouter } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react'
import ui, { LANGS, type L10n, type Lang, type UiKey } from './ui'
import { useTerms } from '../terms'

export { LANGS }
export type { L10n, Lang, UiKey }

const STORAGE_KEY = 'lang'

export function ruToUk(text: string) {
  return text
    .replace(/ьё/g, 'ьо')
    .replace(/(^|[\s\-аеёиоуыэюяАЕЁИОУЫЭЮЯ])Ё/g, '$1Йо')
    .replace(/(^|[\s\-аеёиоуыэюяАЕЁИОУЫЭЮЯ])ё/g, '$1йо')
    .replace(/ё/g, 'ьо')
    .replace(/и/g, 'і')
    .replace(/И/g, 'І')
    .replace(/ы/g, 'и')
    .replace(/э/g, 'е')
    .replace(/Э/g, 'Е')
    .replace(/ъ/g, '’')
}

type Named = { name: string; nameEn?: string; nameUk?: string }

type I18n = {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: UiKey, vars?: Record<string, string | number>) => string
  l: (text: L10n) => string
  tv: (value: string) => string
  name: (entity: Named) => string
  alt: (entity: Named) => string | undefined
  error: (code: string) => string
}

const I18nContext = createContext<I18n | null>(null)

export function I18nProvider({ children, lang }: { children: ReactNode; lang: Lang }) {
  const router = useRouter()
  const pathname = usePathname()
  const dictionary = useTerms()

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      return
    }
  }, [lang])

  const setLang = useCallback(
    (next: Lang) => {
      const rest = pathname.split('/').slice(2).join('/')
      router.push(`/${next}${rest ? `/${rest}` : ''}`)
    },
    [pathname, router],
  )

  const value = useMemo<I18n>(() => {
    const index = lang === 'uk' ? 0 : 1
    const ukNames = new Map<string, string>()
    const t: I18n['t'] = (key, vars) =>
      (ui[key]?.[lang] ?? key).replace(/\{(\w+)\}/g, (_, k: string) => String(vars?.[k] ?? `{${k}}`))
    const name: I18n['name'] = (entity) => {
      if (lang === 'en') return entity.nameEn ?? entity.name
      if (lang === 'ru') return entity.name
      if (entity.nameUk) return entity.nameUk
      let uk = ukNames.get(entity.name)
      if (!uk) {
        uk = ruToUk(entity.name)
        ukNames.set(entity.name, uk)
      }
      return uk
    }
    return {
      lang,
      setLang,
      t,
      l: (text) => text[lang],
      tv: (v) => (lang === 'ru' ? v : (dictionary[v]?.[index] || v)),
      name,
      alt: (entity) => {
        const secondary = lang === 'en' ? entity.name : entity.nameEn
        return secondary && secondary !== name(entity) ? secondary : undefined
      },
      error: (code) => (`err.${code}` in ui ? t(`err.${code}` as UiKey) : t('err.server')),
    }
  }, [lang, setLang, dictionary])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useI18n must be used inside I18nProvider')
  return value
}
