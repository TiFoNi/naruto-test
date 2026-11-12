import { ruToUk } from './i18n'
import type { Entity } from './games/types'
import { normalize, tight } from './util'

export type EntityTerms = { terms: string[]; tight: string[] }

export const entityTerms = (entity: Entity): EntityTerms => {
  const terms = [entity.name, entity.nameUk ?? ruToUk(entity.name), entity.nameEn, ...(entity.aliases?.split(',') ?? [])]
    .map((one) => one?.trim())
    .filter((one): one is string => !!one)
    .map(normalize)
  return { terms, tight: terms.map(tight) }
}

export const searchKey = (query: string) => {
  const q = normalize(query.trim())
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
