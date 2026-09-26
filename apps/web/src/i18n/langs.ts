export type Lang = 'ru' | 'uk' | 'en'

export type L10n = Record<Lang, string>

export const LANGS: { id: Lang; label: string }[] = [
  { id: 'ru', label: 'RU' },
  { id: 'uk', label: 'UK' },
  { id: 'en', label: 'EN' },
]
