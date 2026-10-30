'use client'

import AdminNav from './AdminNav'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { GAMES } from './games'
import { useI18n, type UiKey } from './i18n'
import type { QuizAuthor } from './quiz'
import QuizBuilder, { freshDraft, type Draft, type SavedDraft } from './QuizBuilder'
import { useHref } from './router'

type Saved = SavedDraft & { author?: QuizAuthor | null }

type Filter = 'all' | 'review' | 'official' | 'players'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'review', label: 'На проверке' },
  { id: 'official', label: 'Наши' },
  { id: 'players', label: 'От игроков' },
]

export default function QuizAdmin() {
  const { l, t } = useI18n()
  const href = useHref()
  const [list, setList] = useState<Saved[] | null>(null)
  const [denied, setDenied] = useState(false)
  const [open, setOpen] = useState<Saved | Draft | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [session, setSession] = useState(0)
  const show = (quiz: Saved | Draft) => {
    setOpen(quiz)
    setSession((current) => current + 1)
  }

  const load = useCallback(async () => {
    const { ok, status, data } = await api<{ quizzes?: Saved[] }>('admin/quizzes')
    if (status === 404) return setDenied(true)
    setList(ok ? (data.quizzes ?? []) : [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const waiting = useMemo(() => (list ?? []).filter((one) => one.status === 'review').length, [list])
  const shown = useMemo(
    () =>
      (list ?? []).filter((one) =>
        filter === 'review' ? one.status === 'review' : filter === 'official' ? !one.author : filter === 'players' ? !!one.author : true,
      ),
    [list, filter],
  )

  if (denied) return <div className="card center muted">Страница не найдена</div>

  const author = open && 'author' in open && open.author ? open.author : null

  return (
    <div className="admin quiz-admin page-main">
      <AdminNav />
      <header className="admin-bar">
        <div className="admin-bar-main">
          <h1>Тесты</h1>
          <button type="button" className="primary" onClick={() => show(freshDraft('naruto'))}>
            Новый тест
          </button>
        </div>
      </header>

      <div className="quiz-admin-body">
        <aside className="card quiz-admin-side">
          <div className="quiz-admin-filters">
            {FILTERS.map((one) => (
              <button key={one.id} type="button" className={filter === one.id ? 'on' : ''} onClick={() => setFilter(one.id)}>
                {one.label}
                {one.id === 'review' && waiting > 0 && <em>{waiting}</em>}
              </button>
            ))}
          </div>
          <ul className="quiz-admin-list">
            {list === null && <li className="muted">Загрузка…</li>}
            {list !== null && shown.length === 0 && <li className="muted">Тут пусто</li>}
            {shown.map((one) => {
              const world = GAMES.find((game) => game.id === one.game)
              return (
                <li key={one.id}>
                  <button type="button" className={open && 'id' in open && open.id === one.id ? 'on' : ''} onClick={() => show(one)}>
                    <b>{one.title}</b>
                    <small>
                      <span className={`qb-status is-${one.status}`}>{t(`qb.status.${one.status}` as UiKey)}</span>
                      {world ? l(world.label) : one.game} · {one.questions.length} вопр.
                      {one.author && <> · {one.author.nickname}</>}
                    </small>
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

        {open ? (
          <QuizBuilder
            key={session}
            mode="admin"
            draft={open}
            author={
              author && (
                <div className="quiz-admin-field">
                  <span className="quiz-admin-label">Автор</span>
                  <Link className="qb-author" href={href.player(author.id)} target="_blank">
                    {author.nickname}
                    {author.tag && <small>#{author.tag}</small>}
                  </Link>
                </div>
              )
            }
            onSaved={(saved) => {
              const full = { ...saved, author }
              setList((current) => [full, ...(current ?? []).filter((one) => one.id !== saved.id)])
              setOpen(full)
            }}
            onDropped={(id) => {
              setList((current) => (current ?? []).filter((one) => one.id !== id))
              setOpen(null)
            }}
          />
        ) : (
          <div className="card center muted">Выбери тест слева или создай новый</div>
        )}
      </div>
    </div>
  )
}
