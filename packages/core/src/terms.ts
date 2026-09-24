import { terms } from './db'

export type Dictionary = Record<string, [uk: string, en: string]>

const TTL = 60_000

let cache: { at: number; data: Dictionary } | null = null
let loading: Promise<Dictionary> | null = null

async function load(): Promise<Dictionary> {
  const list = await (await terms()).find({}, { projection: { _id: 0 } }).toArray()
  const data: Dictionary = {}
  for (const { value, uk, en } of list) data[value] = [uk, en]
  cache = { at: Date.now(), data }
  return data
}

export async function dictionary(): Promise<Dictionary> {
  if (cache && Date.now() - cache.at < TTL) return cache.data
  loading ??= load().finally(() => {
    loading = null
  })
  return loading
}

export const forgetTerms = () => {
  cache = null
}
