import raw from './data/characters.json'

export type Character = {
  id: number
  name: string
  nameEn: string
  gender: string
  affiliations: string[]
  jutsuTypes: string[]
  kekkeiGenkai: string[]
  natureTypes: string[]
  attributes: string[]
  debutChapter: number
  arc: string
  arcIndex: number
  thumb: number
  answer: boolean
}

export const characters = raw as Character[]
const answerPool = characters.filter((c) => c.answer)

const base = import.meta.env.BASE_URL
export const atlasUrl = `${base}characters/thumbs.webp`
export const fullUrl = (c: Character) => `${base}characters/full/${c.id}.webp`

export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

export function preload(c: Character) {
  new Image().src = fullUrl(c)
}

const recent: number[] = []

export function pickAnswer(): Character {
  const fresh = answerPool.filter((c) => !recent.includes(c.id))
  const list = fresh.length ? fresh : answerPool
  const pick = list[Math.floor(Math.random() * list.length)]
  recent.push(pick.id)
  if (recent.length > 60) recent.shift()
  return pick
}
