'use client'

import Link from 'next/link'
import { useEffect, useState, type CSSProperties } from 'react'
import { api } from './api'
import { useAuth } from './auth'
import BackButton from './BackButton'
import { BRAND } from './brand'
import { GAMES } from './games'
import { useI18n, type UiKey } from './i18n'
import { HeartIcon, PlusIcon, UsersIcon } from './icons'
import { coverUrl } from './quiz'
import type { SavedDraft } from './QuizBuilder'
import { useHref } from './router'

type Mine = SavedDraft & { plays: number; likes: number }

export default function QuizMine() {
  const { t, l } = useI18n()
  const href = useHref()
  const { user, loading } = useAuth()
  const [list, setList] = useState<Mine[] | null>(null)
  const [limit, setLimit] = useState(30)

  useEffect(() => {
    if (!user) return
    void api<{ quizzes?: Mine[]; limit?: number }>('my/quizzes').then(({ ok, data }) => {
      setList(ok ? (data.quizzes ?? []) : [])
      if (data.limit) setLimit(data.limit)
    })
  }, [user])

  const back = (
    <div className="play-nav">
      <BackButton href={href.home}>{t('play.back')}</BackButton>
    </div>
  )

  if (!loading && !user) {
    return (
      <div className="quiz-page qz-page">
        {back}
        <div className="qz-empty qb-login">
          <span className="qz-mark">{BRAND.mark}</span>
          <b>{t('qb.mine.login')}</b>
          <p>{t('qb.mine.lead')}</p>
          <Link className="quiz-btn" href={href.login}>
            {t('qb.mine.loginBtn')}
          </Link>
        </div>
      </div>
    )
  }

  const full = (list?.length ?? 0) >= limit

  return (
    <div className="quiz-page qz-page">
      {back}
      <div className="qz-main-top">
        <div>
          <small className="qz-kicker">{list ? t('qb.mine.count', { count: list.length, max: limit }) : ' '}</small>
          <h1>{t('qb.mine')}</h1>
        </div>
        <div className="qz-main-tools">
          {full ? (
            <span className="qz-action is-disabled">{t('qb.err.tooMany', { max: limit })}</span>
          ) : (
            <Link className="qz-action is-accent" href={href.makeTest()}>
              <PlusIcon />
              {t('qb.create')}
            </Link>
          )}
        </div>
      </div>

      {list === null ? (
        <div className="qz-grid">
          {[0, 1, 2, 3].map((one) => (
            <div key={one} className="qz-card is-ghost" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="qz-empty">
          <span className="qz-mark">{BRAND.mark}</span>
          <b>{t('qb.mine.empty')}</b>
          <p>{t('qb.mine.lead')}</p>
          <Link className="quiz-btn" href={href.makeTest()}>
            <PlusIcon />
            {t('qb.create')}
          </Link>
        </div>
      ) : (
        <div className="qz-grid">
          {list.map((quiz) => {
            const world = GAMES.find((one) => one.id === quiz.game)
            const art = coverUrl(quiz.game, quiz.cover)
            return (
              <Link key={quiz.id} className="qz-card qb-mine-card" href={href.makeTest({ id: quiz.id })}>
                <span className="qz-art">
                  {art ? <img src={art} alt="" loading="lazy" /> : <span className="qz-mark">{BRAND.mark}</span>}
                  <span className="qz-corner is-left">
                    <em className={`qz-badge qb-status is-${quiz.status}`}>{t(`qb.status.${quiz.status}` as UiKey)}</em>
                  </span>
                </span>
                <span className="qz-info">
                  {world && (
                    <em className="qz-world" style={{ '--world-accent': world.accent } as CSSProperties}>
                      <img src={`/worlds/${world.id}.webp`} alt="" loading="lazy" />
                      {l(world.label)}
                    </em>
                  )}
                  <b>{quiz.title || t('qb.newTitle')}</b>
                  <span className="qz-foot">
                    <small>{t('quiz.questions', { count: quiz.questions.length })}</small>
                    {quiz.status === 'published' && (
                      <span className="qz-stats">
                        <span>
                          <HeartIcon />
                          {quiz.likes}
                        </span>
                        <span>
                          <UsersIcon />
                          {quiz.plays}
                        </span>
                      </span>
                    )}
                  </span>
                  {quiz.status === 'rejected' && quiz.note && <span className="qb-mine-note">{t('qb.rejectNote', { note: quiz.note })}</span>}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
