'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { api } from './api'
import BackButton from './BackButton'
import { GAMES } from './games'
import type { GameId } from './games/types'
import { useI18n } from './i18n'
import { BRAND } from './brand'
import { CheckIcon } from './icons'
import { coverUrl, type QuizCard } from './quiz'
import { useHref } from './router'

export default function QuizList({ game: gameId }: { game: string }) {
  const { t, l } = useI18n()
  const href = useHref()
  const game = GAMES.find((one) => one.id === (gameId as GameId))
  const [list, setList] = useState<QuizCard[] | null>(null)

  useEffect(() => {
    if (!game) return
    void api<{ quizzes?: QuizCard[] }>(`quizzes?game=${game.id}`).then(({ ok, data }) => setList(ok ? (data.quizzes ?? []) : []))
  }, [game])

  if (!game) return <div className="card center muted">{t('err.not_found')}</div>

  return (
    <div className="quiz-page">
      <div className="play-nav">
        <BackButton href={href.world(game.id)}>{l(game.label)}</BackButton>
      </div>

      <header className="quiz-head">
        <h1>{t('quiz.title')}</h1>
        <p className="muted">{t('quiz.lead')}</p>
      </header>

      {list === null ? (
        <div className="quiz-grid">
          {[0, 1, 2].map((one) => (
            <div key={one} className="quiz-card is-ghost" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="card center muted">{t('quiz.empty')}</div>
      ) : (
        <div className="quiz-grid">
          {list.map((quiz) => {
            const art = coverUrl(game.id, quiz.cover)
            return (
              <Link key={quiz.id} className="quiz-card" href={href.test(game.id, quiz.id)} prefetch={false}>
                <span className="quiz-card-art">
                  {art ? <img src={art} alt="" loading="lazy" /> : <span className="quiz-card-mark">{BRAND.mark}</span>}
                  {quiz.mine?.finished && (
                    <em className="quiz-card-done">
                      <CheckIcon />
                      {quiz.mine.score}/{quiz.count}
                    </em>
                  )}
                </span>
                <span className="quiz-card-body">
                  <b>{quiz.title}</b>
                  <span className="quiz-card-chips">
                    <i>{t('quiz.questions', { count: quiz.count })}</i>
                    <i>{t(quiz.layout === 'steps' ? 'quiz.layout.steps' : 'quiz.layout.list')}</i>
                    {quiz.mine && !quiz.mine.finished && quiz.mine.answered > 0 && <i className="is-going">{t('quiz.going')}</i>}
                  </span>
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
