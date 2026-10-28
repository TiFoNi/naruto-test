'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './api'
import BackButton from './BackButton'
import CharacterSearch from './CharacterSearch'
import { useEntities } from './entities'
import { GAMES } from './games'
import type { Entity, Game, GameId } from './games/types'
import { useI18n } from './i18n'
import { ArrowIcon, CheckIcon, CloseIcon } from './icons'
import { coverUrl, type QuizQuestionView, type QuizValue, type QuizView } from './quiz'
import QuizTile, { QuizChip, type TileState } from './QuizTile'
import { useHref } from './router'
import Thumb from './Thumb'

type QuestionProps = {
  game: Game
  byId: Map<number, Entity>
  question: QuizQuestionView
  value: QuizValue
  onChange?: (update: (value: QuizValue) => QuizValue) => void
  result?: { right: boolean; correct: number[] | number }
}

function Picked({ game, entity, state }: { game: Game; entity: Entity; state?: 'right' | 'wrong' }) {
  const { name } = useI18n()
  return (
    <span className={`quiz-picked ${state ? `is-${state}` : ''}`}>
      <Thumb game={game} entity={entity} size={40} />
      <b>{name(entity)}</b>
      {state === 'right' && <CheckIcon />}
      {state === 'wrong' && <CloseIcon />}
    </span>
  )
}

const listOf = (value: QuizValue) => (Array.isArray(value) ? value : [])

function Order({ game, byId, question, value, onChange, result }: QuestionProps & { question: Extract<QuizQuestionView, { kind: 'order' }> }) {
  const { t } = useI18n()
  const placed = listOf(value)
  const correct = result && Array.isArray(result.correct) ? result.correct : []
  const pool = question.options.map((_, at) => at).filter((at) => !placed.includes(at))

  return (
    <>
      <p className="quiz-hint">{t(result ? 'quiz.resultHint' : 'quiz.pickOrder')}</p>
      <ol className="quiz-slots">
        {question.options.map((_, place) => {
          const at = placed[place]
          return (
            <li key={place} className="quiz-slot">
              <em>{place + 1}</em>
              {at === undefined ? (
                <span className="quiz-slot-empty" />
              ) : (
                <QuizChip
                  game={game}
                  option={question.options[at]!}
                  byId={byId}
                  state={result ? (correct[place] === at ? 'right' : 'wrong') : 'picked'}
                  disabled={!!result}
                  onClick={() => onChange?.((current) => {
                    const next = listOf(current).filter((one) => one !== at)
                    return next.length ? next : null
                  })}
                />
              )}
            </li>
          )
        })}
      </ol>
      {!result && pool.length > 0 && (
        <div className="quiz-pool">
          {pool.map((at) => (
            <QuizChip key={at} game={game} option={question.options[at]!} byId={byId} onClick={() => onChange?.((current) => [...listOf(current).filter((one) => one !== at), at])} />
          ))}
        </div>
      )}
      {result && !result.right && (
        <div className="quiz-correct-line">
          <small>{t('quiz.correctOrder')}</small>
          <div className="quiz-pool is-result">
            {correct.map((at, place) => (
              <span key={place} className="quiz-correct-step">
                <em>{place + 1}</em>
                <QuizChip game={game} option={question.options[at]!} byId={byId} disabled />
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function Pairs({ game, byId, question, value, onChange, result }: QuestionProps & { question: Extract<QuizQuestionView, { kind: 'pairs' }> }) {
  const { t } = useI18n()
  const linked = question.left.map((_, row) => listOf(value)[row] ?? -1)
  const correct = result && Array.isArray(result.correct) ? result.correct : []
  const [active, setActive] = useState<number | null>(null)
  const row = active ?? linked.findIndex((one) => one < 0)
  const pool = question.right.map((_, at) => at).filter((at) => !linked.includes(at))

  const link = (at: number) => {
    if (row < 0) return
    onChange?.((current) => {
      const next = question.left.map((_, one) => listOf(current)[one] ?? -1).map((one) => (one === at ? -1 : one))
      next[row] = at
      return next
    })
    setActive(null)
  }
  const unlink = (target: number) => {
    onChange?.((current) => {
      const next = question.left.map((_, one) => listOf(current)[one] ?? -1)
      next[target] = -1
      return next.some((one) => one >= 0) ? next : null
    })
    setActive(target)
  }

  return (
    <>
      <p className="quiz-hint">{t(result ? 'quiz.resultHint' : 'quiz.pickPairs')}</p>
      <ul className="quiz-pairs">
        {question.left.map((option, at) => {
          const right = linked[at]!
          const good = correct[at]
          return (
            <li key={at} className={`quiz-pair ${!result && row === at ? 'is-active' : ''}`}>
              <QuizChip game={game} option={option} byId={byId} active={!result && row === at} disabled={!!result} onClick={() => setActive(at)} />
              <i className="quiz-pair-link" aria-hidden />
              <span className="quiz-pair-side">
                {right < 0 ? (
                  <button type="button" className="quiz-slot-empty" disabled={!!result} onClick={() => setActive(at)} aria-label={t('quiz.pickPairs')} />
                ) : (
                  <QuizChip
                    game={game}
                    option={question.right[right]!}
                    byId={byId}
                    state={result ? (good === right ? 'right' : 'wrong') : 'picked'}
                    disabled={!!result}
                    onClick={() => unlink(at)}
                  />
                )}
                {result && good !== undefined && good !== right && <QuizChip game={game} option={question.right[good]!} byId={byId} state="right" disabled />}
              </span>
            </li>
          )
        })}
      </ul>
      {!result && pool.length > 0 && (
        <div className="quiz-pool">
          {pool.map((at) => (
            <QuizChip key={at} game={game} option={question.right[at]!} byId={byId} onClick={() => link(at)} />
          ))}
        </div>
      )}
    </>
  )
}

function Question({ game, byId, question, value, onChange, result }: QuestionProps) {
  const { t } = useI18n()

  if (question.kind === 'order') return <Order game={game} byId={byId} question={question} value={value} onChange={onChange} result={result} />
  if (question.kind === 'pairs') return <Pairs game={game} byId={byId} question={question} value={value} onChange={onChange} result={result} />

  if (question.kind === 'bool') {
    const correct = result?.correct
    const stateOf = (answer: number): TileState => {
      if (!result) return value === answer ? 'picked' : 'idle'
      if (value === answer) return answer === correct ? 'right' : 'wrong'
      return answer === correct ? 'missed' : 'idle'
    }
    return (
      <>
      <p className="quiz-hint">{t(result ? 'quiz.resultHint' : 'quiz.pickOne')}</p>
      <div className={`quiz-tiles count-2 is-bool ${result ? 'is-result' : ''}`}>
        {[1, 0].map((answer) => (
          <QuizTile
            key={answer}
            game={game}
            option={{ kind: 'text', text: t(answer ? 'quiz.true' : 'quiz.false') }}
            byId={byId}
            state={stateOf(answer)}
            disabled={!!result}
            onClick={() => onChange?.(() => answer)}
          />
        ))}
      </div>
      </>
    )
  }

  if (question.kind === 'name') {
    const chosen = typeof value === 'number' ? byId.get(value) : undefined
    const correct = result && typeof result.correct === 'number' ? byId.get(result.correct) : undefined
    return (
      <div className="quiz-answer-name">
        {result ? (
          <div className="quiz-name-result">
            {chosen ? <Picked game={game} entity={chosen} state={result.right ? 'right' : 'wrong'} /> : <span className="muted">{t('quiz.skipped')}</span>}
            {!result.right && correct && (
              <span className="quiz-name-correct">
                <small>{t('quiz.correctWas')}</small>
                <Picked game={game} entity={correct} state="right" />
              </span>
            )}
          </div>
        ) : chosen ? (
          <div className="quiz-name-chosen">
            <Picked game={game} entity={chosen} />
            <button type="button" className="ghost" onClick={() => onChange?.(() => null)}>
              {t('quiz.change')}
            </button>
          </div>
        ) : (
          <CharacterSearch game={game} exclude={new Set()} pickOnly onPick={(entity) => onChange?.(() => entity.id)} />
        )}
      </div>
    )
  }

  const picked = Array.isArray(value) ? value : []
  const correct = result && Array.isArray(result.correct) ? result.correct : []
  const stateOf = (index: number): TileState => {
    if (!result) return picked.includes(index) ? 'picked' : 'idle'
    const chose = picked.includes(index)
    const good = correct.includes(index)
    if (chose && good) return 'right'
    if (chose) return 'wrong'
    if (good) return 'missed'
    return 'idle'
  }
  const toggle = (index: number) => {
    if (!onChange) return
    if (!question.multi) return onChange(() => [index])
    onChange((current) => {
      const now = Array.isArray(current) ? current : []
      const next = now.includes(index) ? now.filter((one) => one !== index) : [...now, index]
      return next.length ? next.sort((a, b) => a - b) : null
    })
  }

  return (
    <>
      <p className="quiz-hint">{t(result ? 'quiz.resultHint' : question.multi ? 'quiz.pickMany' : 'quiz.pickOne')}</p>
      <div className={`quiz-tiles count-${question.options.length} ${result ? 'is-result' : ''}`}>
        {question.options.map((option, index) => (
          <QuizTile
            key={index}
            game={game}
            option={option}
            byId={byId}
            state={stateOf(index)}
            disabled={!!result}
            onClick={() => toggle(index)}
          />
        ))}
      </div>
    </>
  )
}

const filled = (question: QuizQuestionView, value: QuizValue | undefined) => {
  if (value === null || value === undefined) return false
  if (!Array.isArray(value)) return true
  if (question.kind === 'order') return value.length === question.options.length
  if (question.kind === 'pairs') return value.length === question.left.length && value.every((one) => one >= 0)
  return value.length > 0
}

export default function QuizPlay({ game: gameId, id }: { game: string; id: string }) {
  const { t, l } = useI18n()
  const href = useHref()
  const game = GAMES.find((one) => one.id === (gameId as GameId))
  useEntities(game)
  const byId = useMemo(() => new Map((game?.entities ?? []).map((one) => [one.id, one])), [game, game?.entities])
  const [quiz, setQuiz] = useState<QuizView | null>(null)
  const [missing, setMissing] = useState(false)
  const [draft, setDraft] = useState<QuizValue[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const take = useCallback((next: QuizView) => {
    setQuiz(next)
    setDraft(next.layout === 'list' ? next.questions.map(() => null) : [])
  }, [])

  useEffect(() => {
    void api<{ quiz?: QuizView }>(`quiz?id=${id}`).then(({ ok, data }) => (ok && data.quiz ? take(data.quiz) : setMissing(true)))
  }, [id, take])

  const send = async (body: Record<string, unknown>) => {
    setBusy(true)
    setError('')
    const { ok, data } = await api<{ quiz?: QuizView; error?: string }>('quiz', { id, ...body })
    setBusy(false)
    if (!ok || !data.quiz) return setError(t('quiz.failed'))
    take(data.quiz)
  }

  if (!game || missing) return <div className="card center muted">{t('err.not_found')}</div>

  const back = (
    <div className="play-nav">
      <BackButton href={href.tests(game.id)}>{t('quiz.title')}</BackButton>
    </div>
  )

  if (!quiz) {
    return (
      <div className="quiz-page">
        {back}
        <div className="card quiz-question is-ghost" />
      </div>
    )
  }

  const attempt = quiz.attempt
  const art = coverUrl(game.id, quiz.cover)
  const head = (
    <header className="quiz-run-head">
      {art && <img className="quiz-run-art" src={art} alt="" />}
      <div className="quiz-run-title">
        <small className="muted">
          {l(game.label)} · {t('quiz.questions', { count: quiz.count })}
        </small>
        <h1>{quiz.title}</h1>
      </div>
    </header>
  )
  const progress = (now: number) => (
    <div className="quiz-status">
      <div className="quiz-progress" aria-hidden>
        {quiz.questions.map((_, at) => (
          <i key={at} className={at < now ? 'is-done' : at === now ? 'is-now' : ''} />
        ))}
      </div>
    </div>
  )

  if (attempt?.finished) {
    return (
      <div className="quiz-page">
        {back}
        {head}
        <div className="quiz-status">
          <div className="quiz-score">
            <b>
              {attempt.score}
              <small>/{attempt.total}</small>
            </b>
            <span>{t('quiz.scoreLine', { score: attempt.score, total: attempt.total })}</span>
            <div className="quiz-score-actions">
              <button type="button" className="ghost" disabled={busy} onClick={() => void send({ action: 'restart' })}>
                {t('quiz.again')}
              </button>
              <Link className="primary" href={href.tests(game.id)}>
                {t('quiz.more')}
              </Link>
            </div>
          </div>
        </div>
        <ol className="quiz-results">
          {quiz.questions.map((question, index) => {
            const result = attempt.results?.[index]
            return (
              <li key={index} className={`card quiz-question ${result?.right ? 'is-right' : 'is-wrong'}`}>
                <div className="quiz-question-head">
                  <em>{index + 1}</em>
                  <h2>{question.text}</h2>
                  <i className="quiz-verdict">{result?.right ? <CheckIcon /> : <CloseIcon />}</i>
                </div>
                <Question game={game} byId={byId} question={question} value={attempt.answers[index] ?? null} result={result} />
              </li>
            )
          })}
        </ol>
      </div>
    )
  }

  if (quiz.layout === 'steps') {
    const index = attempt?.answered ?? 0
    const question = quiz.questions[index]!
    const value = draft[index] ?? null
    return (
      <div className="quiz-page">
        {back}
        {head}
        {progress(index)}
        <section className="card quiz-question">
          <div className="quiz-question-head">
            <em>
              {index + 1}/{quiz.count}
            </em>
            <h2>{question.text}</h2>
          </div>
          <Question
            game={game}
            byId={byId}
            question={question}
            value={value}
            onChange={(update) => setDraft((all) => Object.assign([...all], { [index]: update(all[index] ?? null) }))}
          />
          {error && <p className="quiz-error">{error}</p>}
          <div className="quiz-actions">
            <span className="muted">{t('quiz.noBack')}</span>
            <button type="button" className="primary" disabled={busy || !filled(question, value)} onClick={() => void send({ action: 'answer', index, value })}>
              {t(index + 1 === quiz.count ? 'quiz.finish' : 'quiz.next')}
              <ArrowIcon />
            </button>
          </div>
        </section>
      </div>
    )
  }

  const ready = draft.length === quiz.count && quiz.questions.every((question, at) => filled(question, draft[at]))
  return (
    <div className="quiz-page">
      {back}
      {head}
      <ol className="quiz-results">
        {quiz.questions.map((question, index) => (
          <li key={index} className="card quiz-question">
            <div className="quiz-question-head">
              <em>{index + 1}</em>
              <h2>{question.text}</h2>
            </div>
            <Question
              game={game}
              byId={byId}
              question={question}
              value={draft[index] ?? null}
              onChange={(update) => setDraft((all) => Object.assign([...all], { [index]: update(all[index] ?? null) }))}
            />
          </li>
        ))}
      </ol>
      {error && <p className="quiz-error">{error}</p>}
      <div className="quiz-actions is-final">
        <span className="muted">{t('quiz.answered', { done: quiz.questions.filter((question, at) => filled(question, draft[at])).length, total: quiz.count })}</span>
        <button type="button" className="primary" disabled={busy || !ready} onClick={() => void send({ action: 'finish', answers: draft })}>
          {t('quiz.show')}
          <ArrowIcon />
        </button>
      </div>
    </div>
  )
}
