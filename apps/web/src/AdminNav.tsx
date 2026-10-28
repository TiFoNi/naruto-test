'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { CrownIcon, FilmIcon, PaletteIcon, PuzzleIcon, TargetIcon, UsersIcon } from './icons'
import { useHref } from './router'

export default function AdminNav() {
  const href = useHref()
  const pathname = usePathname() ?? ''
  const tabs: { href: string; label: string; icon: ReactNode }[] = [
    { href: href.admin, label: 'Персонажи', icon: <UsersIcon /> },
    { href: href.adminShots, label: 'Кадры аниме', icon: <FilmIcon /> },
    { href: href.adminZoom, label: 'Точка зума', icon: <TargetIcon /> },
    { href: href.adminQuizzes, label: 'Тесты', icon: <PuzzleIcon /> },
    { href: href.adminTitles, label: 'Титулы', icon: <CrownIcon /> },
    { href: href.adminFrames, label: 'Рамки', icon: <PaletteIcon /> },
  ]
  const current = tabs.filter((tab) => pathname.startsWith(tab.href)).sort((a, b) => b.href.length - a.href.length)[0]

  return (
    <nav className="admin-nav" aria-label="Разделы админки">
      <span className="admin-nav-brand">Админка</span>
      <div className="admin-nav-tabs">
        {tabs.map((tab) => (
          <Link key={tab.href} href={tab.href} className={tab === current ? 'on' : ''} aria-current={tab === current ? 'page' : undefined}>
            {tab.icon}
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
