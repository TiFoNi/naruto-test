'use client'

import Link from 'next/link'
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import abilities from '@nanda/game/data/dota-abilities.json'
import { api, apiUrl } from './api'
import AdminSelect from './AdminSelect'
import Picker from './Picker'
import Rail from './Rail'
import WorldMark from './WorldMark'
import CharacterSearch from './CharacterSearch'
import { useEntities } from './entities'
import { GAMES } from './games'
import type { Entity, Game, GameId } from './games/types'
import { useI18n, type L10n, type UiKey } from './i18n'
import { ArrowIcon, CheckIcon, CloseIcon, CopyIcon, DownIcon, GearIcon, PencilIcon, PictureIcon, PlayIcon, PlusIcon, SparkIcon, TextIcon, TrashIcon, UpIcon, UserIcon } from './icons'
import { abilityUrl, picsUrl } from './pics'
import { coverUrl, type QuizCover, type QuizKind, type QuizLayout, type QuizAttempt, type QuizOption, type QuizQuestionView, type QuizStatus, type QuizValue, type QuizView } from './quiz'
import { KIND_ICON } from './QuizList'
import { QuizRun } from './QuizPlay'
import { useHref } from './router'
import Thumb from './Thumb'

type Ability = { key: string; name: L10n }

export type DraftOption =
  | { kind: 'entity'; id?: number }
  | { kind: 'ability'; hero?: number; key?: string }
  | { kind: 'text'; text: string }
  | { kind: 'image'; key?: string; ver?: string; text: string }

export type DraftQuestion = { picture?: QuizCover } & (
  | { kind: 'choice'; text: string; multi: boolean; options: DraftOption[]; correct: number[] }
  | { kind: 'name'; text: string; answer?: number }
  | { kind: 'bool'; text: string; answer?: boolean }
  | { kind: 'order'; text: string; options: DraftOption[] }
  | { kind: 'pairs'; text: string; left: DraftOption[]; right: DraftOption[] }
)

export type Draft = {
  id?: string
  game: GameId
  title: string
  cover: QuizCover
  layout: QuizLayout
  status: QuizStatus
  note?: string
  questions: DraftQuestion[]
}

export type SavedDraft = Draft & { id: string; updatedAt?: string }

type Mode = 'admin' | 'user'

const HEROES = abilities as Record<string, Ability[]>

const MAX_OPTIONS = 8
const MAX_PAIRS = 6
const MAX_QUESTIONS = 30

const ERRORS: Record<string, UiKey> = {
  game: 'qb.err.game',
  title: 'qb.err.title',
  questions: 'qb.err.questions',
  question_text: 'qb.err.text',
  question_answer: 'qb.err.answer',
  question_options: 'qb.err.options',
  question_option: 'qb.err.option',
  question_correct: 'qb.err.correct',
  question_pairs: 'qb.err.pairs',
  question_kind: 'qb.err.kind',
  question_duplicate: 'qb.err.duplicate',
  login: 'qb.err.login',
  too_many: 'qb.err.tooMany',
}

export const KINDS: QuizKind[] = ['choice', 'name', 'bool', 'order', 'pairs']

export const QUIZ_WORLDS = GAMES.filter((one) => one.modes.some((mode) => mode !== 'tune' && mode !== 'shot'))

const blankChoice = (): DraftQuestion => ({ kind: 'choice', text: '', multi: false, options: [{ kind: 'entity' }, { kind: 'entity' }, { kind: 'entity' }, { kind: 'entity' }], correct: [] })

const blank = (kind: QuizKind, text = ''): DraftQuestion => {
  if (kind === 'name') return { kind, text }
  if (kind === 'bool') return { kind, text }
  if (kind === 'order') return { kind, text, options: [{ kind: 'entity' }, { kind: 'entity' }, { kind: 'entity' }] }
  if (kind === 'pairs') return { kind, text, left: [{ kind: 'entity' }, { kind: 'entity' }], right: [{ kind: 'text', text: '' }, { kind: 'text', text: '' }] }
  return { ...(blankChoice() as Extract<DraftQuestion, { kind: 'choice' }>), text }
}

const blankOption = (kind: DraftOption['kind']): DraftOption =>
  kind === 'text' || kind === 'image' ? { kind, text: '' } : kind === 'ability' ? { kind: 'ability' } : { kind: 'entity' }

const nextOption = (list: DraftOption[]): DraftOption => blankOption(list.at(-1)?.kind ?? 'entity')

export const freshDraft = (game: GameId): Draft => ({ game, title: '', cover: null, layout: 'steps', status: 'draft', questions: [blankChoice()] })

const optionFilled = (option: DraftOption) => {
  if (option.kind === 'entity') return option.id !== undefined
  if (option.kind === 'ability') return option.hero !== undefined && !!option.key
  if (option.kind === 'image') return !!option.key && !!option.text.trim()
  return !!option.text.trim()
}

const optionKey = (option: DraftOption) => {
  if (!optionFilled(option)) return null
  if (option.kind === 'entity') return `e:${option.id}`
  if (option.kind === 'ability') return `a:${option.hero}:${option.key}`
  if (option.kind === 'image') return `i:${option.key}`
  return `t:${option.text.trim().toLowerCase()}`
}

const repeats = (list: DraftOption[]) => {
  const keys = list.map(optionKey)
  return new Set(keys.flatMap((key, at) => (key && keys.indexOf(key) !== at ? [at, keys.indexOf(key)] : [])))
}

const takenIn = (list: DraftOption[], at: number) =>
  new Set(list.flatMap((one, index) => (index !== at && one.kind === 'entity' && one.id !== undefined ? [one.id] : [])))

export function issueOf(question: DraftQuestion): UiKey | null {
  if (!question.text.trim()) return 'qb.err.text'
  if (question.kind === 'name' || question.kind === 'bool') return question.answer === undefined ? 'qb.err.answer' : null
  if (question.kind === 'pairs') {
    if (question.left.length < 2 || ![...question.left, ...question.right].every(optionFilled)) return 'qb.err.pairs'
    return repeats(question.left).size || repeats(question.right).size ? 'qb.err.duplicate' : null
  }
  if (question.options.length < 2) return 'qb.err.options'
  if (!question.options.every(optionFilled)) return 'qb.err.option'
  if (repeats(question.options).size) return 'qb.err.duplicate'
  if (question.kind === 'choice' && (!question.correct.length || (!question.multi && question.correct.length !== 1))) return 'qb.err.correct'
  return null
}

const UploadPath = createContext('admin/quizzes/cover')

const Guard = createContext<(run: () => void) => void>((run) => run())

const useGuard = () => {
  const ask = useContext(Guard)
  return (filled: boolean, run: () => void) => (filled ? ask(run) : run())
}

const hasAnswers = (question: DraftQuestion) => {
  if (question.kind === 'name' || question.kind === 'bool') return question.answer !== undefined
  if (question.kind === 'pairs') return [...question.left, ...question.right].some(optionFilled)
  return question.options.some(optionFilled)
}

async function uploadPicture(path: string, file: File, wide = false) {
  const form = new FormData()
  form.append('file', file)
  if (wide) form.append('wide', '1')
  const answer = await fetch(apiUrl(path), { method: 'POST', body: form, credentials: 'include' }).catch(() => null)
  const data = (await answer?.json().catch(() => ({}))) as { key?: string; ver?: string } | undefined
  return answer?.ok && data?.key ? { key: data.key, ver: data.ver ?? '' } : null
}

function useUpload(wide: boolean, onDone: (saved: { key: string; ver: string }) => void) {
  const path = useContext(UploadPath)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const pick = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setFailed(false)
    const saved = await uploadPicture(path, file, wide)
    setBusy(false)
    if (!saved) return setFailed(true)
    onDone(saved)
  }
  return { busy, failed, pick }
}

function ImageOption({ option, onChange }: { option: Extract<DraftOption, { kind: 'image' }>; onChange: (option: DraftOption) => void }) {
  const { t } = useI18n()
  const { busy, failed, pick } = useUpload(false, (saved) => onChange({ ...option, ...saved }))
  return (
    <div className="quiz-admin-image">
      <label className={`quiz-admin-image-pick ${option.key ? 'has-pic' : ''} ${busy ? 'is-busy' : ''}`} title={t('qb.coverUpload')}>
        {option.key ? <img src={picsUrl(option.key, option.ver ?? '')} alt="" /> : <span>{busy ? '…' : '+'}</span>}
        <input type="file" accept="image/*" disabled={busy} onChange={(event) => void pick(event.target.files?.[0])} />
      </label>
      <input
        className="quiz-admin-input"
        maxLength={80}
        placeholder={failed ? t('qb.uploadFailed') : t('qb.captionPh')}
        value={option.text}
        onChange={(event) => onChange({ ...option, text: event.target.value })}
      />
    </div>
  )
}

function QuestionPicture({ game, picture, onChange }: { game: Game; picture?: QuizCover; onChange: (picture: QuizCover) => void }) {
  const { t } = useI18n()
  const { busy, failed, pick } = useUpload(true, (saved) => onChange({ kind: 'upload', ...saved }))
  const art = coverUrl(game.id, picture ?? null)
  return (
    <div className={`qb-qpic ${art ? 'has-pic' : ''} ${busy ? 'is-busy' : ''} ${failed ? 'is-failed' : ''}`}>
      <label className="qb-qpic-box" title={art ? t('qb.pictureChange') : t('qb.picture')}>
        {art ? (
          <img src={art} alt="" />
        ) : (
          <span className="qb-qpic-empty">
            <PictureIcon />
            {busy ? t('qb.uploading') : failed ? t('qb.uploadFailed') : t('qb.picture')}
          </span>
        )}
        <input type="file" accept="image/*" disabled={busy} onChange={(event) => void pick(event.target.files?.[0])} />
      </label>
      {art && (
        <button type="button" className="qb-qpic-drop" onClick={() => onChange(null)} aria-label={t('qb.pictureDrop')} title={t('qb.pictureDrop')}>
          <CloseIcon />
        </button>
      )}
    </div>
  )
}

function Chosen({ game, entity, onClear }: { game: Game; entity: Entity; onClear: () => void }) {
  const { name, t } = useI18n()
  return (
    <span className="quiz-admin-chosen">
      <Thumb game={game} entity={entity} size={34} />
      <b>{name(entity)}</b>
      <button type="button" className="ghost" onClick={onClear}>
        {t('qb.change')}
      </button>
    </span>
  )
}

function EntityPick({ game, byId, id, taken, onPick }: { game: Game; byId: Map<number, Entity>; id?: number; taken?: Set<number>; onPick: (id?: number) => void }) {
  const { t } = useI18n()
  const entity = id === undefined ? undefined : byId.get(id)
  if (entity) return <Chosen game={game} entity={entity} onClear={() => onPick(undefined)} />
  return <CharacterSearch game={game} exclude={taken ?? new Set()} compact pickOnly strict placeholder={t('qb.searchPh')} onPick={(one) => onPick(one.id)} />
}

function OptionField({
  game,
  byId,
  option,
  taken,
  dup,
  onChange,
}: {
  game: Game
  byId: Map<number, Entity>
  option: DraftOption
  taken?: Set<number>
  dup?: boolean
  onChange: (option: DraftOption) => void
}) {
  const { t, l } = useI18n()
  const abilityList = option.kind === 'ability' && option.hero !== undefined ? (HEROES[String(option.hero)] ?? []) : []

  return (
    <div className={`quiz-admin-option ${dup ? 'is-dup' : ''}`} title={dup ? t('qb.err.duplicate') : undefined}>
        {option.kind === 'text' && (
          <input className={`quiz-admin-input ${dup ? 'is-dup' : ''}`} maxLength={80} placeholder={t('qb.optTextPh')} value={option.text} onChange={(event) => onChange({ kind: 'text', text: event.target.value })} />
        )}
        {option.kind === 'entity' && <EntityPick game={game} byId={byId} id={option.id} taken={taken} onPick={(id) => onChange({ kind: 'entity', id })} />}
        {option.kind === 'image' && <ImageOption option={option} onChange={onChange} />}
        {option.kind === 'ability' && (
          <div className="quiz-admin-ability">
            <EntityPick game={game} byId={byId} id={option.hero} onPick={(hero) => onChange({ kind: 'ability', hero })} />
            {abilityList.length > 0 && (
              <div className="quiz-admin-abilities">
                {abilityList.map((one) => (
                  <button key={one.key} type="button" className={option.key === one.key ? 'on' : ''} title={l(one.name)} onClick={() => onChange({ ...option, key: one.key })}>
                    <img src={abilityUrl(one.key)} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
    </div>
  )
}

const unitsKey = (game: Game): UiKey =>
  game.unit === 'manga' ? 'qb.units.title' : game.unit === 'hero' ? 'qb.units.hero' : game.unit === 'player' ? 'qb.units.player' : 'qb.units.character'

const typeOf = (list: DraftOption[]) => list[0]?.kind ?? 'entity'

const retype = (list: DraftOption[], kind: DraftOption['kind']) => list.map((one) => (one.kind === kind ? one : blankOption(kind)))

function AnswerType({ game, list, label, onPick }: { game: Game; list: DraftOption[]; label: string; onPick: (kind: DraftOption['kind']) => void }) {
  const { t } = useI18n()
  const guard = useGuard()
  const value = typeOf(list)
  const kinds = [
    { value: 'entity' as const, label: t(unitsKey(game)), icon: <UserIcon /> },
    ...(game.id === 'dota' ? [{ value: 'ability' as const, label: t('qb.units.ability'), icon: <SparkIcon /> }] : []),
    { value: 'image' as const, label: t('qb.units.image'), icon: <PictureIcon /> },
    { value: 'text' as const, label: t('qb.units.text'), icon: <TextIcon /> },
  ]
  return (
    <div className="qb-atype">
      <span className="quiz-admin-label">{label}</span>
      <div className="qb-atype-list" role="radiogroup" aria-label={label}>
        {kinds.map((one) => (
          <button key={one.value} type="button" role="radio" aria-checked={value === one.value} className={value === one.value ? 'on' : ''} onClick={() => value !== one.value && guard(list.some(optionFilled), () => onPick(one.value))}>
            {one.icon}
            {one.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function Tools({ at, size, onMove, onDrop, dropLabel }: { at: number; size: number; onMove: (step: number) => void; onDrop: () => void; dropLabel: string }) {
  const { t } = useI18n()
  return (
    <span className="quiz-admin-qtools">
      <button type="button" className="ghost" disabled={at === 0} onClick={() => onMove(-1)} aria-label={t('qb.up')}>
        <UpIcon />
      </button>
      <button type="button" className="ghost" disabled={at === size - 1} onClick={() => onMove(1)} aria-label={t('qb.down')}>
        <DownIcon />
      </button>
      <button type="button" className="ghost is-danger" disabled={size <= 2} onClick={onDrop} aria-label={dropLabel}>
        <CloseIcon />
      </button>
    </span>
  )
}

const shifted = <T,>(list: T[], at: number, step: number) => {
  const next = [...list]
  const [item] = next.splice(at, 1)
  next.splice(at + step, 0, item!)
  return next
}

function QuestionBody({ game, byId, question, onChange }: { game: Game; byId: Map<number, Entity>; question: DraftQuestion; onChange: (question: DraftQuestion) => void }) {
  const { t } = useI18n()

  if (question.kind === 'name') {
    return (
      <div className="qb-answer">
        <span className="quiz-admin-label">{t('qb.answer')}</span>
        <EntityPick game={game} byId={byId} id={question.answer} onPick={(answer) => onChange({ ...question, answer })} />
      </div>
    )
  }

  if (question.kind === 'bool') {
    return (
      <div className="qb-answer">
        <span className="quiz-admin-label">{t('qb.answer')}</span>
        <div className="qb-bool">
          {[true, false].map((answer) => (
            <button key={String(answer)} type="button" className={`qb-bool-pick ${answer ? 'is-true' : 'is-false'} ${question.answer === answer ? 'on' : ''}`} onClick={() => onChange({ ...question, answer })}>
              {answer ? <CheckIcon /> : <CloseIcon />}
              {t(answer ? 'quiz.true' : 'quiz.false')}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (question.kind === 'order') {
    const set = (options: DraftOption[]) => onChange({ ...question, options })
    const dups = repeats(question.options)
    return (
      <>
        <AnswerType game={game} label={t('qb.answers')} list={question.options} onPick={(kind) => set(retype(question.options, kind))} />
        <p className="quiz-admin-hint">{t('qb.orderHint')}</p>
        <ul className="quiz-admin-options">
          {question.options.map((option, at) => (
            <li key={at}>
              <span className="quiz-admin-place">{at + 1}</span>
              <OptionField game={game} byId={byId} option={option} taken={takenIn(question.options, at)} dup={dups.has(at)} onChange={(next) => set(question.options.map((one, i) => (i === at ? next : one)))} />
              <Tools at={at} size={question.options.length} onMove={(step) => set(shifted(question.options, at, step))} onDrop={() => set(question.options.filter((_, i) => i !== at))} dropLabel={t('qb.remove')} />
            </li>
          ))}
        </ul>
        <button type="button" className="ghost qb-add-row" disabled={question.options.length >= MAX_OPTIONS} onClick={() => set([...question.options, nextOption(question.options)])}>
          {t('qb.addOption', { n: question.options.length, max: MAX_OPTIONS })}
        </button>
      </>
    )
  }

  if (question.kind === 'pairs') {
    const leftDups = repeats(question.left)
    const rightDups = repeats(question.right)
    const setSide = (side: 'left' | 'right', at: number, option: DraftOption) => onChange({ ...question, [side]: question[side].map((one, i) => (i === at ? option : one)) })
    return (
      <>
        <div className="qb-atype-pair">
          <AnswerType game={game} label={t('qb.side.left')} list={question.left} onPick={(kind) => onChange({ ...question, left: retype(question.left, kind) })} />
          <AnswerType game={game} label={t('qb.side.right')} list={question.right} onPick={(kind) => onChange({ ...question, right: retype(question.right, kind) })} />
        </div>
        <p className="quiz-admin-hint">{t('qb.pairsHint')}</p>
        <ul className="quiz-admin-pairs">
          {question.left.map((option, at) => (
            <li key={at}>
              <div className="quiz-admin-pair-side">
                <OptionField game={game} byId={byId} option={option} taken={takenIn(question.left, at)} dup={leftDups.has(at)} onChange={(next) => setSide('left', at, next)} />
              </div>
              <span className="quiz-admin-pair-link" aria-hidden />
              <div className="quiz-admin-pair-side">
                <OptionField game={game} byId={byId} option={question.right[at]!} taken={takenIn(question.right, at)} dup={rightDups.has(at)} onChange={(next) => setSide('right', at, next)} />
              </div>
              <button
                type="button"
                className="ghost is-danger"
                disabled={question.left.length <= 2}
                onClick={() => onChange({ ...question, left: question.left.filter((_, i) => i !== at), right: question.right.filter((_, i) => i !== at) })}
                aria-label={t('qb.remove')}
              >
                <CloseIcon />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="ghost qb-add-row"
          disabled={question.left.length >= MAX_PAIRS}
          onClick={() => onChange({ ...question, left: [...question.left, nextOption(question.left)], right: [...question.right, nextOption(question.right)] })}
        >
          {t('qb.addPair', { n: question.left.length, max: MAX_PAIRS })}
        </button>
      </>
    )
  }

  const dups = repeats(question.options)
  const setOption = (at: number, option: DraftOption) => onChange({ ...question, options: question.options.map((one, i) => (i === at ? option : one)) })
  const toggleCorrect = (at: number) => {
    const has = question.correct.includes(at)
    const correct = question.multi ? (has ? question.correct.filter((one) => one !== at) : [...question.correct, at].sort((a, b) => a - b)) : has ? [] : [at]
    onChange({ ...question, correct })
  }
  const move = (at: number, step: number) => {
    const order = shifted(question.options.map((_, i) => i), at, step)
    onChange({ ...question, options: order.map((i) => question.options[i]!), correct: question.correct.map((one) => order.indexOf(one)).sort((a, b) => a - b) })
  }
  const dropOption = (at: number) =>
    onChange({
      ...question,
      options: question.options.filter((_, i) => i !== at),
      correct: question.correct.filter((one) => one !== at).map((one) => (one > at ? one - 1 : one)),
    })

  return (
    <>
      <AnswerType game={game} label={t('qb.answers')} list={question.options} onPick={(kind) => onChange({ ...question, options: retype(question.options, kind) })} />
      <div className="qb-choice-head">
        <p className="quiz-admin-hint">{t('qb.choiceHint')}</p>
        <label className="qb-switch">
          <input
            type="checkbox"
            checked={question.multi}
            onChange={(event) => onChange({ ...question, multi: event.target.checked, correct: event.target.checked ? question.correct : question.correct.slice(0, 1) })}
          />
          <span aria-hidden />
          {t('qb.multi')}
        </label>
      </div>
      <ul className="quiz-admin-options is-grid">
        {question.options.map((option, at) => (
          <li key={at} className={question.correct.includes(at) ? 'is-correct' : ''}>
            <button type="button" className={`quiz-admin-correct ${question.multi ? '' : 'is-round'}`} title={t('qb.answer')} onClick={() => toggleCorrect(at)}>
              {question.correct.includes(at) && <CheckIcon />}
            </button>
            <OptionField game={game} byId={byId} option={option} taken={takenIn(question.options, at)} dup={dups.has(at)} onChange={(next) => setOption(at, next)} />
            <Tools at={at} size={question.options.length} onMove={(step) => move(at, step)} onDrop={() => dropOption(at)} dropLabel={t('qb.remove')} />
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="ghost qb-add-row"
        disabled={question.options.length >= MAX_OPTIONS}
        onClick={() => onChange({ ...question, options: [...question.options, nextOption(question.options)] })}
      >
        {t('qb.addOption', { n: question.options.length, max: MAX_OPTIONS })}
      </button>
    </>
  )
}

function SegTabs<T extends string>({ label, value, items, onPick }: { label: string; value: T; items: { value: T; icon?: ReactNode; label: string }[]; onPick: (value: T) => void }) {
  const row = useRef<HTMLDivElement>(null)
  const [ink, setInk] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  const slide = useCallback(() => {
    const on = row.current?.querySelector<HTMLElement>('.cat-tab.active')
    setInk(on ? { x: on.offsetLeft, y: on.offsetTop, w: on.offsetWidth, h: on.offsetHeight } : null)
  }, [])

  useLayoutEffect(() => {
    slide()
    const track = row.current
    const on = track?.querySelector<HTMLElement>('.cat-tab.active')
    if (track && on && track.scrollWidth > track.clientWidth) track.scrollTo({ left: Math.max(0, on.offsetLeft - (track.clientWidth - on.offsetWidth) / 2) })
  }, [slide, value])

  useEffect(() => {
    const track = row.current
    if (!track || typeof ResizeObserver === 'undefined') return
    const watcher = new ResizeObserver(slide)
    watcher.observe(track)
    return () => watcher.disconnect()
  }, [slide])

  return (
    <Rail className="cat-rail qb-seg" trackClass="rail-chips" innerRef={row}>
      <span
        className={`seg-ink ${ink ? 'is-set' : ''}`}
        style={ink ? { transform: `translate(${ink.x}px, ${ink.y}px)`, width: ink.w, height: ink.h } : undefined}
        aria-hidden
      />
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="radio"
          aria-checked={value === item.value}
          aria-label={label}
          className={`cat-tab ${value === item.value ? 'active' : ''}`}
          onClick={() => value !== item.value && onPick(item.value)}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </Rail>
  )
}

function QuestionEditor({
  game,
  byId,
  question,
  index,
  total,
  onChange,
  onMove,
  onDuplicate,
  onDrop,
  nav,
}: {
  game: Game
  byId: Map<number, Entity>
  question: DraftQuestion
  index: number
  total: number
  onChange: (question: DraftQuestion) => void
  onMove: (step: number) => void
  onDuplicate: () => void
  onDrop: () => void
  nav?: ReactNode
}) {
  const { t } = useI18n()
  const guard = useGuard()
  return (
    <section className="qb-card qb-question">
      {nav}
      <header className="qb-card-head">
        <div className="qb-card-title">
          <b>{t('qb.question', { n: index + 1 })}</b>
        </div>
        <span className="qb-card-tools">
          <button type="button" className="qb-icon" disabled={index === 0} onClick={() => onMove(-1)} title={t('qb.up')} aria-label={t('qb.up')}>
            <UpIcon />
          </button>
          <button type="button" className="qb-icon" disabled={index === total - 1} onClick={() => onMove(1)} title={t('qb.down')} aria-label={t('qb.down')}>
            <DownIcon />
          </button>
          <button type="button" className="qb-icon" disabled={total >= MAX_QUESTIONS} onClick={onDuplicate} title={t('qb.duplicate')} aria-label={t('qb.duplicate')}>
            <CopyIcon />
          </button>
          <button type="button" className="qb-icon is-danger" disabled={total <= 1} onClick={onDrop} title={t('qb.removeQuestion')} aria-label={t('qb.removeQuestion')}>
            <CloseIcon />
          </button>
        </span>
      </header>

      <SegTabs
        label={t('qb.type')}
        value={question.kind}
        items={KINDS.map((kind) => ({ value: kind, icon: KIND_ICON[kind], label: t(`qb.kind.${kind}` as UiKey) }))}
        onPick={(kind) => guard(hasAnswers(question), () => onChange({ ...blank(kind, question.text), picture: question.picture }))}
      />

      <div className="qb-qrow">
        <QuestionPicture game={game} picture={question.picture} onChange={(picture) => onChange({ ...question, picture })} />
        <textarea className="quiz-admin-input qb-text" rows={3} maxLength={300} placeholder={t('qb.questionPh')} value={question.text} onChange={(event) => onChange({ ...question, text: event.target.value })} />
      </div>
      <div className="qb-divider" />
      <QuestionBody game={game} byId={byId} question={question} onChange={onChange} />
    </section>
  )
}

function Settings({
  mode,
  quiz,
  game,
  patch,
  onWorld,
  onDrop,
  author,
}: {
  mode: Mode
  quiz: Draft
  game: Game
  patch: (next: Partial<Draft>) => void
  onWorld: (id: GameId) => void
  onDrop: () => void
  author?: ReactNode
}) {
  const { t, l } = useI18n()
  const { busy, failed, pick } = useUpload(false, (saved) => patch({ cover: { kind: 'upload', ...saved } }))
  const art = coverUrl(game.id, quiz.cover)
  return (
    <section className="qb-card qb-settings">
      <header className="qb-card-head">
        <span className="qb-num is-gear">
          <GearIcon />
        </span>
        <div className="qb-card-title">
          <small>{t('qb.settingsLead')}</small>
          <b>{t('qb.settings')}</b>
        </div>
      </header>

      <div className="qb-settings-grid">
        <div className="qb-cover">
          <span className="qb-cover-art">{art ? <img src={art} alt="" /> : <span>{t('qb.noCover')}</span>}</span>
          <label className={`ghost qb-file ${busy ? 'is-busy' : ''}`}>
            {busy ? t('qb.uploading') : t('qb.coverUpload')}
            <input type="file" accept="image/*" disabled={busy} onChange={(event) => void pick(event.target.files?.[0])} />
          </label>
          {failed && <span className="quiz-admin-hint is-error">{t('qb.uploadFailed')}</span>}
          {quiz.cover && (
            <button type="button" className="qb-link is-danger" onClick={() => patch({ cover: null })}>
              {t('qb.coverDrop')}
            </button>
          )}
        </div>

        <div className="qb-fields">
          <label className="quiz-admin-field">
            <span className="quiz-admin-label">{t('qb.titleLabel')}</span>
            <input className={`quiz-admin-input qb-title-input ${quiz.title.trim() ? '' : 'is-missing'}`} maxLength={80} value={quiz.title} placeholder={t('qb.titlePh')} onChange={(event) => patch({ title: event.target.value })} />
          </label>
          <div className="quiz-admin-field">
            <Picker
              rich
              label={l(game.label)}
              value={quiz.game}
              onChange={(next) => onWorld(next as GameId)}
              options={QUIZ_WORLDS.map((one) => ({
                value: one.id,
                label: l(one.label),
                accent: one.accent,
                hint: t('lb.world').toUpperCase(),
                media: <WorldMark game={one.id} className="picker-mark" style={{ '--tab-accent': one.accent } as CSSProperties} />,
              }))}
            />
          </div>
          <div className="quiz-admin-field">
            <span className="quiz-admin-label">{t('qb.format')}</span>
            <div className="qb-formats">
              {(['steps', 'list'] as const).map((layout) => (
                <button key={layout} type="button" className={quiz.layout === layout ? 'on' : ''} onClick={() => patch({ layout })}>
                  <b>{t(`qb.format.${layout}` as UiKey)}</b>
                  <small>{t(`qb.format.${layout}Hint` as UiKey)}</small>
                </button>
              ))}
            </div>
          </div>
          {mode === 'admin' && (
            <>
              {author}
              <div className="quiz-admin-field">
                <span className="quiz-admin-label">Статус</span>
                <AdminSelect<QuizStatus>
                  value={quiz.status}
                  choices={(['draft', 'review', 'published', 'rejected'] as const).map((status) => ({ value: status, label: t(`qb.status.${status}` as UiKey) }))}
                  onPick={(status) => patch({ status })}
                />
              </div>
              {quiz.status === 'rejected' && (
                <label className="quiz-admin-field">
                  <span className="quiz-admin-label">Причина отказа — её увидит автор</span>
                  <textarea className="quiz-admin-input" rows={2} maxLength={300} value={quiz.note ?? ''} onChange={(event) => patch({ note: event.target.value })} />
                </label>
              )}
            </>
          )}
        </div>
      </div>
      {quiz.id && (
        <footer className="qb-settings-foot">
          <button type="button" className="qb-drop-link" onClick={onDrop}>
            <TrashIcon />
            {t('qb.deleteQuiz')}
          </button>
        </footer>
      )}
    </section>
  )
}

const mix = (size: number, seed: number) => {
  const order = Array.from({ length: size }, (_, i) => i)
  let state = seed * 9301 + 49297
  for (let i = size - 1; i > 0; i--) {
    state = (state * 9301 + 49297) % 233280
    const j = Math.floor((state / 233280) * (i + 1))
    ;[order[i], order[j]] = [order[j]!, order[i]!]
  }
  if (size > 1 && order.every((one, i) => one === i)) order.push(order.shift()!)
  return order
}

const viewOption = (option: DraftOption): QuizOption => {
  if (option.kind === 'entity') return { kind: 'entity', id: option.id! }
  if (option.kind === 'ability') return { kind: 'ability', hero: option.hero!, key: option.key!, name: HEROES[String(option.hero)]?.find((one) => one.key === option.key)?.name ?? null }
  if (option.kind === 'image') return { kind: 'image', key: option.key!, ver: option.ver ?? '', text: option.text }
  return { kind: 'text', text: option.text }
}

function playable(question: DraftQuestion, at: number): { view: QuizQuestionView; solution: number[] | number } {
  const base = { text: question.text, picture: question.picture ?? null }
  if (question.kind === 'choice') return { view: { ...base, kind: 'choice', multi: question.multi, options: question.options.map(viewOption) }, solution: question.correct }
  if (question.kind === 'name') return { view: { ...base, kind: 'name' }, solution: question.answer! }
  if (question.kind === 'bool') return { view: { ...base, kind: 'bool' }, solution: question.answer ? 1 : 0 }
  const size = question.kind === 'order' ? question.options.length : question.right.length
  const order = mix(size, at + 1)
  const solution = Array.from({ length: size }, (_, slot) => order.indexOf(slot))
  if (question.kind === 'order') return { view: { ...base, kind: 'order', options: order.map((one) => viewOption(question.options[one]!)) }, solution }
  return { view: { ...base, kind: 'pairs', left: question.left.map(viewOption), right: order.map((one) => viewOption(question.right[one]!)) }, solution }
}

const same = (value: QuizValue, solution: number[] | number) =>
  Array.isArray(solution) ? Array.isArray(value) && value.length === solution.length && value.every((one, i) => one === solution[i]) : value === solution

function TryRun({ game, byId, quiz }: { game: Game; byId: Map<number, Entity>; quiz: Draft }) {
  const { t } = useI18n()
  const plays = useMemo(() => quiz.questions.map((question, at) => playable(question, at)), [quiz.questions])
  const fresh = (): QuizAttempt => ({ answered: 0, finished: false, score: 0, total: plays.length, answers: [] })
  const [attempt, setAttempt] = useState<QuizAttempt>(fresh)
  const [runs, setRuns] = useState(1)

  const finish = (answers: QuizValue[]): QuizAttempt => {
    const marks = plays.map((play, at) => same(answers[at] ?? null, play.solution))
    const reveal = runs > 1
    return {
      answered: answers.length,
      finished: true,
      score: marks.filter(Boolean).length,
      total: plays.length,
      answers,
      results: marks.map((right, at) => (reveal ? { right, correct: plays[at]!.solution } : { right })),
      reveal,
      xp: null,
    }
  }

  const send = (body: Record<string, unknown>) => {
    if (body.action === 'restart') {
      setRuns((current) => current + 1)
      setAttempt(fresh())
    } else if (body.action === 'answer') {
      const answers = [...attempt.answers, body.value as QuizValue]
      setAttempt(answers.length >= plays.length ? finish(answers) : { ...attempt, answered: answers.length, answers })
    } else if (body.action === 'finish') {
      setAttempt(finish(body.answers as QuizValue[]))
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const view: QuizView = {
    id: quiz.id ?? 'preview',
    game: quiz.game,
    title: quiz.title,
    cover: quiz.cover,
    layout: quiz.layout,
    count: plays.length,
    kinds: [...new Set(quiz.questions.map((one) => one.kind))],
    questions: plays.map((play) => play.view),
    attempt,
  }

  return (
    <div className="qb-try">
      <p className="qb-try-note">{t('qb.try.note')}</p>
      <QuizRun
        game={game}
        byId={byId}
        quiz={view}
        busy={false}
        error=""
        likeNote=""
        onSend={send}
      />
    </div>
  )
}

type Asking = { title: string; hint: string; action: string; danger: boolean; run: () => void }

function Ask({ ask, onClose }: { ask: Asking; onClose: () => void }) {
  const { t } = useI18n()
  useEffect(() => {
    const keys = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', keys)
    return () => document.removeEventListener('keydown', keys)
  }, [onClose])
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <section className="card modal qb-ask" role="dialog" aria-modal="true" aria-label={ask.title} onClick={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" aria-label={t('profile.cancel')} onClick={onClose}>
          <CloseIcon />
        </button>
        <h2>{ask.title}</h2>
        <p>{ask.hint}</p>
        <div className="qb-ask-actions">
          <button type="button" className="qb-ask-btn" onClick={onClose}>
            {t('profile.cancel')}
          </button>
          <button
            type="button"
            className={`qb-ask-btn ${ask.danger ? 'is-danger' : 'is-main'}`}
            autoFocus
            onClick={() => {
              onClose()
              ask.run()
            }}
          >
            {ask.action}
          </button>
        </div>
      </section>
    </div>
  )
}

const STEP_ICONS = [<GearIcon key="main" />, <PencilIcon key="questions" />, <PlayIcon key="check" />]

const storeKey = (draft: Draft) => `qb:${draft.id ?? `new:${draft.game}`}`

function readStored(draft: Draft): Draft | null {
  try {
    const raw = window.localStorage.getItem(storeKey(draft))
    const stored = raw ? (JSON.parse(raw) as Draft) : null
    return stored && stored.game === draft.game && Array.isArray(stored.questions) ? stored : null
  } catch {
    return null
  }
}

function writeStored(draft: Draft, value: Draft | null) {
  try {
    if (value) window.localStorage.setItem(storeKey(draft), JSON.stringify(value))
    else window.localStorage.removeItem(storeKey(draft))
  } catch {}
}

const stripped = (quiz: Draft) => JSON.stringify({ ...quiz, status: undefined, note: undefined })

export default function QuizBuilder({
  mode,
  draft,
  onSaved,
  onDropped,
  author,
}: {
  mode: Mode
  draft: Draft
  onSaved: (quiz: SavedDraft) => void
  onDropped: (id: string) => void
  author?: ReactNode
}) {
  const { t } = useI18n()
  const href = useHref()
  const [quiz, setQuiz] = useState(draft)
  const [base, setBase] = useState(draft)
  const [sel, setSel] = useState(0)
  const [step, setStep] = useState(draft.id ? 1 : 0)
  const [sent, setSent] = useState(false)
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null)
  const [badAt, setBadAt] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const restored = useRef(false)
  const [ask, setAsk] = useState<Asking | null>(null)
  const game = GAMES.find((one) => one.id === quiz.game)!
  const ready = useEntities(game)
  const byId = useMemo(() => new Map(game.entities.map((one) => [one.id, one])), [game, ready])
  const endpoint = mode === 'admin' ? 'admin/quizzes' : 'my/quizzes'

  useEffect(() => {
    if (restored.current) return
    restored.current = true
    const stored = readStored(draft)
    if (stored && stripped(stored) !== stripped(draft)) setQuiz({ ...stored, id: draft.id, status: draft.status, note: draft.note })
  }, [draft])

  const dirty = stripped(quiz) !== stripped(base) || (mode === 'admin' && (quiz.status !== base.status || quiz.note !== base.note))

  useEffect(() => {
    if (!restored.current) return
    const timer = window.setTimeout(() => writeStored(draft, dirty ? quiz : null), 400)
    return () => window.clearTimeout(timer)
  }, [quiz, dirty, draft])

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = t('qb.leave')
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, t])

  useEffect(() => {
    if (!note || note.bad) return
    const timer = window.setTimeout(() => setNote(null), 6000)
    return () => window.clearTimeout(timer)
  }, [note])

  const patch = (next: Partial<Draft>) => setQuiz((current) => ({ ...current, ...next }))
  const setQuestions = (questions: DraftQuestion[]) => patch({ questions })
  const issues = quiz.questions.map(issueOf)
  const issueCount = issues.filter(Boolean).length + (quiz.title.trim() ? 0 : 1)
  const current = Math.max(0, Math.min(sel, quiz.questions.length - 1))
  const titleOk = !!quiz.title.trim()
  const questionsOk = quiz.questions.length > 0 && issues.every((one) => !one)
  const steps = [
    { key: 'qb.step.main' as UiKey, ok: titleOk },
    { key: 'qb.step.questions' as UiKey, ok: questionsOk },
    { key: 'qb.step.check' as UiKey, ok: titleOk && questionsOk },
  ]
  const go = (next: number) => {
    setStep(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const openQuestion = (at: number) => {
    setSel(at)
    go(1)
  }

  const add = (kind: QuizKind) => {
    setQuestions([...quiz.questions, blank(kind)])
    setSel(quiz.questions.length)
  }

  const switchWorld = (id: GameId) =>
    setQuiz((current) => ({ ...freshDraft(id), id: current.id, title: current.title, layout: current.layout, status: current.status, note: current.note }))

  const changeWorld = (id: GameId) => {
    if (id === quiz.game) return
    if (!quiz.questions.some((one) => one.text)) return switchWorld(id)
    setAsk({ title: t('qb.worldChangeTitle'), hint: t('qb.worldChange'), action: t('qb.worldChangeOk'), danger: false, run: () => switchWorld(id) })
  }

  const firstProblem = () => {
    if (!quiz.title.trim()) return { at: null, key: 'qb.err.title' as UiKey }
    const at = issues.findIndex(Boolean)
    return at >= 0 ? { at, key: issues[at]! } : null
  }

  const save = async (submit = false) => {
    const problem = mode === 'admin' || submit ? firstProblem() : null
    if (problem) {
      if (problem.at === null) go(0)
      else openQuestion(problem.at)
      setBadAt(problem.at)
      const reason = t(problem.key, { max: 30 })
      return setNote({ text: problem.at === null ? t('qb.failed', { reason }) : t('qb.failedAt', { n: problem.at + 1, reason }), bad: true })
    }
    setBusy(true)
    setNote(null)
    setBadAt(null)
    const { ok, status, data } = await api<{ quiz?: SavedDraft; error?: string; at?: number }>(endpoint, { ...quiz, submit }).catch(() => ({
      ok: false,
      status: 0,
      data: {} as { quiz?: SavedDraft; error?: string; at?: number },
    }))
    setBusy(false)
    if (!ok || !data.quiz) {
      const at = typeof data.at === 'number' ? data.at : null
      const key = status === 404 && mode === 'admin' ? null : ERRORS[data.error ?? '']
      const reason = key ? t(key, { max: 30 }) : status === 404 ? 'нет доступа — войди под админским аккаунтом' : t('qb.err.server')
      setBadAt(at)
      if (at !== null) openQuestion(at)
      return setNote({ text: at !== null ? t('qb.failedAt', { n: at + 1, reason }) : t('qb.failed', { reason }), bad: true })
    }
    writeStored(draft, null)
    const saved = { ...quiz, ...data.quiz }
    setQuiz(saved)
    setBase(saved)
    if (submit && mode === 'user') {
      setSent(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else setNote({ text: mode === 'admin' ? t('qb.saved') : t('qb.savedDraft'), bad: false })
    onSaved(saved)
  }

  const saveChecked = (submit: boolean) => {
    if (mode !== 'user' || base.status !== 'published') return void save(submit)
    setAsk({
      title: t(submit ? 'qb.live.submitTitle' : 'qb.live.draftTitle'),
      hint: t(submit ? 'qb.live.submitHint' : 'qb.live.draftHint'),
      action: t(submit ? 'qb.submitShort' : 'qb.saveDraft'),
      danger: !submit,
      run: () => void save(submit),
    })
  }

  const remove = async () => {
    if (!quiz.id) return
    const { ok } = await api(`${endpoint}/drop`, { id: quiz.id })
    if (!ok) return setNote({ text: t('qb.failed', { reason: t('qb.err.server') }), bad: true })
    writeStored(draft, null)
    onDropped(quiz.id)
  }

  const drop = () => setAsk({ title: t('qb.deleteConfirm'), hint: t('qb.deleteHint'), action: t('qb.delete'), danger: true, run: () => void remove() })

  const outline = (
    <div className="qb-qbar">
      <ol className="qb-chips">
        {quiz.questions.map((question, at) => (
          <li key={at}>
            <button
              type="button"
              className={`qb-chip ${current === at ? 'on' : ''} ${issues[at] ? 'has-issue' : ''} ${badAt === at ? 'is-bad' : ''}`}
              title={issues[at] ? t(issues[at]!) : question.text}
              aria-label={t('qb.question', { n: at + 1 })}
              onClick={() => setSel(at)}
            >
              {at + 1}
            </button>
          </li>
        ))}
        <li>
          <button type="button" className="qb-chip is-add" disabled={quiz.questions.length >= MAX_QUESTIONS} onClick={() => add('choice')} title={t('qb.addQuestion')} aria-label={t('qb.addQuestion')}>
            <PlusIcon />
          </button>
        </li>
      </ol>
    </div>
  )

  const editor = !quiz.questions.length ? (
    <div className="qb-card qb-empty-q">
      {outline}
      <p>{t('qb.noQuestions')}</p>
    </div>
  ) : !ready ? (
    <div className="qb-card qb-loading" />
  ) : (
    <QuestionEditor
      key={current}
      nav={outline}
      game={game}
      byId={byId}
      question={quiz.questions[current]!}
      index={current}
      total={quiz.questions.length}
      onChange={(next) => {
        if (badAt === current) setBadAt(null)
        setQuestions(quiz.questions.map((one, i) => (i === current ? next : one)))
      }}
      onMove={(shift) => {
        setQuestions(shifted(quiz.questions, current, shift))
        setSel(current + shift)
      }}
      onDuplicate={() => {
        const list = [...quiz.questions]
        list.splice(current + 1, 0, structuredClone(quiz.questions[current]!))
        setQuestions(list)
        setSel(current + 1)
      }}
      onDrop={() => {
        setQuestions(quiz.questions.filter((_, i) => i !== current))
        setSel(Math.max(0, current - 1))
      }}
    />
  )

  const checklist = (
    <section className="qb-card qb-checklist">
      <header className="qb-card-head">
        <span className="qb-num">
          <CheckIcon />
        </span>
        <div className="qb-card-title">
          <small>{t('qb.try.locked')}</small>
          <b>{t('qb.check.title')}</b>
        </div>
        <em className="qb-check-count">
          {quiz.questions.length + 1 - issueCount}/{quiz.questions.length + 1}
        </em>
      </header>
      <span className="qb-check-bar" aria-hidden>
        <i style={{ width: `${((quiz.questions.length + 1 - issueCount) / (quiz.questions.length + 1)) * 100}%` }} />
      </span>
      <ul>
        <li className={titleOk ? 'is-ok' : 'is-bad'}>
          <button type="button" onClick={() => go(0)}>
            <i>{titleOk ? <CheckIcon /> : <CloseIcon />}</i>
            <span>
              <b>{t('qb.titleLabel')}</b>
              <small>{titleOk ? quiz.title : t('qb.err.title')}</small>
            </span>
            <ArrowIcon />
          </button>
        </li>
        {quiz.questions.map((question, at) => (
          <li key={at} className={issues[at] ? 'is-bad' : 'is-ok'}>
            <button type="button" onClick={() => openQuestion(at)}>
              <i>{issues[at] ? <CloseIcon /> : <CheckIcon />}</i>
              <span>
                <b>{t('qb.question', { n: at + 1 })}</b>
                <small>{issues[at] ? t(issues[at]!) : question.text}</small>
              </span>
              <ArrowIcon />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )

  const review =
    titleOk && questionsOk ? (
      ready ? (
        <TryRun key={JSON.stringify(quiz.questions)} game={game} byId={byId} quiz={quiz} />
      ) : (
        <div className="qb-card qb-loading" />
      )
    ) : (
      <div className="qb-pane qb-locked">{checklist}</div>
    )

  return (
    <Guard.Provider value={(run) => setAsk({ title: t('qb.reset.title'), hint: t('qb.reset.hint'), action: t('qb.reset.ok'), danger: false, run })}>
    <UploadPath.Provider value={`${endpoint}/cover`}>
      <div className="qb quiz-admin">
        <div className="qb-layout">
        <nav className="qb-side">
          <ol>
            {steps.map((one, at) => (
              <li key={one.key} className={`${step === at ? 'on' : ''} ${one.ok && at < 2 ? 'is-ok' : ''}`}>
                <button type="button" onClick={() => go(at)} aria-current={step === at ? 'step' : undefined}>
                  <i>{one.ok && at < 2 ? <CheckIcon /> : STEP_ICONS[at]}</i>
                  <span>{t(one.key)}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <div className="qb-main">

        {mode === 'user' && quiz.status === 'published' && !sent && <p className="qb-banner">{t('qb.republish')}</p>}
        {mode === 'user' && quiz.status === 'rejected' && quiz.note && !sent && <p className="qb-banner is-bad">{t('qb.rejectNote', { note: quiz.note })}</p>}

        {sent ? (
          <section className="qb-card qb-sent">
            <span className="qb-sent-icon">
              <CheckIcon />
            </span>
            <h2>{t('qb.sent.title')}</h2>
            <p>{t('qb.sent.lead')}</p>
            <div className="qb-sent-actions">
              <button type="button" className="quiz-btn is-ghost" onClick={() => setSent(false)}>
                {t('qb.sent.edit')}
              </button>
              <Link className="quiz-btn" href={href.myTests}>
                {t('qb.sent.mine')}
              </Link>
            </div>
          </section>
        ) : step === 0 ? (
          <div className="qb-pane">
            <Settings mode={mode} quiz={quiz} game={game} patch={patch} onWorld={changeWorld} onDrop={drop} author={author} />
          </div>
        ) : step === 1 ? (
          <div className="qb-pane">
            <div className="qb-split">
              <div className="qb-stage">{editor}</div>
            </div>
          </div>
        ) : (
          review
        )}

        {!sent && (
          <footer className="qb-bar">
            <span className="qb-bar-gap" />
            {quiz.id && quiz.status === 'published' && (
              <Link className="qb-save-link" href={href.test(quiz.game, quiz.id)} target="_blank">
                {t('qb.open')}
              </Link>
            )}
            {(mode === 'user' || step < 2) && (
              <button type="button" className="qb-save-link" disabled={busy} onClick={() => saveChecked(false)}>
                <span className="is-long">{t(mode === 'user' ? 'qb.saveDraft' : 'qb.save')}</span>
                <span className="is-short">{t('qb.save')}</span>
              </button>
            )}
            {step < 2 ? (
              <button type="button" className="quiz-btn" onClick={() => go(step + 1)}>
                {t('qb.preview.next')}
                <ArrowIcon />
              </button>
            ) : mode === 'admin' ? (
              <button type="button" className="quiz-btn" disabled={busy} onClick={() => void save()}>
                {t('qb.save')}
              </button>
            ) : (
              <button type="button" className="quiz-btn" disabled={busy || issueCount > 0} title={issueCount ? t('qb.issues', { count: issueCount }) : undefined} onClick={() => saveChecked(true)}>
                <span className="is-long">{t('qb.submit')}</span>
                <span className="is-short">{t('qb.submitShort')}</span>
              </button>
            )}
          </footer>
        )}
        </div>
        </div>
      </div>
      {note && (
        <div className={`qb-toast ${note.bad ? 'is-bad' : ''}`} role="status">
          {note.bad ? <CloseIcon /> : <CheckIcon />}
          {note.text}
        </div>
      )}
      {ask && <Ask ask={ask} onClose={() => setAsk(null)} />}
    </UploadPath.Provider>
    </Guard.Provider>
  )
}
