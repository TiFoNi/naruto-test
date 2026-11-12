import { ruToUk } from './i18n'
import type { Entity } from './games/types'
import { normalize, tight } from './util'

const SOFT = /(дз|т|с)(?=[ёюяи])/g
const HARD: Record<string, string> = { дз: 'дж', т: 'ч', с: 'ш' }
const LONE_D = /(^|[^\p{L}])ди(?=[^\p{L}]|$)/gu

export const fold = (text: string) =>
  normalize(
    text
      .toLowerCase()
      .replace(SOFT, (one) => HARD[one])
      .replace(/([чшж])ё/g, '$1о')
      .replace(/([чшж])ю/g, '$1у')
      .replace(/([чшж])я/g, '$1а')
      .replace(/дз/g, 'з')
      .replace(/э|є/g, 'е')
      .replace(/[ьъ]/g, '')
      .replace(/[іїы]/g, 'и')
      .replace(/ґ/g, 'г')
      .replace(/×/g, 'x')
      .replace(LONE_D, '$1д'),
  )

export type EntityTerms = { terms: string[]; tight: string[] }

export const entityTerms = (entity: Entity): EntityTerms => {
  const terms = [entity.name, entity.nameUk ?? ruToUk(entity.name), entity.nameEn, ...(entity.aliases?.split(',') ?? [])]
    .map((one) => one?.trim())
    .filter((one): one is string => !!one)
    .map(fold)
  return { terms, tight: terms.map(tight) }
}

export const searchKey = (query: string) => {
  const q = fold(query.trim())
  return { q, squeezed: tight(q) }
}

export const matchTier = ({ terms, tight: tights }: EntityTerms, { q, squeezed }: ReturnType<typeof searchKey>) =>
  terms.some((term) => term.startsWith(q))
    ? 0
    : terms.some((term) => term.split(/[^\p{L}\p{N}]+/u).some((word) => word.startsWith(q)))
      ? 1
      : squeezed && tights.some((term) => term.startsWith(squeezed))
        ? 1
        : -1
