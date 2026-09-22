import type { ModeId } from '../../src/games/specs.js'
import { abilitiesOf } from './abilities.js'

export function roundExtra(mode: ModeId, answerId: number, roll = Math.random()) {
  if (mode !== 'ability') return undefined
  const list = abilitiesOf(answerId)
  return list.length ? list[Math.floor(roll * list.length)].key : undefined
}
