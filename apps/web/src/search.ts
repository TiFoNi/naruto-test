import type { GameId } from '@nanda/game'
import type { GameMeta } from './games/meta'

const FOLD: Record<string, string> = {
  і: 'и',
  ї: 'и',
  ы: 'и',
  й: 'и',
  є: 'е',
  э: 'е',
  ё: 'е',
  ґ: 'г',
  ъ: '',
  ь: '',
}

export const fold = (value: string) =>
  value
    .toLowerCase()
    .replace(/[іїыйєэёґъь]/g, (letter) => FOLD[letter])
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

const ALIASES: Partial<Record<GameId, string[]>> = {
  aot: ['аот', 'шингеки', 'сінгекі', 'shingeki', 'титаны', 'титани', 'titans'],
  avatar: ['аанг', 'aang', 'последний маг воздуха', 'останній маг повітря', 'the last airbender'],
  bc: ['блэк кловер', 'блек кловер', 'аста', 'asta'],
  berserk: ['гатс', 'гатc', 'guts'],
  bleach: ['ичиго', 'ічіго', 'ichigo'],
  dn: ['дэт нот', 'дет ноут', 'лайт', 'кира', 'кіра', 'kira'],
  dota: ['дота', 'дота 2', 'доту'],
  ff: ['фаер форс', 'фаєр форс', 'энэн', 'енен'],
  hxh: ['хх', 'хантер х хантер', 'hunter x hunter', 'гон', 'gon'],
  jojo: ['jojo bizarre', 'джостар', 'jostar', 'стенд'],
  kny: ['кимецу', 'кімецу', 'kimetsu', 'клинок демонов', 'клинок демонів', 'танджиро', 'танджіро'],
  manga: ['тайтлы', 'тайтли', 'titles'],
  mk: ['мк', 'мортал', 'скорпион', 'скорпіон', 'саб зиро', 'саб зіро'],
  naruto: ['шиппуден', 'шіппуден', 'shippuden', 'коноха', 'konoha'],
  onepiece: ['ванпис', 'ванпіс', 'луффи', 'луффі', 'luffy'],
  se: ['soul eater', 'мака', 'maka'],
  tg: ['токио гуль', 'токіо гуль', 'канеки', 'канекі', 'kaneki'],
}

const keysOf = (game: GameMeta) => [game.label.ru, game.label.uk, game.label.en, game.id, ...(ALIASES[game.id] ?? [])].map(fold)

const MISS = Number.POSITIVE_INFINITY

const scoreOf = (key: string, query: string) => {
  if (key === query) return 0
  if (key.startsWith(query)) return 1
  if (key.split(' ').some((word) => word.startsWith(query))) return 2
  if (key.includes(query)) return 3
  return MISS
}

export function searchGames(games: GameMeta[], query: string) {
  const wanted = fold(query)
  if (!wanted) return null

  const worst = wanted.length < 3 ? 2 : 3

  return games
    .map((game) => ({ game, score: Math.min(...keysOf(game).map((key) => scoreOf(key, wanted))) }))
    .filter((hit) => hit.score <= worst)
    .sort((a, b) => a.score - b.score || a.game.label.en.localeCompare(b.game.label.en))
    .map((hit) => hit.game)
}
