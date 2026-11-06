'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import { useAuth } from './auth'
import Avatar from './Avatar'
import { toneOf } from './Chat'
import { useI18n, type UiKey } from './i18n'
import { CloseIcon, EyeOffIcon, ReplyIcon, TrashIcon } from './icons'
import { useHref } from './router'

const MAX = 600
const ARM_MS = 3000

type Comment = {
  id: string
  userId: string
  nickname: string
  tag?: string
  avatar: string | null
  frame: string | null
  title: string | null
  nickTone: string | null
  text: string
  spoiler: boolean
  at: number
  author: boolean
  mine: boolean
  reply?: { id: string; userId: string; nickname: string; text: string; spoiler: boolean; gone?: boolean }
}

type Page = { comments?: Comment[]; more?: boolean; total?: number; moderator?: boolean }

const errorOf = (status: number): UiKey => (status === 429 ? 'err.too_fast' : status === 403 ? 'chat.muted' : status === 401 ? 'comments.login' : 'quiz.failed')

export default function QuizComments({ quizId, finished }: { quizId: string; finished: boolean }) {
  const { t, lang } = useI18n()
  const href = useHref()
  const { user } = useAuth()
  const [list, setList] = useState<Comment[]>([])
  const [ready, setReady] = useState(false)
  const [more, setMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [moderator, setModerator] = useState(false)
  const [text, setText] = useState('')
  const [spoiler, setSpoiler] = useState(false)
  const [replying, setReplying] = useState<Comment | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [shown, setShown] = useState<Set<string>>(() => new Set())
  const boxed = useRef(new Map<string, boolean>())
  const [armed, setArmed] = useState<string | null>(null)
  const box = useRef<HTMLTextAreaElement>(null)

  const load = useCallback(
    async (before?: string) => {
      const { ok, data } = await api<Page>(`quiz/comments?id=${quizId}${before ? `&before=${before}` : ''}`)
      if (!ok) return setReady(true)
      setList((was) => (before ? [...was, ...(data.comments ?? [])] : (data.comments ?? [])))
      setMore(!!data.more)
      setTotal(data.total ?? 0)
      setModerator(!!data.moderator)
      setReady(true)
    },
    [quizId],
  )

  const [demo, setDemo] = useState(false)
  useEffect(() => {
    if (window.location.search.includes('demo-comments')) {
      const now = Date.now()
      setDemo(true)
      setList([
        { id: 'd1', userId: '0000000000000000000000a1', nickname: 'Injani', avatar: null, frame: 'cosmos', title: 'admin', nickTone: null, text: 'Отличный тест! Вопрос про то, кто убил Меруэма, вообще огонь — я был уверен, что Нетеро, а это яд Розы.', spoiler: true, at: now - 50 * 60_000, author: false, mine: false },
        { id: 'd2', userId: '0000000000000000000000a2', nickname: 'Автор', avatar: null, frame: 'kny', title: 'patron', nickTone: 'hxh', text: 'Спасибо! Старался сделать вопросы с подвохом 🙂', spoiler: false, at: now - 40 * 60_000, author: true, mine: false, reply: { id: 'd1', userId: '0000000000000000000000a1', nickname: 'Injani', spoiler: true, text: 'Отличный тест! Вопрос про то, кто убил Меруэма, вообще огонь — я был уверен, что Нетеро, а это яд Розы.' } },
        { id: 'd3', userId: '0000000000000000000000a3', nickname: 'Arthas', avatar: null, frame: 'blossom', title: null, nickTone: null, text: '9 из 12, на этажах Небесной арены завалился. Пройду ещё раз.', spoiler: false, at: now - 2 * 86400_000, author: false, mine: false },
      ].reverse().reverse())
      setTotal(3)
      setModerator(true)
      setReady(true)
      return
    }
    void load()
  }, [load, user?.id])

  useEffect(() => {
    if (!armed) return
    const timer = window.setTimeout(() => setArmed(null), ARM_MS)
    return () => window.clearTimeout(timer)
  }, [armed])

  useEffect(() => {
    if (!ready || window.location.hash !== '#comments') return
    document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [ready])

  const send = async () => {
    const body = text.trim()
    if (!body || busy) return
    if (demo) {
      const made: Comment = { id: `m${Date.now()}`, userId: 'me', nickname: user?.nickname ?? 'Ты', avatar: user?.avatar ?? null, frame: user?.frame ?? null, title: null, nickTone: null, text: body, spoiler, at: Date.now(), author: false, mine: true, ...(replying ? { reply: { id: replying.id, userId: replying.userId, nickname: replying.nickname, text: replying.text.slice(0, 120), spoiler: replying.spoiler } } : {}) }
      setList((was) => [made, ...was])
      setTotal((was) => was + 1)
      setText('')
      setSpoiler(false)
      setReplying(null)
      return
    }
    setBusy(true)
    setError('')
    const { ok, status, data } = await api<{ comment?: Comment }>('quiz/comments', { id: quizId, text: body, spoiler, reply: replying?.id })
    setBusy(false)
    if (!ok || !data.comment) return setError(t(errorOf(status)))
    setList((was) => [data.comment!, ...was])
    setTotal((was) => was + 1)
    setText('')
    setSpoiler(false)
    setReplying(null)
  }

  const edit = async (comment: Comment, change: { drop?: true; spoiler?: boolean }) => {
    if (!demo) {
      const { ok, status } = await api('quiz/comments/edit', { id: quizId, comment: comment.id, ...change })
      if (!ok) return setError(t(errorOf(status)))
    }
    if (change.spoiler) setShown((was) => new Set(was).add(comment.id))
    if (change.drop) {
      setList((was) =>
        was
          .filter((one) => one.id !== comment.id)
          .map((one) => (one.reply?.id === comment.id ? { ...one, reply: { ...one.reply, text: '', gone: true } } : one)),
      )
      setTotal((was) => Math.max(0, was - 1))
    } else
      setList((was) =>
        was.map((one) =>
          one.id === comment.id
            ? { ...one, spoiler: !!change.spoiler }
            : one.reply?.id === comment.id
              ? { ...one, reply: { ...one.reply, spoiler: !!change.spoiler } }
              : one,
        ),
      )
  }

  const answer = (comment: Comment) => {
    setReplying(comment)
    box.current?.focus()
  }

  const when = (at: number) => {
    const date = new Date(at)
    const today = new Date().toDateString() === date.toDateString()
    return today
      ? date.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString(lang, { day: 'numeric', month: 'short', ...(date.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }) })
  }

  return (
    <section id="comments" className="qc">
      <h2 className="qc-head">
        {t('comments.title')}
        {total > 0 && <span>{total}</span>}
      </h2>

      {user || demo ? (
        <div className="qc-form">
          {replying && (
            <div className="qc-replying">
              <ReplyIcon />
              <span>
                <b>{t('comments.replyTo', { name: replying.nickname })}</b>
                <em>{replying.spoiler && !finished ? t('comments.spoilerHidden') : replying.text}</em>
              </span>
              <button type="button" aria-label={t('profile.cancel')} title={t('profile.cancel')} onClick={() => setReplying(null)}>
                <CloseIcon />
              </button>
            </div>
          )}
          <textarea
            ref={box}
            value={text}
            maxLength={MAX}
            rows={3}
            placeholder={t('comments.placeholder')}
            onChange={(event) => {
              setText(event.target.value)
              setError('')
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void send()
            }}
          />
          <div className="qc-bar">
            <label className={`qc-spoiler ${spoiler ? 'is-on' : ''}`} title={t('comments.spoilerHint')}>
              <input type="checkbox" checked={spoiler} onChange={(event) => setSpoiler(event.target.checked)} />
              <i aria-hidden />
              {t('comments.spoiler')}
            </label>
            <small className={text.length > MAX - 60 ? 'is-near' : ''}>
              {text.length}/{MAX}
            </small>
            <button type="button" className="quiz-btn" disabled={busy || !text.trim()} onClick={() => void send()}>
              {t('comments.send')}
            </button>
          </div>
          {error && <p className="qc-error">{error}</p>}
        </div>
      ) : (
        <p className="qc-guest">
          {t('comments.login')}
          <Link href={href.login} prefetch={false}>
            {t('poll.login')}
          </Link>
        </p>
      )}

      {ready && !list.length && <p className="qc-empty">{t('comments.empty')}</p>}

      <ol className="qc-list">
        {list.map((comment) => {
          const veiled = comment.spoiler && !finished && !shown.has(comment.id) && !comment.mine
          if (!boxed.current.has(comment.id)) boxed.current.set(comment.id, veiled)
          return (
            <li key={comment.id} className="qc-item">
              <Link href={comment.mine ? href.profile : href.player(comment.userId)} prefetch={false} className="qc-av" aria-label={comment.nickname}>
                <Avatar id={comment.userId} name={comment.nickname} avatar={comment.avatar} frame={comment.frame} small />
              </Link>
              <div className="qc-body">
                <header>
                  <Link className="qc-nick" href={comment.mine ? href.profile : href.player(comment.userId)} style={toneOf(comment.nickTone)} prefetch={false}>
                    {comment.nickname}
                  </Link>
                  {comment.title && <i className={`player-title is-slim is-${comment.title}`}>{t(`title.${comment.title}` as UiKey)}</i>}
                  {comment.author && <i className="qc-badge">{t('comments.author')}</i>}
                  <time dateTime={new Date(comment.at).toISOString()}>{when(comment.at)}</time>
                </header>
                {comment.reply && (
                  <p className="qc-quote">
                    <b>{comment.reply.nickname}</b>
                    {comment.reply.gone
                      ? t('comments.gone')
                      : comment.reply.spoiler && !finished && !shown.has(comment.reply.id)
                        ? t('comments.spoilerHidden')
                        : comment.reply.text}
                  </p>
                )}
                <div className={`qc-say ${veiled ? 'is-veiled' : boxed.current.get(comment.id) ? 'is-opened' : ''}`}>
                  <p className="qc-text" aria-hidden={veiled}>
                    {comment.text}
                  </p>
                  {veiled && (
                    <button type="button" className="qc-veil" onClick={() => setShown((was) => new Set(was).add(comment.id))}>
                      <EyeOffIcon />
                      {t('comments.reveal')}
                    </button>
                  )}
                </div>
                {(user || demo) && (
                  <div className="qc-acts">
                    <button type="button" onClick={() => answer(comment)}>
                      <ReplyIcon />
                      {t('comments.reply')}
                    </button>
                    {(comment.mine || moderator) && (
                      <button type="button" onClick={() => void edit(comment, { spoiler: !comment.spoiler })}>
                        <EyeOffIcon />
                        {t(comment.spoiler ? 'comments.unmark' : 'comments.mark')}
                      </button>
                    )}
                    {(comment.mine || moderator) && (
                      <button
                        type="button"
                        className={armed === comment.id ? 'is-armed' : ''}
                        onClick={() => (armed === comment.id ? void edit(comment, { drop: true }) : setArmed(comment.id))}
                      >
                        <TrashIcon />
                        {t(armed === comment.id ? 'comments.dropSure' : 'comments.drop')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {more && (
        <button type="button" className="quiz-btn is-ghost qc-more" onClick={() => void load(list[list.length - 1]?.id)}>
          {t('comments.more')}
        </button>
      )}
    </section>
  )
}
