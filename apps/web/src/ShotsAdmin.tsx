'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { api, apiUrl } from './api'
import { useHref } from './router'

type Title = { id: number; name?: string; nameEn?: string; year?: number; frames?: number[]; ver?: string; answer?: boolean }

const LEVELS = [
  { id: 0, label: 'Сложный' },
  { id: 1, label: 'Средний' },
  { id: 2, label: 'Лёгкий' },
  { id: 3, label: 'Очень лёгкий' },
]

const FILTERS = [
  { id: 'all', label: 'все' },
  { id: 'filled', label: 'с кадрами' },
  { id: 'empty', label: 'пустые' },
] as const

type Filter = (typeof FILTERS)[number]['id']

const countsOf = (title: Title) => Array.from({ length: LEVELS.length }, (_, level) => title.frames?.[level] ?? 0)

const total = (title: Title) => countsOf(title).reduce((sum, count) => sum + count, 0)

export default function ShotsAdmin() {
  const href = useHref()
  const [titles, setTitles] = useState<Title[] | null>(null)
  const [pics, setPics] = useState('')
  const [denied, setDenied] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [openId, setOpenId] = useState<number | null>(null)
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    const { ok, status, data } = await api<{ titles?: Title[]; pics?: string }>('admin/shots')
    if (status === 404) return setDenied(true)
    if (!ok) return setTitles([])
    setTitles(data.titles ?? [])
    setPics(data.pics ?? '')
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const replace = useCallback((title: Title) => {
    setTitles((kept) => (kept ? kept.map((one) => (one.id === title.id ? title : one)) : kept))
  }, [])

  const counts = useMemo(() => {
    const list = titles ?? []
    return {
      all: list.length,
      filled: list.filter((one) => total(one) > 0).length,
      empty: list.filter((one) => total(one) === 0).length,
    }
  }, [titles])

  const shown = useMemo(() => {
    const list = titles ?? []
    const needle = query.trim().toLowerCase()
    return list.filter((one) => {
      const full = total(one)
      if (filter === 'filled' && !full) return false
      if (filter === 'empty' && full) return false
      if (!needle) return true
      return `${one.name ?? ''} ${one.nameEn ?? ''} ${one.id}`.toLowerCase().includes(needle)
    })
  }, [titles, query, filter])

  if (denied) return <div className="card center muted">Страница не найдена</div>

  return (
    <main className="admin shots-admin">
      <header className="admin-bar">
        <div className="admin-bar-main">
          <h1>Кадры аниме</h1>
          <Link className="admin-more" href={href.admin}>
            Персонажи
          </Link>
          <Link className="admin-more" href={href.adminZoom}>
            Точка зума
          </Link>
          <label className="admin-search">
            <svg viewBox="0 0 24 24" aria-hidden>
              <circle cx="11" cy="11" r="6.5" />
              <path d="M16 16l4.5 4.5" />
            </svg>
            <input placeholder="Поиск по названию" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <span className={`admin-note ${note ? 'on' : ''}`}>{note}</span>
        </div>

        <div className="admin-bar-filters">
          {FILTERS.map(({ id, label }) => (
            <button key={id} type="button" className={filter === id ? 'on' : ''} onClick={() => setFilter(id)}>
              {label}
              <em>{counts[id]}</em>
            </button>
          ))}
          <span className="admin-found">{query.trim() ? `найдено ${shown.length}` : ''}</span>
        </div>
      </header>

      {titles === null ? (
        <div className="card center muted">Загрузка…</div>
      ) : (
        <ul className="shots-list">
          {shown.map((title) => {
            const own = countsOf(title)
            const full = total(title)
            return (
              <li key={title.id} className={`shots-row ${full ? '' : 'is-empty'} ${openId === title.id ? 'is-open' : ''}`}>
                <button type="button" className="shots-head" onClick={() => setOpenId(openId === title.id ? null : title.id)}>
                  <span className="shots-mark">{full || '—'}</span>
                  <span className="shots-name">
                    <b>{title.name ?? title.id}</b>
                    <small>
                      {title.nameEn ?? ''}
                      {title.year ? ` · ${title.year}` : ''}
                    </small>
                  </span>
                  <span className="shots-levels">
                    {own.map((count, level) => (
                      <em key={level} className={count ? 'on' : ''} title={LEVELS[level].label}>
                        {count}
                      </em>
                    ))}
                  </span>
                </button>

                {openId === title.id && <Frames title={title} pics={pics} onDone={replace} onNote={setNote} />}
              </li>
            )
          })}
          {!shown.length && <li className="card center muted">ничего не найдено</li>}
        </ul>
      )}
    </main>
  )
}

function Frames({
  title,
  pics,
  onDone,
  onNote,
}: {
  title: Title
  pics: string
  onDone: (title: Title) => void
  onNote: (note: string) => void
}) {
  const [busy, setBusy] = useState<number | null>(null)
  const [shown, setShown] = useState<{ level: number; index: number } | null>(null)
  const counts = countsOf(title)
  const frameUrl = (level: number, index: number) =>
    `${pics}/shots/frames/${title.id}/${level}/${index}.webp?v=${title.ver ?? ''}`

  const say = (text: string) => {
    onNote(text)
    setTimeout(() => onNote(''), 2500)
  }

  const send = async (level: number, files: FileList | null) => {
    if (!files?.length) return
    setBusy(level)
    const form = new FormData()
    form.append('id', String(title.id))
    form.append('level', String(level))
    for (const file of Array.from(files)) form.append('file', file)

    const answer = await fetch(apiUrl('admin/shots/frame'), { method: 'POST', body: form, credentials: 'include' })
    const data = (await answer.json().catch(() => ({}))) as { title?: Title; error?: string }
    setBusy(null)
    if (!answer.ok || !data.title) return say(data.error === 'too_large' ? 'файл больше 12 МБ' : 'не вышло загрузить')
    onDone(data.title)
    say(`добавлено ${files.length}`)
  }

  const drop = async (level: number, index: number) => {
    if (!confirm('Удалить кадр?')) return
    setBusy(level)
    const { ok, data } = await api<{ title?: Title }>('admin/shots/drop', { id: title.id, level, index })
    setBusy(null)
    if (!ok || !data.title) return say('не вышло удалить')
    onDone(data.title)
    say('кадр удалён')
  }

  return (
    <div className="shots-body">
      {LEVELS.map(({ id: level, label }) => (
        <section key={level} className="shots-level">
          <header>
            <b>{label}</b>
            <span>{counts[level]}</span>
          </header>

          <div className="shots-tiles">
            {Array.from({ length: counts[level] }, (_, index) => (
              <figure key={`${title.ver}-${index}`} className="shots-tile">
                <button type="button" className="shots-open" onClick={() => setShown({ level, index })} aria-label="Открыть кадр">
                  <img src={frameUrl(level, index)} alt="" loading="lazy" />
                </button>
                <button type="button" className="shots-drop" onClick={() => void drop(level, index)} aria-label="Удалить кадр">
                  ✕
                </button>
              </figure>
            ))}

            <label className={`shots-add ${busy === level ? 'is-busy' : ''}`}>
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={busy !== null}
                onChange={(event) => {
                  void send(level, event.target.files)
                  event.target.value = ''
                }}
              />
              <span>{busy === level ? '…' : '+'}</span>
            </label>
          </div>
        </section>
      ))}

      {shown && (
        <Viewer
          title={title}
          counts={counts}
          shown={shown}
          url={frameUrl(shown.level, shown.index)}
          onShow={setShown}
          onClose={() => setShown(null)}
        />
      )}
    </div>
  )
}

const walk = (counts: number[], shown: { level: number; index: number }, step: number) => {
  const flat = counts.flatMap((count, level) => Array.from({ length: count }, (_, index) => ({ level, index })))
  const at = flat.findIndex((one) => one.level === shown.level && one.index === shown.index)
  return flat[(at + step + flat.length) % flat.length] ?? shown
}

function Viewer({
  title,
  counts,
  shown,
  url,
  onShow,
  onClose,
}: {
  title: Title
  counts: number[]
  shown: { level: number; index: number }
  url: string
  onShow: (shown: { level: number; index: number }) => void
  onClose: () => void
}) {
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') onShow(walk(counts, shown, 1))
      if (event.key === 'ArrowLeft') onShow(walk(counts, shown, -1))
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [counts, shown, onShow, onClose])

  const save = async () => {
    const answer = await fetch(url).catch(() => null)
    if (!answer?.ok) return void window.open(url, '_blank', 'noreferrer')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(await answer.blob())
    link.download = `${title.id}-${LEVELS[shown.level].label}-${shown.index}.webp`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <div className="shots-view" onClick={onClose} role="presentation">
      <figure onClick={(event) => event.stopPropagation()}>
        <img src={url} alt="" />
        <figcaption>
          <span>
            {title.name ?? title.id} · {LEVELS[shown.level].label} · кадр {shown.index + 1}
          </span>
          <button type="button" onClick={() => onShow(walk(counts, shown, -1))} aria-label="Предыдущий">
            ‹
          </button>
          <button type="button" onClick={() => onShow(walk(counts, shown, 1))} aria-label="Следующий">
            ›
          </button>
          <a href={url} target="_blank" rel="noreferrer">
            Открыть
          </a>
          <button type="button" onClick={() => void save()}>
            Скачать
          </button>
          <button type="button" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </figcaption>
      </figure>
    </div>
  )
}
