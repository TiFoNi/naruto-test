'use client'

import Link from 'next/link'
import { useEffect, useState, type CSSProperties } from 'react'
import { api } from './api'
import { useAuth } from './auth'
import BackButton from './BackButton'
import { BRAND } from './brand'
import { GAMES } from './games'
import { useI18n, type UiKey } from './i18n'
import { CrownIcon, EyeOffIcon, HeartIcon, PlusIcon, UsersIcon } from './icons'
import { coverUrl } from './quiz'
import { Ask, type Asking, type SavedDraft } from './QuizBuilder'
import { useHref } from './router'
import { uiUrl } from './pics'

type Mine = SavedDraft & { plays: number; likes: number }

export default function QuizMine() {
  const { t, l } = useI18n()
  const href = useHref()
  const { user, loading } = useAuth()
  const [list, setList] = useState<Mine[] | null>(null)
  const [limit, setLimit] = useState(30)
  const [publish, setPublish] = useState<{ used: number; max: number | null } | null>(null)
  const [ask, setAsk] = useState<Asking | null>(null)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    void api<{ quizzes?: Mine[]; limit?: number; publish?: { used: number; max: number | null } }>('my/quizzes').then(({ ok, data }) => {
      setList(ok ? (data.quizzes ?? []) : [])
      if (data.limit) setLimit(data.limit)
      if (data.publish) setPublish(data.publish)
    })
  }, [user])

  useEffect(() => {
    if (!note) return
    const timer = window.setTimeout(() => setNote(null), 2400)
    return () => window.clearTimeout(timer)
  }, [note])

  const hide = async (id: string) => {
    const { ok, data } = await api<{ quiz?: Mine; publish?: { used: number; max: number | null } }>('my/quizzes/hide', { id })
    if (!ok || !data.quiz) return
    setList((was) => was?.map((one) => (one.id === id ? { ...one, status: 'draft' } : one)) ?? was)
    if (data.publish) setPublish(data.publish)
    setNote(t('qb.hidden'))
  }

  const askHide = (quiz: Mine) =>
    setAsk({
      title: t('qb.hideTitle'),
      hint: t('qb.hideHint'),
      action: t(quiz.status === 'review' ? 'qb.hideReview' : 'qb.hide'),
      danger: false,
      mark: <EyeOffIcon />,
      run: () => void hide(quiz.id!),
    })

  const capped = !!publish && publish.max !== null && publish.used >= publish.max
  const own = list?.filter((one) => !one.official).length ?? 0
  const live = list?.filter((one) => one.status === 'published').length ?? 0

  const back = (
    <div className="play-nav">
      <BackButton href={href.home} anywhere>{t('play.back')}</BackButton>
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
          <Link prefetch={false} className="quiz-btn" href={href.login}>
            {t('qb.mine.loginBtn')}
          </Link>
        </div>
      </div>
    )
  }

  const full = own >= limit

  return (
    <div className="quiz-page qz-page">
      {back}
      <div className="qz-main-top">
        <div>
          <small className="qz-kicker">{list ? t('qb.mine.count', { count: own, max: limit }) : ' '}</small>
          <h1>{t('qb.mine')}</h1>
          {publish && (
            <span className={`qb-publish-meter ${publish.max === null ? 'is-free' : capped ? 'is-full' : ''}`}>
              {publish.max === null ? (
                <>
                  <CrownIcon />
                  {t('qb.limit.meterFree', { used: live })} · {t('qb.limit.free')}
                </>
              ) : (
                <>
                  <span className="qb-publish-dots" aria-hidden>
                    {Array.from({ length: publish.max }, (_, at) => (
                      <i key={at} className={at < publish.used ? 'on' : ''} />
                    ))}
                  </span>
                  {t('qb.limit.meter', { used: publish.used, max: publish.max })}
                </>
              )}
            </span>
          )}
        </div>
        <div className="qz-main-tools">
          {full ? (
            <span className="qz-action is-disabled">{t('qb.err.tooMany', { max: limit })}</span>
          ) : (
            <Link prefetch={false} className="qz-action is-accent" href={href.makeTest()}>
              <PlusIcon />
              {t('qb.create')}
            </Link>
          )}
        </div>
      </div>

      {capped && (
        <div className="qb-limit-banner">
          <span className="qb-limit-mark" aria-hidden>
            <CrownIcon />
          </span>
          <p>{t('qb.limit.full')}</p>
          <Link prefetch={false} className="qb-limit-go" href={href.support}>
            {t('qb.limit.patron')}
          </Link>
        </div>
      )}

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
          <Link prefetch={false} className="quiz-btn" href={href.makeTest()}>
            <PlusIcon />
            {t('qb.create')}
          </Link>
        </div>
      ) : (
        <div className="qz-grid">
          {list.map((quiz) => {
            const world = GAMES.find((one) => one.id === quiz.game)
            const art = coverUrl(quiz.game, quiz.cover)
            const shown = !quiz.official && (quiz.status === 'published' || quiz.status === 'review')
            return (
              <div key={quiz.id} className="qb-mine-item">
              <Link prefetch={false} className="qz-card qb-mine-card" href={quiz.official ? `${href.adminQuizzes}?id=${quiz.id}` : href.makeTest({ id: quiz.id })}>
                <span className="qz-art">
                  {art ? <img src={art} alt="" loading="lazy" /> : <span className="qz-mark">{BRAND.mark}</span>}
                  <span className="qz-corner is-left">
                    <em className={`qz-badge qb-status is-${quiz.status}`}>{t(`qb.status.${quiz.status}` as UiKey)}</em>
                    {quiz.official && <em className="qz-badge qb-official">{t('qb.official')}</em>}
                  </span>
                </span>
                <span className="qz-info">
                  {world && (
                    <em className="qz-world" style={{ '--world-accent': world.accent } as CSSProperties}>
                      <img src={uiUrl(`worlds/${world.id}.webp`)} alt="" loading="lazy" />
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
              {shown && (
                <button type="button" className="qb-mine-hide" onClick={() => askHide(quiz)}>
                  <EyeOffIcon />
                  <span>{t(quiz.status === 'review' ? 'qb.hideReview' : 'qb.hide')}</span>
                </button>
              )}
              </div>
            )
          })}
        </div>
      )}
      {note && <div className="qb-toast" role="status">{note}</div>}
      {ask && <Ask ask={ask} onClose={() => setAsk(null)} />}
    </div>
  )
}
