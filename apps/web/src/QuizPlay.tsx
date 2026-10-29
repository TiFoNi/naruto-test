'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { api } from './api'
import { useAuth } from './auth'
import BackButton from './BackButton'
import CharacterSearch from './CharacterSearch'
import { useEntities } from './entities'
import { GAMES } from './games'
import type { Entity, Game, GameId } from './games/types'
import { useI18n, type UiKey } from './i18n'
import { ArrowIcon, CheckIcon, CloseIcon, RefreshIcon } from './icons'
import { coverUrl, optionImage, type QuizOption, type QuizQuestionView, type QuizValue, type QuizView } from './quiz'
import QuizTile, { QuizChip, useOptionLabel, type TileState } from './QuizTile'
import { abilityUrl } from './pics'
import { useHref } from './router'
import Thumb from './Thumb'

type QuestionProps = {
  game: Game
  byId: Map<number, Entity>
  question: QuizQuestionView
  value: QuizValue
  onChange?: (update: (value: QuizValue) => QuizValue) => void
  result?: { right: boolean; correct?: number[] | number }
}

const hintOf = (result: QuestionProps['result'], pick: UiKey): UiKey => (!result ? pick : result.correct === undefined ? 'quiz.hiddenHint' : 'quiz.resultHint')

const listOf = (value: QuizValue) => (Array.isArray(value) ? value : [])

type Drag = { item: number; x: number; y: number; w: number; over: string | null }

function useDrag(onDrop: (item: number, target: string | null) => void) {
  const [drag, setDrag] = useState<Drag | null>(null)
  const moved = useRef(false)
  const drop = useRef(onDrop)
  const holding = useRef(false)
  drop.current = onDrop

  useEffect(() => {
    const block = (event: TouchEvent) => {
      if (holding.current) event.preventDefault()
    }
    document.addEventListener('touchmove', block, { passive: false })
    return () => document.removeEventListener('touchmove', block)
  }, [])

  const targetAt = (x: number, y: number) => document.elementFromPoint(x, y)?.closest('[data-drop]')?.getAttribute('data-drop') ?? null

  const grab = (item: number) => (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    const startX = event.clientX
    const startY = event.clientY
    const touch = event.pointerType !== 'mouse'
    let armed = !touch
    let live = false
    moved.current = false
    const hold = touch
      ? window.setTimeout(() => {
          armed = true
          holding.current = true
          navigator.vibrate?.(15)
        }, 220)
      : 0
    const lift = (x: number, y: number) => {
      live = true
      moved.current = true
      setDrag({ item, x: x - (startX - rect.left), y: y - (startY - rect.top), w: rect.width, over: targetAt(x, y) })
    }
    const move = (next: globalThis.PointerEvent) => {
      const far = Math.hypot(next.clientX - startX, next.clientY - startY) >= 6
      if (!armed) {
        if (far) finish()
        return
      }
      if (!live && !far) return
      next.preventDefault()
      lift(next.clientX, next.clientY)
    }
    const finish = () => {
      window.clearTimeout(hold)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      holding.current = false
      setDrag(null)
    }
    const end = (last: globalThis.PointerEvent) => {
      if (live && last.type === 'pointerup') drop.current(item, targetAt(last.clientX, last.clientY))
      finish()
    }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  const tap = (action: () => void) => () => {
    if (moved.current) {
      moved.current = false
      return
    }
    action()
  }

  return { drag, grab, tap }
}

function Ghost({ drag, children }: { drag: Drag | null; children: ReactNode }) {
  if (!drag || typeof document === 'undefined') return null
  return createPortal(
    <div className="quiz-ghost" style={{ left: drag.x, top: drag.y, width: drag.w }}>
      {children}
    </div>,
    document.body,
  )
}

const slotsOf = (value: QuizValue, size: number) =>
  Array.from({ length: size }, (_, at) => {
    const one = listOf(value)[at]
    return typeof one === 'number' && one >= 0 ? one : -1
  })

function placeIn(current: QuizValue, size: number, item: number, target: number | null) {
  const next = slotsOf(current, size)
  const from = next.indexOf(item)
  const place = target ?? next.indexOf(-1)
  if (place < 0) return next
  if (from >= 0) next[from] = next[place]!
  next[place] = item
  return next
}

function takeOut(current: QuizValue, size: number, item: number) {
  const next = slotsOf(current, size).map((one) => (one === item ? -1 : one))
  return next.some((one) => one >= 0) ? next : null
}

function Order({ game, byId, question, value, onChange, result }: QuestionProps & { question: Extract<QuizQuestionView, { kind: 'order' }> }) {
  const { t } = useI18n()
  const size = question.options.length
  const slots = slotsOf(value, size)
  const correct = result && Array.isArray(result.correct) ? result.correct : []
  const { drag, grab, tap } = useDrag((item, target) => {
    if (target?.startsWith('slot:')) onChange?.((current) => placeIn(current, size, item, Number(target.slice(5))))
    else if (target === 'pool') onChange?.((current) => takeOut(current, size, item))
  })

  return (
    <>
      <p className="quiz-hint">{t(hintOf(result, 'quiz.pickOrder'))}</p>
      <ol className="quiz-slots">
        {slots.map((at, place) => (
          <li key={place} className={`quiz-slot ${drag?.over === `slot:${place}` ? 'is-over' : ''}`} data-drop={result ? undefined : `slot:${place}`}>
            <em>{place + 1}</em>
            {at < 0 ? (
              <span className="quiz-slot-empty" />
            ) : (
              <QuizChip
                game={game}
                option={question.options[at]!}
                byId={byId}
                state={!result ? 'idle' : result.correct === undefined ? (result.right ? 'right' : 'idle') : correct[place] === at ? 'right' : 'wrong'}
                disabled={!!result}
                className={drag?.item === at ? 'is-lifted' : ''}
                onPointerDown={result ? undefined : grab(at)}
                onClick={tap(() => onChange?.((current) => takeOut(current, size, at)))}
              />
            )}
          </li>
        ))}
      </ol>
      {!result && (
        <div className={`quiz-pool ${drag?.over === 'pool' ? 'is-over' : ''}`} data-drop="pool">
          {question.options.map((option, at) =>
            slots.includes(at) ? (
              <QuizChip key={at} game={game} option={option} byId={byId} disabled className="is-placeholder" />
            ) : (
              <QuizChip
                key={at}
                game={game}
                option={option}
                byId={byId}
                className={drag?.item === at ? 'is-lifted' : ''}
                onPointerDown={grab(at)}
                onClick={tap(() => onChange?.((current) => placeIn(current, size, at, null)))}
              />
            ),
          )}
        </div>
      )}
      <Ghost drag={drag}>{drag && <QuizChip game={game} option={question.options[drag.item]!} byId={byId} />}</Ghost>
      {result && !result.right && result.correct !== undefined && (
        <div className="quiz-correct-line">
          <small>{t('quiz.correctOrder')}</small>
          <ol className="quiz-slots">
            {correct.map((at, place) => (
              <li key={place} className="quiz-slot">
                <em>{place + 1}</em>
                <QuizChip game={game} option={question.options[at]!} byId={byId} disabled />
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  )
}

function Pairs({ game, byId, question, value, onChange, result }: QuestionProps & { question: Extract<QuizQuestionView, { kind: 'pairs' }> }) {
  const { t } = useI18n()
  const size = question.left.length
  const linked = slotsOf(value, size)
  const correct = result && Array.isArray(result.correct) ? result.correct : []
  const [active, setActive] = useState<number | null>(null)
  const row = active ?? linked.indexOf(-1)
  const { drag, grab, tap } = useDrag((item, target) => {
    if (target?.startsWith('row:')) onChange?.((current) => placeIn(current, size, item, Number(target.slice(4))))
    else if (target === 'pool') onChange?.((current) => takeOut(current, size, item))
    setActive(null)
  })

  const link = (at: number) => {
    if (row < 0) return
    onChange?.((current) => placeIn(current, size, at, row))
    setActive(null)
  }
  const unlink = (target: number, at: number) => {
    onChange?.((current) => takeOut(current, size, at))
    setActive(target)
  }

  return (
    <>
      <p className="quiz-hint">{t(hintOf(result, 'quiz.pickPairs'))}</p>
      <ul className="quiz-pairs">
        {question.left.map((option, at) => {
          const right = linked[at]!
          const good = correct[at]
          return (
            <li
              key={at}
              className={`quiz-pair ${!result && row === at ? 'is-active' : ''} ${drag?.over === `row:${at}` ? 'is-over' : ''}`}
              data-drop={result ? undefined : `row:${at}`}
            >
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
                    state={!result ? 'idle' : result.correct === undefined ? (result.right ? 'right' : 'idle') : good === right ? 'right' : 'wrong'}
                    disabled={!!result}
                    className={drag?.item === right ? 'is-lifted' : ''}
                    onPointerDown={result ? undefined : grab(right)}
                    onClick={tap(() => unlink(at, right))}
                  />
                )}
                {result && good !== undefined && good !== right && <QuizChip game={game} option={question.right[good]!} byId={byId} state="right" disabled />}
              </span>
            </li>
          )
        })}
      </ul>
      {!result && (
        <div className={`quiz-pool ${drag?.over === 'pool' ? 'is-over' : ''}`} data-drop="pool">
          {question.right.map((option, at) =>
            linked.includes(at) ? (
              <QuizChip key={at} game={game} option={option} byId={byId} disabled className="is-placeholder" />
            ) : (
              <QuizChip
                key={at}
                game={game}
                option={option}
                byId={byId}
                className={drag?.item === at ? 'is-lifted' : ''}
                onPointerDown={grab(at)}
                onClick={tap(() => link(at))}
              />
            ),
          )}
        </div>
      )}
      <Ghost drag={drag}>{drag && <QuizChip game={game} option={question.right[drag.item]!} byId={byId} />}</Ghost>
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
      if (correct === undefined) return value === answer ? (result.right ? 'right' : 'wrong') : 'idle'
      if (value === answer) return answer === correct ? 'right' : 'wrong'
      return answer === correct ? 'missed' : 'idle'
    }
    return (
      <>
      <p className="quiz-hint">{t(hintOf(result, 'quiz.pickOne'))}</p>
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
    const tile = (entity: Entity, state: TileState, onClick?: () => void) => (
      <QuizTile key={`${state}-${entity.id}`} game={game} option={{ kind: 'entity', id: entity.id }} byId={byId} state={state} disabled={!onClick} onClick={onClick} />
    )
    if (result) {
      return (
        <>
          <p className="quiz-hint">{t(chosen ? hintOf(result, 'quiz.pickName') : 'quiz.skipped')}</p>
          <div className="quiz-tiles is-result">
            {chosen && tile(chosen, result.right ? 'right' : 'wrong')}
            {!result.right && correct && tile(correct, 'missed')}
          </div>
        </>
      )
    }
    return (
      <>
        <p className="quiz-hint">{t('quiz.pickName')}</p>
        <div className="quiz-answer-name">
          {chosen ? (
            <>
              <div className="quiz-tiles">{tile(chosen, 'picked')}</div>
              <button type="button" className="quiz-change" onClick={() => onChange?.(() => null)}>
                <RefreshIcon />
                {t('quiz.change')}
              </button>
            </>
          ) : (
            <CharacterSearch game={game} exclude={new Set()} pickOnly onPick={(entity) => onChange?.(() => entity.id)} />
          )}
        </div>
      </>
    )
  }

  const picked = Array.isArray(value) ? value : []
  const correct = result && Array.isArray(result.correct) ? result.correct : []
  const stateOf = (index: number): TileState => {
    if (!result) return picked.includes(index) ? 'picked' : 'idle'
    if (result.correct === undefined) return picked.includes(index) ? (result.right ? 'right' : 'wrong') : 'idle'
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
      <p className="quiz-hint">{t(hintOf(result, question.multi ? 'quiz.pickMany' : 'quiz.pickOne'))}</p>
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

function Mini({ game, byId, option }: { game: Game; byId: Map<number, Entity>; option: QuizOption }) {
  const label = useOptionLabel(byId)(option)
  const entity = option.kind === 'entity' ? byId.get(option.id) : undefined
  return (
    <span className="quiz-mini">
      {entity && <Thumb game={game} entity={entity} size={24} />}
      {option.kind === 'ability' && <img src={abilityUrl(option.key)} alt="" />}
      {option.kind === 'image' && <img src={optionImage(option)} alt="" />}
      {label}
    </span>
  )
}

function Recap({
  game,
  byId,
  quiz,
  busy,
  onRestart,
  moreHref,
}: {
  game: Game
  byId: Map<number, Entity>
  quiz: QuizView
  busy: boolean
  onRestart: () => void
  moreHref: string
}) {
  const { t } = useI18n()
  const attempt = quiz.attempt!
  const share = attempt.total ? attempt.score / attempt.total : 0
  const entityOf = (id: unknown) => (typeof id === 'number' ? byId.get(id) : undefined)

  const describe = (question: QuizQuestionView, value: QuizValue | number[] | number | null | undefined, correct = false): ReactNode => {
    if (value === null || value === undefined) return <span className="quiz-mini is-empty">{t('quiz.skipped')}</span>
    if (question.kind === 'bool') return <span className="quiz-mini">{t(value === 1 ? 'quiz.true' : 'quiz.false')}</span>
    if (question.kind === 'name') {
      const entity = entityOf(value)
      return entity ? <Mini game={game} byId={byId} option={{ kind: 'entity', id: entity.id }} /> : null
    }
    if (question.kind === 'choice' && Array.isArray(value)) {
      return value.map((at) => question.options[at] && <Mini key={at} game={game} byId={byId} option={question.options[at]!} />)
    }
    if (question.kind === 'order') return <span className="quiz-mini">{t(correct ? 'quiz.recap.orderRight' : attempt.reveal ? 'quiz.recap.orderWrong' : 'quiz.recap.orderOff')}</span>
    if (question.kind === 'pairs' && Array.isArray(value)) {
      const right = attempt.results?.[quiz.questions.indexOf(question)]?.correct
      if (!Array.isArray(right)) return <span className="quiz-mini">{t(correct ? 'quiz.recap.pairsRight' : 'quiz.recap.pairsWrong')}</span>
      const hits = value.filter((one, at) => one === right[at]).length
      return <span className="quiz-mini">{t('quiz.recap.pairs', { hits, total: question.left.length })}</span>
    }
    return null
  }

  return (
    <section className="quiz-recap">
      <header className="quiz-recap-head">
        <div>
          <small>{t('quiz.recap.title')}</small>
          <b>{t(share === 1 ? 'quiz.grade.top' : share >= 0.6 ? 'quiz.grade.good' : 'quiz.grade.low')}</b>
        </div>
        <strong>
          {attempt.score}
          <span>/{attempt.total}</span>
        </strong>
      </header>
      {!!attempt.xp && <p className="quiz-recap-xp">{t('quiz.recap.xp', { xp: attempt.xp })}</p>}
      {!attempt.reveal && <p className="quiz-recap-note">{t('quiz.recap.hidden')}</p>}
      <div className="quiz-recap-bar" aria-hidden>
        {quiz.questions.map((_, at) => (
          <i key={at} className={attempt.results?.[at]?.right ? 'is-right' : 'is-wrong'} />
        ))}
      </div>
      <ol className="quiz-recap-list">
        {quiz.questions.map((question, at) => {
          const result = attempt.results?.[at]
          const right = !!result?.right
          return (
            <li key={at} className={right ? 'is-right' : 'is-wrong'}>
              <i className="quiz-recap-mark">{right ? <CheckIcon /> : <CloseIcon />}</i>
              <div className="quiz-recap-body">
                <p>
                  <em>{at + 1}.</em> {question.text}
                </p>
                <div className="quiz-recap-answers">
                  <span className="quiz-recap-label">{t('quiz.recap.yours')}</span>
                  {describe(question, attempt.answers[at], right)}
                </div>
                {!right && result && result.correct !== undefined && question.kind !== 'order' && question.kind !== 'pairs' && (
                  <div className="quiz-recap-answers is-correct">
                    <span className="quiz-recap-label">{t('quiz.recap.correct')}</span>
                    {describe(question, result.correct, true)}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      <footer className="quiz-recap-foot">
        <button type="button" className="quiz-btn is-ghost" disabled={busy} onClick={onRestart}>
          <span className="is-long">{t('quiz.again')}</span>
          <span className="is-short">{t('quiz.againShort')}</span>
        </button>
        <Link className="quiz-btn" href={moreHref}>
          <span className="is-long">{t('quiz.more')}</span>
          <span className="is-short">{t('quiz.moreShort')}</span>
        </Link>
      </footer>
    </section>
  )
}

const filled = (question: QuizQuestionView, value: QuizValue | undefined) => {
  if (value === null || value === undefined) return false
  if (!Array.isArray(value)) return true
  if (question.kind === 'order') return value.length === question.options.length && value.every((one) => one >= 0)
  if (question.kind === 'pairs') return value.length === question.left.length && value.every((one) => one >= 0)
  return value.length > 0
}

export default function QuizPlay({ game: gameId, id }: { game: string; id: string }) {
  const { t } = useI18n()
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

  const { refresh } = useAuth()
  const send = async (body: Record<string, unknown>) => {
    setBusy(true)
    setError('')
    const { ok, data } = await api<{ quiz?: QuizView; error?: string }>('quiz', { id, ...body })
    setBusy(false)
    if (!ok || !data.quiz) return setError(t('quiz.failed'))
    take(data.quiz)
    if (data.quiz.attempt?.finished && data.quiz.attempt.xp) void refresh()
  }

  if (!game || missing) return <div className="card center muted">{t('err.not_found')}</div>

  const back = (
    <div className="play-nav">
      <BackButton href={href.tests(game.category)}>{t('quiz.title')}</BackButton>
    </div>
  )

  if (!quiz) {
    return (
      <div className="quiz-page">
        {back}
        <div className="quiz-hero is-ghost" />
      </div>
    )
  }

  const attempt = quiz.attempt
  const hero = (aside: ReactNode) => (
    <header className="quiz-hero">
      <h1>{quiz.title}</h1>
      {aside}
    </header>
  )
  const steps = (now: number, marks?: { right: boolean }[]) =>
    quiz.count > 1 && (
      <div className={`quiz-hero-steps ${marks ? 'is-links' : ''}`} aria-hidden={!marks}>
        {quiz.questions.map((_, at) =>
          marks ? (
            <button
              key={at}
              type="button"
              className={marks[at]?.right ? 'is-right' : 'is-wrong'}
              aria-label={t('quiz.questionOf', { at: at + 1, total: quiz.count })}
              onClick={() => document.getElementById(`quiz-q-${at}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            />
          ) : (
            <i key={at} className={at < now ? 'is-done' : at === now ? 'is-now' : ''} />
          ),
        )}
      </div>
    )
  const block = (question: QuizQuestionView, index: number, tag: ReactNode, body: ReactNode, state = '') => (
    <section key={index} id={`quiz-q-${index}`} className={`quiz-q ${state}`}>
      <em className="quiz-q-tag">{tag}</em>
      {question.picture ? (
        <div className="quiz-q-head">
          <img className="quiz-q-picture" src={coverUrl(game.id, question.picture) ?? ''} alt="" loading="lazy" />
          <h2>{question.text}</h2>
        </div>
      ) : (
        <h2>{question.text}</h2>
      )}
      {body}
    </section>
  )
  const edit = (index: number) => (update: (value: QuizValue) => QuizValue) =>
    setDraft((all) => Object.assign([...all], { [index]: update(all[index] ?? null) }))

  if (attempt?.finished) {
    return (
      <div className="quiz-page">
        {back}
        {hero(steps(quiz.count, attempt.results))}
        {quiz.questions.map((question, index) => {
          const result = attempt.results?.[index]
          return block(
            question,
            index,
            <>
              {t('quiz.questionOf', { at: index + 1, total: quiz.count })} · {t(result?.right ? 'quiz.right' : 'quiz.wrong')}
            </>,
            <Question game={game} byId={byId} question={question} value={attempt.answers[index] ?? null} result={result} />,
            result?.right ? 'is-right' : 'is-wrong',
          )
        })}
        <Recap game={game} byId={byId} quiz={quiz} busy={busy} onRestart={() => void send({ action: 'restart' })} moreHref={href.tests(game.category)} />
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
        {hero(steps(index))}
        {block(
          question,
          index,
          t('quiz.questionOf', { at: index + 1, total: quiz.count }),
          <Question game={game} byId={byId} question={question} value={value} onChange={edit(index)} />,
        )}
        {error && <p className="quiz-error">{error}</p>}
        <div className="quiz-bar">
          <span>{t('quiz.noBack')}</span>
          <button type="button" className="quiz-btn" disabled={busy || !filled(question, value)} onClick={() => void send({ action: 'answer', index, value })}>
            {t(index + 1 === quiz.count ? 'quiz.finish' : 'quiz.next')}
            <ArrowIcon />
          </button>
        </div>
      </div>
    )
  }

  const ready = draft.length === quiz.count && quiz.questions.every((question, at) => filled(question, draft[at]))
  return (
    <div className="quiz-page">
      {back}
      {hero(null)}
      {quiz.questions.map((question, index) =>
        block(
          question,
          index,
          t('quiz.questionOf', { at: index + 1, total: quiz.count }),
          <Question game={game} byId={byId} question={question} value={draft[index] ?? null} onChange={edit(index)} />,
        ),
      )}
      {error && <p className="quiz-error">{error}</p>}
      <div className="quiz-bar is-sticky">
        <span>{t('quiz.answered', { done: quiz.questions.filter((question, at) => filled(question, draft[at])).length, total: quiz.count })}</span>
        <button type="button" className="quiz-btn" disabled={busy || !ready} onClick={() => void send({ action: 'finish', answers: draft })}>
          {t('quiz.show')}
          <ArrowIcon />
        </button>
      </div>
    </div>
  )
}
