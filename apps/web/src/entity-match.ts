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

const plain = (text: string) => normalize(text.toLowerCase().replace(/ё/g, 'е'))

export type EntityTerms = { terms: string[]; tight: string[] }

export const entityTerms = (entity: Entity): EntityTerms => {
  const names = [entity.name, entity.nameUk ?? ruToUk(entity.name), entity.nameEn, ...(entity.aliases?.split(',') ?? [])]
    .map((one) => one?.trim())
    .filter((one): one is string => !!one)
  const terms = [...new Set([...names.map(fold), ...names.map(plain)])]
  return { terms, tight: terms.map(tight) }
}

export const searchKey = (query: string) => {
  const q = fold(query.trim())
  const raw = plain(query.trim())
  return { q, raw, squeezed: tight(q) }
}

const begins = (terms: string[], q: string) => !!q && terms.some((term) => term.startsWith(q))

const wordBegins = (terms: string[], q: string) => !!q && terms.some((term) => term.split(/[^\p{L}\p{N}]+/u).some((word) => word.startsWith(q)))

export const matchTier = ({ terms, tight: tights }: EntityTerms, { q, raw, squeezed }: ReturnType<typeof searchKey>) =>
  begins(terms, q) || begins(terms, raw)
    ? 0
    : wordBegins(terms, q) || wordBegins(terms, raw)
      ? 1
      : squeezed && tights.some((term) => term.startsWith(squeezed))
        ? 1
        : -1
