import type { ReactNode } from 'react'
import { GridIcon, PageIcon, PictureIcon, SparkIcon } from './icons'
import type { UiKey } from './i18n/ui'
import type { Category } from './games/types'
import type { ModeId } from './games/specs'

export type { ModeId }

export const MODES: { id: ModeId; label: UiKey; description: UiKey; icon: ReactNode }[] = [
  { id: 'classic', label: 'mode.classic', description: 'mode.classic.desc', icon: <GridIcon /> },
  { id: 'image', label: 'mode.image', description: 'mode.image.desc', icon: <PictureIcon /> },
  { id: 'ability', label: 'mode.ability', description: 'mode.ability.desc', icon: <SparkIcon /> },
  { id: 'page', label: 'mode.page', description: 'mode.page.desc', icon: <PageIcon /> },
]

export const UPCOMING_MODES: { label: UiKey; categories: Category[] }[] = [
  { label: 'mode.cover', categories: ['anime'] },
  { label: 'mode.quote', categories: ['anime', 'games'] },
]
