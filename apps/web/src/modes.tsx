import type { ReactNode } from 'react'
import { GridIcon, HashIcon, PageIcon, PictureIcon, SoundIcon, SparkIcon, UserIcon } from './icons'
import type { UiKey } from './i18n/ui'
import type { ModeId } from '@nanda/game'

export type { ModeId }

export const MODES: { id: ModeId; label: UiKey; description: UiKey; icon: ReactNode }[] = [
  { id: 'classic', label: 'mode.classic', description: 'mode.classic.desc', icon: <GridIcon /> },
  { id: 'image', label: 'mode.image', description: 'mode.image.desc', icon: <PictureIcon /> },
  { id: 'ability', label: 'mode.ability', description: 'mode.ability.desc', icon: <SparkIcon /> },
  { id: 'page', label: 'mode.page', description: 'mode.page.desc', icon: <PageIcon /> },
  { id: 'phrase', label: 'mode.phrase', description: 'mode.phrase.desc', icon: <SoundIcon /> },
  { id: 'who', label: 'mode.who', description: 'mode.who.desc', icon: <UserIcon /> },
  { id: 'grid', label: 'mode.grid', description: 'mode.grid.desc', icon: <HashIcon /> },
]
