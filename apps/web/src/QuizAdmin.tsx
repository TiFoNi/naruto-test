'use client'

import AdminNav from './AdminNav'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import abilities from '@nanda/game/data/dota-abilities.json'
import { api, apiUrl } from './api'
import AdminSelect from './AdminSelect'
import CharacterSearch from './CharacterSearch'
import { useEntities } from './entities'
import { GAMES } from './games'
import type { Entity, Game, GameId } from './games/types'
import { useI18n } from './i18n'
import { CheckIcon, CloseIcon, DownIcon, UpIcon } from './icons'
import { abilityUrl, picsUrl } from './pics'
import { coverUrl, type QuizCover, type QuizLayout } from './quiz'
import { useHref } from './router'
import Thumb from './Thumb'

type Ability = { key: string; name: { ru: string; uk: string; en: string } }

type DraftOption =
  | { kind: 'entity'; id?: number }
  | { kind: 'ability'; hero?: number; key?: string }
  | { kind: 'text'; text: string }
  | { kind: 'image'; key?: string; ver?: string; text: string }

type DraftQuestion = { picture?: QuizCover } & (
  | { kind: 'choice'; text: string; multi: boolean; options: DraftOption[]; correct: number[] }
  | { kind: 'name'; text: string; answer?: number }
  | { kind: 'bool'; text: string; answer?: boolean }
  | { kind: 'order'; text: string; options: DraftOption[] }
  | { kind: 'pairs'; text: string; left: DraftOption[]; right: DraftOption[] }
)

type Draft = {
  id?: string
  game: GameId
  title: string
  cover: QuizCover
  layout: QuizLayout
  status: 'draft' | 'published'
  questions: DraftQuestion[]
}

type Saved = Draft & { id: string; updatedAt?: string }

const HEROES = abilities as Record<string, Ability[]>

const ERRORS: Record<string, string> = {
  game: 'не выбрана вселенная',
  title: 'нет названия',
  questions: 'нужен хотя бы один вопрос (максимум 50)',
  question_text: 'у вопроса нет текста',
  question_answer: 'не выбран правильный персонаж',
  question_options: 'вариантов должно быть от 2 до 8',
  question_option: 'один из вариантов не заполнен',
  question_correct: 'отметь правильный ответ (для одиночного выбора — ровно один)',
  question_pairs: 'пар должно быть от 2 до 6, слева и справа поровну',
  question_kind: 'неизвестный тип вопроса',
}

const KINDS: { kind: DraftQuestion['kind']; label: string; add: string }[] = [
  { kind: 'choice', label: 'Варианты квадратиками', add: '+ варианты' },
  { kind: 'name', label: 'Ввести имя', add: '+ «впиши имя»' },
  { kind: 'bool', label: 'Правда / неправда', add: '+ правда / неправда' },
  { kind: 'order', label: 'Расставить по порядку', add: '+ по порядку' },
  { kind: 'pairs', label: 'Соединить пары', add: '+ пары' },
]

const blankChoice = (): DraftQuestion => ({ kind: 'choice', text: '', multi: false, options: [{ kind: 'entity' }, { kind: 'entity' }], correct: [] })

const blank = (kind: DraftQuestion['kind'], text = ''): DraftQuestion => {
  if (kind === 'name') return { kind, text }
  if (kind === 'bool') return { kind, text }
  if (kind === 'order') return { kind, text, options: [{ kind: 'entity' }, { kind: 'entity' }, { kind: 'entity' }] }
  if (kind === 'pairs') return { kind, text, left: [{ kind: 'entity' }, { kind: 'entity' }], right: [{ kind: 'text', text: '' }, { kind: 'text', text: '' }] }
  return { ...(blankChoice() as Extract<DraftQuestion, { kind: 'choice' }>), text }
}

const blankOption = (kind: DraftOption['kind']): DraftOption =>
  kind === 'text' || kind === 'image' ? { kind, text: '' } : kind === 'ability' ? { kind: 'ability' } : { kind: 'entity' }

const nextOption = (list: DraftOption[]): DraftOption => blankOption(list.at(-1)?.kind ?? 'entity')

async function uploadPicture(file: File, wide = false) {
  const form = new FormData()
  form.append('file', file)
  if (wide) form.append('wide', '1')
  const answer = await fetch(apiUrl('admin/quizzes/cover'), { method: 'POST', body: form, credentials: 'include' })
  const data = (await answer.json().catch(() => ({}))) as { key?: string; ver?: string }
  return answer.ok && data.key ? { key: data.key, ver: data.ver ?? '' } : null
}

function ImageOption({ option, onChange }: { option: Extract<DraftOption, { kind: 'image' }>; onChange: (option: DraftOption) => void }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const pick = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setFailed(false)
    const saved = await uploadPicture(file)
    setBusy(false)
    if (!saved) return setFailed(true)
    onChange({ ...option, ...saved })
  }
  return (
    <div className="quiz-admin-image">
      <label className={`quiz-admin-image-pick ${option.key ? 'has-pic' : ''} ${busy ? 'is-busy' : ''}`} title="Загрузить картинку">
        {option.key ? <img src={picsUrl(option.key, option.ver ?? '')} alt="" /> : <span>{busy ? '…' : '+'}</span>}
        <input type="file" accept="image/*" disabled={busy} onChange={(event) => void pick(event.target.files?.[0])} />
      </label>
      <input
        className="quiz-admin-input"
        maxLength={80}
        placeholder={failed ? 'Картинка не загрузилась — попробуй ещё раз' : 'Подпись: кто или что на картинке'}
        value={option.text}
        onChange={(event) => onChange({ ...option, text: event.target.value })}
      />
    </div>
  )
}

function QuestionPicture({ game, picture, onChange }: { game: Game; picture?: QuizCover; onChange: (picture: QuizCover) => void }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const pick = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setFailed(false)
    const saved = await uploadPicture(file, true)
    setBusy(false)
    if (!saved) return setFailed(true)
    onChange({ kind: 'upload', ...saved })
  }
  const art = coverUrl(game.id, picture ?? null)
  return (
    <div className={`quiz-admin-qpic ${art ? 'has-pic' : ''}`}>
      {art && <img src={art} alt="" />}
      <div className="quiz-admin-qpic-tools">
        <label className={`ghost quiz-admin-upload ${busy ? 'is-busy' : ''}`}>
          {busy ? 'Загружаю…' : art ? 'Заменить картинку' : '+ Картинка к вопросу'}
          <input type="file" accept="image/*" disabled={busy} onChange={(event) => void pick(event.target.files?.[0])} />
        </label>
        {art && (
          <button type="button" className="ghost" onClick={() => onChange(null)}>
            Убрать
          </button>
        )}
        {failed && <span className="quiz-admin-hint">Картинка не загрузилась — попробуй ещё раз</span>}
      </div>
    </div>
  )
}

const fresh = (game: GameId): Draft => ({ game, title: '', cover: null, layout: 'steps', status: 'draft', questions: [blankChoice()] })

function Chosen({ game, entity, onClear }: { game: Game; entity: Entity; onClear: () => void }) {
  const { name } = useI18n()
  return (
    <span className="quiz-admin-chosen">
      <Thumb game={game} entity={entity} size={34} />
      <b>{name(entity)}</b>
      <button type="button" className="ghost" onClick={onClear}>
        сменить
      </button>
    </span>
  )
}

function EntityPick({ game, byId, id, onPick }: { game: Game; byId: Map<number, Entity>; id?: number; onPick: (id?: number) => void }) {
  const entity = id === undefined ? undefined : byId.get(id)
  if (entity) return <Chosen game={game} entity={entity} onClear={() => onPick(undefined)} />
  return <CharacterSearch game={game} exclude={new Set()} compact pickOnly placeholder={game.unit === 'manga' ? 'Начни вводить название…' : 'Начни вводить имя…'} onPick={(one) => onPick(one.id)} />
}

function OptionEditor({
  game,
  byId,
  option,
  onChange,
}: {
  game: Game
  byId: Map<number, Entity>
  option: DraftOption
  onChange: (option: DraftOption) => void
}) {
  const { l } = useI18n()
  if (option.kind === 'text') {
    return <input className="quiz-admin-input" maxLength={80} placeholder="Впиши текст варианта" value={option.text} onChange={(event) => onChange({ kind: 'text', text: event.target.value })} />
  }
  if (option.kind === 'entity') return <EntityPick game={game} byId={byId} id={option.id} onPick={(id) => onChange({ kind: 'entity', id })} />
  if (option.kind === 'image') return <ImageOption option={option} onChange={onChange} />

  const list = option.hero === undefined ? [] : (HEROES[String(option.hero)] ?? [])
  return (
    <div className="quiz-admin-ability">
      <EntityPick game={game} byId={byId} id={option.hero} onPick={(hero) => onChange({ kind: 'ability', hero })} />
      {list.length > 0 && (
        <div className="quiz-admin-abilities">
          {list.map((one) => (
            <button
              key={one.key}
              type="button"
              className={option.key === one.key ? 'on' : ''}
              title={l(one.name)}
              onClick={() => onChange({ ...option, key: one.key })}
            >
              <img src={abilityUrl(one.key)} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function OptionField({
  game,
  byId,
  option,
  onChange,
}: {
  game: Game
  byId: Map<number, Entity>
  option: DraftOption
  onChange: (option: DraftOption) => void
}) {
  return (
    <>
      <div className="quiz-admin-kind" role="group" aria-label="Что это за вариант">
        {[
          { value: 'entity' as const, label: game.unit === 'manga' ? 'Тайтл' : game.unit === 'hero' ? 'Герой' : game.unit === 'player' ? 'Футболист' : 'Персонаж' },
          ...(game.id === 'dota' ? [{ value: 'ability' as const, label: 'Способность' }] : []),
          { value: 'image' as const, label: 'Картинка' },
          { value: 'text' as const, label: 'Текст' },
        ].map((one) => (
          <button
            key={one.value}
            type="button"
            className={option.kind === one.value ? 'on' : ''}
            onClick={() => option.kind !== one.value && onChange(blankOption(one.value))}
          >
            {one.label}
          </button>
        ))}
      </div>
      <div className="quiz-admin-option">
        <OptionEditor game={game} byId={byId} option={option} onChange={onChange} />
      </div>
    </>
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
  onDrop,
}: {
  game: Game
  byId: Map<number, Entity>
  question: DraftQuestion
  index: number
  total: number
  onChange: (question: DraftQuestion) => void
  onMove: (step: number) => void
  onDrop: () => void
}) {
  const head = (
    <div className="quiz-admin-qhead">
      <em>{index + 1}</em>
      <AdminSelect
        className="quiz-admin-qkind"
        value={question.kind}
        choices={KINDS.map((one) => ({ value: one.kind, label: one.label }))}
        onPick={(kind) => onChange({ ...blank(kind, question.text), picture: question.picture })}
      />
      <span className="quiz-admin-qtools">
        <button type="button" className="ghost" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Выше">
          <UpIcon />
        </button>
        <button type="button" className="ghost" disabled={index === total - 1} onClick={() => onMove(1)} aria-label="Ниже">
          <DownIcon />
        </button>
        <button type="button" className="ghost is-danger" onClick={onDrop} aria-label="Удалить вопрос">
          <CloseIcon />
        </button>
      </span>
    </div>
  )

  const area = (
    <textarea
      className="quiz-admin-input"
      rows={2}
      maxLength={300}
      placeholder="Текст вопроса, как для человека"
      value={question.text}
      onChange={(event) => onChange({ ...question, text: event.target.value })}
    />
  )
  const text = (
    <>
      {area}
      <QuestionPicture game={game} picture={question.picture} onChange={(picture) => onChange({ ...question, picture })} />
    </>
  )

  if (question.kind === 'name') {
    return (
      <section className="card quiz-admin-question">
        {head}
        {text}
        <label className="quiz-admin-label">Правильный ответ</label>
        <EntityPick game={game} byId={byId} id={question.answer} onPick={(answer) => onChange({ ...question, answer })} />
      </section>
    )
  }

  if (question.kind === 'bool') {
    return (
      <section className="card quiz-admin-question">
        {head}
        {text}
        <label className="quiz-admin-label">Правильный ответ</label>
        <div className="quiz-admin-bool">
          {[true, false].map((answer) => (
            <button key={String(answer)} type="button" className={question.answer === answer ? 'primary' : 'ghost'} onClick={() => onChange({ ...question, answer })}>
              {answer ? 'Правда' : 'Неправда'}
            </button>
          ))}
        </div>
      </section>
    )
  }

  if (question.kind === 'order') {
    const set = (options: DraftOption[]) => onChange({ ...question, options })
    const shift = (at: number, step: number) => {
      const list = [...question.options]
      const [item] = list.splice(at, 1)
      list.splice(at + step, 0, item!)
      set(list)
    }
    return (
      <section className="card quiz-admin-question">
        {head}
        {text}
        <p className="quiz-admin-hint">Впиши варианты сразу в правильном порядке — игроку они перемешаются. Вариант — {game.unit === 'manga' ? 'тайтл' : 'персонаж'} из базы или свой текст.</p>
        <ul className="quiz-admin-options">
          {question.options.map((option, at) => (
            <li key={at}>
              <span className="quiz-admin-place">{at + 1}</span>
              <OptionField game={game} byId={byId} option={option} onChange={(next) => set(question.options.map((one, i) => (i === at ? next : one)))} />
              <span className="quiz-admin-qtools">
                <button type="button" className="ghost" disabled={at === 0} onClick={() => shift(at, -1)} aria-label="Выше">
                  <UpIcon />
                </button>
                <button type="button" className="ghost" disabled={at === question.options.length - 1} onClick={() => shift(at, 1)} aria-label="Ниже">
                  <DownIcon />
                </button>
                <button type="button" className="ghost is-danger" disabled={question.options.length <= 2} onClick={() => set(question.options.filter((_, i) => i !== at))} aria-label="Убрать">
                  <CloseIcon />
                </button>
              </span>
            </li>
          ))}
        </ul>
        <button type="button" className="ghost" disabled={question.options.length >= 8} onClick={() => set([...question.options, nextOption(question.options)])}>
          + вариант ({question.options.length}/8)
        </button>
      </section>
    )
  }

  if (question.kind === 'pairs') {
    const setSide = (side: 'left' | 'right', at: number, option: DraftOption) => onChange({ ...question, [side]: question[side].map((one, i) => (i === at ? option : one)) })
    return (
      <section className="card quiz-admin-question">
        {head}
        {text}
        <p className="quiz-admin-hint">Каждая строка — правильная пара: слева и справа выбери {game.unit === 'manga' ? 'тайтл' : 'персонажа'} из базы или впиши текст. Правая сторона игроку перемешается.</p>
        <ul className="quiz-admin-pairs">
          {question.left.map((option, at) => (
            <li key={at}>
              <div className="quiz-admin-pair-side">
                <OptionField game={game} byId={byId} option={option} onChange={(next) => setSide('left', at, next)} />
              </div>
              <span className="quiz-admin-pair-link" aria-hidden />
              <div className="quiz-admin-pair-side">
                <OptionField game={game} byId={byId} option={question.right[at]!} onChange={(next) => setSide('right', at, next)} />
              </div>
              <button
                type="button"
                className="ghost is-danger"
                disabled={question.left.length <= 2}
                onClick={() => onChange({ ...question, left: question.left.filter((_, i) => i !== at), right: question.right.filter((_, i) => i !== at) })}
                aria-label="Убрать пару"
              >
                <CloseIcon />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="ghost"
          disabled={question.left.length >= 6}
          onClick={() => onChange({ ...question, left: [...question.left, nextOption(question.left)], right: [...question.right, nextOption(question.right)] })}
        >
          + пара ({question.left.length}/6)
        </button>
      </section>
    )
  }

  const setOption = (at: number, option: DraftOption) => onChange({ ...question, options: question.options.map((one, i) => (i === at ? option : one)) })
  const toggleCorrect = (at: number) => {
    const has = question.correct.includes(at)
    const correct = question.multi ? (has ? question.correct.filter((one) => one !== at) : [...question.correct, at].sort((a, b) => a - b)) : has ? [] : [at]
    onChange({ ...question, correct })
  }
  const dropOption = (at: number) =>
    onChange({
      ...question,
      options: question.options.filter((_, i) => i !== at),
      correct: question.correct.filter((one) => one !== at).map((one) => (one > at ? one - 1 : one)),
    })

  return (
    <section className="card quiz-admin-question">
      {head}
      {text}
      <label className="quiz-admin-check">
        <input
          type="checkbox"
          checked={question.multi}
          onChange={(event) => onChange({ ...question, multi: event.target.checked, correct: event.target.checked ? question.correct : question.correct.slice(0, 1) })}
        />
        Можно выбрать несколько
      </label>
      <p className="quiz-admin-hint">
        Каждый вариант — {game.unit === 'manga' ? 'тайтл' : 'персонаж'} из базы (найди и выбери в поиске) или свой текст. Нажми на квадрат слева, чтобы отметить правильный ответ{question.multi ? 'ы' : ''}.
      </p>
      <ul className="quiz-admin-options">
        {question.options.map((option, at) => (
          <li key={at} className={question.correct.includes(at) ? 'is-correct' : ''}>
            <button type="button" className="quiz-admin-correct" title="Правильный ответ" onClick={() => toggleCorrect(at)}>
              {question.correct.includes(at) && <CheckIcon />}
            </button>
            <OptionField game={game} byId={byId} option={option} onChange={(next) => setOption(at, next)} />
            <button type="button" className="ghost is-danger" disabled={question.options.length <= 2} onClick={() => dropOption(at)} aria-label="Убрать вариант">
              <CloseIcon />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="ghost"
        disabled={question.options.length >= 8}
        onClick={() => onChange({ ...question, options: [...question.options, nextOption(question.options)] })}
      >
        + вариант ({question.options.length}/8)
      </button>
    </section>
  )
}

function Editor({ draft, onSaved, onDropped }: { draft: Draft; onSaved: (quiz: Saved) => void; onDropped: (id: string) => void }) {
  const { l } = useI18n()
  const href = useHref()
  const [quiz, setQuiz] = useState(draft)
  const [note, setNote] = useState('')
  const [failed, setFailed] = useState(false)
  const [badAt, setBadAt] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const game = GAMES.find((one) => one.id === quiz.game)!
  const ready = useEntities(game)
  const byId = useMemo(() => new Map(game.entities.map((one) => [one.id, one])), [game, ready])

  useEffect(() => setQuiz(draft), [draft])

  const patch = (next: Partial<Draft>) => setQuiz((current) => ({ ...current, ...next }))
  const setQuestion = (at: number, question: DraftQuestion) => patch({ questions: quiz.questions.map((one, i) => (i === at ? question : one)) })
  const move = (at: number, step: number) => {
    const list = [...quiz.questions]
    const [item] = list.splice(at, 1)
    list.splice(at + step, 0, item!)
    patch({ questions: list })
  }

  const save = async () => {
    setBusy(true)
    setNote('')
    setBadAt(null)
    const { ok, status, data } = await api<{ quiz?: Saved; error?: string; at?: number }>('admin/quizzes', quiz)
    setBusy(false)
    if (!ok || !data.quiz) {
      const at = typeof data.at === 'number' ? data.at : null
      const reason = status === 404 ? 'нет доступа — войди под админским аккаунтом' : (ERRORS[data.error ?? ''] ?? data.error ?? 'сервер не ответил')
      setFailed(true)
      setBadAt(at)
      if (at !== null) document.getElementById(`quiz-q-${at}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return setNote(`Не сохранилось: ${at !== null ? `вопрос ${at + 1} — ` : ''}${reason}`)
    }
    setFailed(false)
    setNote(data.quiz.status === 'published' ? 'Сохранено и опубликовано' : 'Сохранено как черновик — на сайте пока не видно')
    onSaved(data.quiz)
  }

  const drop = async () => {
    if (!quiz.id || !confirm('Удалить тест целиком?')) return
    const { ok } = await api('admin/quizzes/drop', { id: quiz.id })
    if (ok) onDropped(quiz.id)
  }

  const upload = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    const saved = await uploadPicture(file)
    setBusy(false)
    if (!saved) return setNote('картинка не загрузилась')
    patch({ cover: { kind: 'upload', ...saved } })
  }

  const art = coverUrl(game.id, quiz.cover)

  return (
    <div className="quiz-admin-editor">
      <section className="card quiz-admin-meta">
        <div className="quiz-admin-cover">
          <span className="quiz-admin-cover-art">{art ? <img src={art} alt="" /> : <span>Без обложки</span>}</span>
          <label className="ghost quiz-admin-upload">
            Загрузить картинку
            <input type="file" accept="image/*" disabled={busy} onChange={(event) => void upload(event.target.files?.[0])} />
          </label>
          {quiz.cover?.kind !== 'entity' && (
            <CharacterSearch game={game} exclude={new Set()} compact pickOnly placeholder="…или персонаж" onPick={(one) => patch({ cover: { kind: 'entity', id: one.id } })} />
          )}
          {quiz.cover && (
            <button type="button" className="ghost" onClick={() => patch({ cover: null })}>
              Убрать обложку
            </button>
          )}
        </div>

        <div className="quiz-admin-fields">
          <label className="quiz-admin-field">
            <span className="quiz-admin-label">Название</span>
            <input className="quiz-admin-input" maxLength={80} value={quiz.title} placeholder="Например: Кто из Акацуки?" onChange={(event) => patch({ title: event.target.value })} />
          </label>
          <div className="quiz-admin-row">
            <label className="quiz-admin-field">
              <span className="quiz-admin-label">Вселенная</span>
              <AdminSelect
                value={quiz.game}
                choices={GAMES.map((one) => ({ value: one.id, label: l(one.label) }))}
                onPick={(id) => {
                  if (quiz.questions.some((one) => one.text) && !confirm('Сменить вселенную? Выбранные персонажи сбросятся.')) return
                  setQuiz({ ...fresh(id), id: quiz.id, title: quiz.title, layout: quiz.layout, status: quiz.status })
                }}
              />
            </label>
            <label className="quiz-admin-field">
              <span className="quiz-admin-label">Формат</span>
              <AdminSelect<QuizLayout>
                value={quiz.layout}
                choices={[
                  { value: 'steps', label: 'По одному вопросу' },
                  { value: 'list', label: 'Все вопросы списком' },
                ]}
                onPick={(layout) => patch({ layout })}
              />
            </label>
            <label className="quiz-admin-field">
              <span className="quiz-admin-label">Статус</span>
              <AdminSelect<Draft['status']>
                value={quiz.status}
                choices={[
                  { value: 'draft', label: 'Черновик' },
                  { value: 'published', label: 'Опубликован' },
                ]}
                onPick={(status) => patch({ status })}
              />
            </label>
          </div>
          <p className="quiz-admin-hint">
            {quiz.layout === 'steps' ? 'Вопросы идут по одному, вернуться к прошлому нельзя.' : 'Все вопросы на одной странице, ответ — по кнопке в конце.'}{' '}
            {quiz.status === 'draft' ? 'Черновик видишь только ты.' : 'Тест виден всем в разделе «Тесты».'}
          </p>
        </div>
      </section>

      {!ready ? (
        <div className="card center muted">Загрузка персонажей…</div>
      ) : (
        quiz.questions.map((question, at) => (
          <div key={at} id={`quiz-q-${at}`} className={`quiz-admin-slot ${badAt === at ? 'is-bad' : ''}`}>
            <QuestionEditor
              game={game}
              byId={byId}
              question={question}
              index={at}
              total={quiz.questions.length}
              onChange={(next) => {
                if (badAt === at) setBadAt(null)
                setQuestion(at, next)
              }}
              onMove={(step) => move(at, step)}
              onDrop={() => patch({ questions: quiz.questions.filter((_, i) => i !== at) })}
            />
          </div>
        ))
      )}

      <div className="quiz-admin-add">
        <span className="quiz-admin-label">Добавить вопрос</span>
        {KINDS.map((one) => (
          <button key={one.kind} type="button" className="ghost" onClick={() => patch({ questions: [...quiz.questions, blank(one.kind)] })}>
            {one.add}
          </button>
        ))}
      </div>

      <div className="quiz-admin-save">
        <span className={`admin-note quiz-admin-note ${note ? 'on' : ''} ${failed ? 'is-error' : 'is-ok'}`} role="status">
          {note}
        </span>
        {quiz.id && quiz.status === 'published' && (
          <Link className="ghost" href={href.test(quiz.game, quiz.id)} target="_blank">
            Открыть
          </Link>
        )}
        {quiz.id && (
          <button type="button" className="ghost is-danger" onClick={() => void drop()}>
            Удалить
          </button>
        )}
        <button type="button" className="primary" disabled={busy} onClick={() => void save()}>
          Сохранить
        </button>
      </div>
    </div>
  )
}

export default function QuizAdmin() {
  const { l } = useI18n()
  const [list, setList] = useState<Saved[] | null>(null)
  const [denied, setDenied] = useState(false)
  const [open, setOpen] = useState<Draft | null>(null)

  const load = useCallback(async () => {
    const { ok, status, data } = await api<{ quizzes?: Saved[] }>('admin/quizzes')
    if (status === 404) return setDenied(true)
    setList(ok ? (data.quizzes ?? []) : [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (denied) return <div className="card center muted">Страница не найдена</div>

  return (
    <div className="admin quiz-admin page-main">
      <AdminNav />
      <header className="admin-bar">
        <div className="admin-bar-main">
          <h1>Тесты</h1>
          <button type="button" className="primary" onClick={() => setOpen(fresh('naruto'))}>
            Новый тест
          </button>
        </div>
      </header>

      <div className="quiz-admin-body">
        <aside className="card quiz-admin-side">
          <header>
            <b>Все тесты</b>
            {!!list?.length && <em>{list.length}</em>}
          </header>
          <ul className="quiz-admin-list">
            {list === null && <li className="muted">Загрузка…</li>}
            {list?.length === 0 && <li className="muted">Тестов пока нет</li>}
            {list?.map((one) => {
              const world = GAMES.find((game) => game.id === one.game)
              return (
                <li key={one.id}>
                  <button type="button" className={open?.id === one.id ? 'on' : ''} onClick={() => setOpen(one)}>
                    <b>{one.title}</b>
                    <small>
                      {world ? l(world.label) : one.game} · {one.questions.length} вопр. · {one.status === 'published' ? 'опубликован' : 'черновик'}
                    </small>
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

        {open ? (
          <Editor
            key={open.id ?? 'new'}
            draft={open}
            onSaved={(saved) => {
              setList((current) => [saved, ...(current ?? []).filter((one) => one.id !== saved.id)])
              setOpen(saved)
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
