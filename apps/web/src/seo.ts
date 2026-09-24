import type { Metadata } from 'next'
import { SITE } from './brand'
import { gameMeta } from './games/meta.server'
import ui from './i18n/ui'

const MODE_LABEL: Record<string, string> = {
  classic: ui['mode.classic'].ru,
  image: ui['mode.image'].ru,
  ability: ui['mode.ability'].ru,
  page: ui['mode.page'].ru,
}

const plural = (count: number, one: string, few: string, many: string) => {
  const mod100 = count % 100
  if (mod100 >= 11 && mod100 <= 14) return many
  const mod10 = count % 10
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}

export function playMetadata(gameId: string, modeId: string, daily: boolean): Metadata {
  const game = gameMeta().find((g) => g.id === gameId)
  if (!game) return {}

  const mode = MODE_LABEL[modeId] ?? modeId
  const kind = game.unit === 'manga' ? 'тайтл' : game.unit === 'hero' ? 'героя' : 'персонажа'
  const title = `${game.label.ru} — угадай ${kind} ${mode.toLowerCase()}${daily ? ', персонаж дня' : ''}`
  const counted =
    game.unit === 'manga'
      ? plural(game.count, 'тайтл', 'тайтла', 'тайтлов')
      : plural(game.count, 'персонаж', 'персонажа', 'персонажей')
  const description = `${game.description.ru} ${game.count} ${counted}, подсказки после каждой попытки, без лимитов на день.`
  const path = `/play/${gameId}/${modeId}${daily ? '/daily' : ''}`

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: `${SITE}${path}`, type: 'website' },
  }
}
