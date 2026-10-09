import { useEffect, useRef, useState } from 'react'
import { useBeforePaint } from './paint'
import { GAME_SPECS } from '@nanda/game'
import Thumb from './Thumb'
import { EMPTY, type Column, type Entity, type Game, type RenderContext } from './games/types'
import { useI18n } from './i18n'
import { DownIcon, UpIcon } from './icons'
import type { Guess } from './useRound'

const sizeClass = (text: string) => (text.length > 44 ? 'size-xs' : text.length > 26 ? 'size-s' : '')

const CELL_WIDTH = 96
const CELL_HEIGHT = 96
const CHAR_WIDTH = 5.6
const LINE_HEIGHT = 12.2
const CELL_GAP = 6
const MIN_CELL = 74
const CARD_PADDING = 10
const ICON_SIZE = 22
const ICON_GAP = 3
const CELL_PADDING = 7
const TIP_WIDTH = 240
const TIP_SPACE = 140
const FACET_WIDTH = 272
const FACET_MIN = 180
const FACET_MAX = 330
const ORDERED = ['order', 'optionalOrder']

function facetValues(game: Game, col: Column<Entity>, ctx: RenderContext) {
  const kind = GAME_SPECS[game.id].columns.find((spec) => spec.key === col.key)?.kind
  const ordered = ORDERED.includes(kind ?? '')
  const found = new Map<string, { count: number; order: number }>()

  for (const entity of game.entities) {
    const raw = (entity as unknown as Record<string, unknown>)[col.key]
    const plain = Array.isArray(raw) ? raw.map(String) : raw ? [String(raw)] : []
    const labels = ordered || typeof raw === 'number' ? [col.text(entity, ctx)] : plain.map(ctx.tv)
    const order = typeof raw === 'number' ? raw : Number.POSITIVE_INFINITY
    for (const label of labels.length ? labels : [ctx.tv(EMPTY)]) {
      const seen = found.get(label)
      if (seen) seen.count += 1
      else found.set(label, { count: 1, order })
    }
  }

  const rows = [...found]
  rows.sort(([oneLabel, one], [twoLabel, two]) =>
    ordered ? one.order - two.order : two.count - one.count || oneLabel.localeCompare(twoLabel, ctx.lang),
  )
  return { ordered, values: rows.map(([label]) => label) }
}


const ROW_STEP = 0.06
const COL_STEP = 0.05
const MAX_ROW_DELAY = 0.5

export default function GuessGrid({ game, guesses, answerId, loading }: { game: Game; guesses: Guess[]; answerId?: number; loading?: boolean }) {
  const { t, l, tv, lang, name } = useI18n()
  const legend = game.legend === 'debut' ? (['legend.debutLater', 'legend.debutEarlier'] as const) : (['legend.higher', 'legend.lower'] as const)
  const firstBatch = useRef<number | null>(null)
  if (firstBatch.current === null && guesses.length > 0) firstBatch.current = guesses.length
  const cols = game.columns.length + 1
  const box = useRef<HTMLDivElement>(null)
  const [wrapped, setWrapped] = useState(false)
  const [perRow, setPerRow] = useState(cols - 1)
  const [iconLimit, setIconLimit] = useState(9)
  const [textRoom, setTextRoom] = useState(0)
  const [tip, setTip] = useState<{ key: string; text: string } | null>(null)
  const [facet, setFacet] = useState<{ key: string; title: string; note: string; values: string[] } | null>(null)
  const tipBox = useRef<HTMLSpanElement>(null)
  const facetBox = useRef<HTMLDivElement>(null)
  const tipAt = useRef<HTMLElement | null>(null)
  const facetAt = useRef<HTMLElement | null>(null)

  const middle = (rect: DOMRect, width: number) => Math.min(Math.max(rect.left + rect.width / 2, width / 2 + 8), window.innerWidth - width / 2 - 8)

  const place = () => {
    const hint = tipBox.current
    const hintAt = tipAt.current
    if (hint && hintAt) {
      if (!hintAt.isConnected) setTip(null)
      else {
        const rect = hintAt.getBoundingClientRect()
        const below = rect.top < TIP_SPACE
        hint.style.left = `${middle(rect, TIP_WIDTH)}px`
        hint.style.top = `${below ? rect.bottom + 8 : rect.top - 8}px`
        hint.style.transform = below ? 'translate(-50%, 0)' : 'translate(-50%, -100%)'
      }
    }
    const pop = facetBox.current
    const popAt = facetAt.current
    if (pop && popAt) {
      if (!popAt.isConnected) setFacet(null)
      else {
        const rect = popAt.getBoundingClientRect()
        pop.style.left = `${middle(rect, FACET_WIDTH)}px`
        pop.style.top = `${rect.bottom + 10}px`
        pop.style.maxHeight = `${Math.max(FACET_MIN, Math.min(FACET_MAX, window.innerHeight - rect.bottom - 26))}px`
      }
    }
  }

  useBeforePaint(place)

  useEffect(() => {
    if (!tip && !facet) return
    const follow = () => place()
    const away = () => {
      setTip(null)
      setFacet(null)
    }
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && away()
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', escape)
    window.addEventListener('scroll', follow, true)
    window.addEventListener('resize', follow)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', escape)
      window.removeEventListener('scroll', follow, true)
      window.removeEventListener('resize', follow)
    }
  })

  const showTip = (key: string, text: string, target: HTMLElement) => {
    setFacet(null)
    facetAt.current = null
    if (tip?.key === key) return setTip(null)
    tipAt.current = target
    setTip({ key, text })
  }

  const showFacet = (col: Column<Entity>, target: HTMLElement) => {
    setTip(null)
    tipAt.current = null
    if (facet?.key === col.key) return setFacet(null)
    const { ordered, values } = facetValues(game, col, { tv, lang })
    if (!values.length) return
    const hint = ordered ? ` · ${t(game.legend === 'debut' ? 'facet.debut' : 'facet.order')}` : ''
    facetAt.current = target
    setFacet({ key: col.key, title: l(col.title), note: `${t('facet.count', { count: values.length })}${hint}` , values })
  }

  useEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const need = cols * CELL_WIDTH + (cols - 1) * CELL_GAP

    const check = () => {
      const width = el.clientWidth
      setWrapped(width < need)
      const room = width - CARD_PADDING * 2 + CELL_GAP
      const items = cols - 1
      const fit = Math.max(3, Math.min(items, Math.floor(room / (MIN_CELL + CELL_GAP))))
      const lines = Math.ceil(items / fit)
      const inRow = Math.ceil(items / lines)
      setPerRow(inRow)

      const cards = width < need
      const side = cards ? Math.floor((room - inRow * CELL_GAP) / inRow) : CELL_WIDTH
      const icon = el.querySelector<HTMLElement>('.icons i')?.offsetWidth || ICON_SIZE
      const label = cards ? (el.querySelector<HTMLElement>('.cell-label')?.offsetHeight ?? 0) + CELL_GAP : 0
      const step = icon + ICON_GAP
      const wide = Math.max(0, side - CELL_PADDING * 2)
      const tall = Math.max(0, (cards ? side : CELL_HEIGHT) - label - CELL_PADDING * 2)
      const across = Math.max(1, Math.floor((wide + ICON_GAP) / step))
      const down = Math.max(1, Math.floor((tall + ICON_GAP) / step))
      setIconLimit(Math.max(2, across * down))
      setTextRoom(Math.floor((wide / CHAR_WIDTH) * Math.max(1, Math.floor(tall / LINE_HEIGHT)) * 0.86))
    }

    check()
    const watcher = new ResizeObserver(check)
    watcher.observe(el)
    return () => watcher.disconnect()
  }, [cols])

  const style = { ['--cols' as string]: cols, ['--wrap-cols' as string]: perRow }

  const tips = (
    <>
      {tip && (
        <span ref={tipBox} className="cell-tip" style={{ width: TIP_WIDTH }} onMouseDown={(event) => event.stopPropagation()}>
          {tip.text}
        </span>
      )}
      {facet && (
        <div ref={facetBox} className="facet-tip" style={{ width: FACET_WIDTH }} onMouseDown={(event) => event.stopPropagation()}>
          <b>{facet.title}</b>
          <small>{facet.note}</small>
          <div className="facet-values">
            {facet.values.map((value) => (
              <span key={value}>{value}</span>
            ))}
          </div>
        </div>
      )}
    </>
  )

  const header = (
    <div className="grid-row header">
      <div>{t(game.unit === 'manga' ? 'play.manga' : game.unit === 'hero' ? 'play.hero' : game.unit === 'player' ? 'play.player' : 'play.character')}</div>
      {game.columns.map((col) => (
        <div key={col.key}>
          <button
            type="button"
            className={`head-pick ${facet?.key === col.key ? 'on' : ''}`}
            title={t('facet.what')}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => showFacet(col, event.currentTarget)}
          >
            {l(col.title)}
          </button>
        </div>
      ))}
    </div>
  )

  if (!guesses.length)
    return (
      <div className={`grid-scroll ${wrapped ? 'is-wrapped' : ''}`} ref={box}>
        {tips}
        {game.columns.length > 0 && (
          <div className="grid" style={style}>
            {header}
          </div>
        )}
        <p className="grid-empty">{t(loading ? 'loading' : 'play.emptyGrid')}</p>
      </div>
    )

  return (
    <div className={`grid-scroll ${wrapped ? 'is-wrapped' : ''}`} ref={box}>
      {tips}
      <div className="grid" style={style}>
        {header}
        {guesses.map(({ entity: g, judgement, pending }, row) => {
          const twin =
            !pending && game.columns.length > 0 && g.id !== answerId && game.columns.every((c) => judgement?.[c.key]?.verdict === 'correct')
          const body = (
            <div className={`grid-row ${pending ? 'pending' : ''}`} key={g.id}>
            <div
              className="cell portrait"
              title={name(g)}
              style={{ animationDelay: `${row < (firstBatch.current ?? 0) ? Math.min(row * ROW_STEP, MAX_ROW_DELAY) : 0}s` }}
            >
              <Thumb game={game} entity={g} className="portrait-thumb" />
              <span className="portrait-name">{name(g)}</span>
            </div>
            {game.columns.map((col, i) => {
              if (pending) return <div key={col.key} className="cell pending" />
              const ctx = { tv, lang }
              const text = col.text(g, ctx)
              const icons = col.icons?.(g, ctx) ?? []
              const verdict = judgement?.[col.key]
              const kind = verdict?.verdict ?? 'wrong'
              const key = `${g.id}:${col.key}`
              const parts = text.split(', ')
              let shown = text
              if (wrapped && parts.length > 1 && text.length > textRoom) {
                let take = parts.length - 1
                while (take > 1 && parts.slice(0, take).join(', ').length + 4 > textRoom) take -= 1
                shown = `${parts.slice(0, take).join(', ')} +${parts.length - take}`
              }
              const full = `${l(col.title)}: ${icons.length ? icons.map((icon) => icon.label).join(', ') : text}`
              const iconsShown = icons.length > iconLimit ? iconLimit - 1 : icons.length
              return (
                <div
                  key={col.key}
                  className={`cell ${kind} ${sizeClass(text)} ${tip?.key === key ? 'has-tip' : ''}`}
                  style={{ animationDelay: `${(row < (firstBatch.current ?? 0) ? Math.min(row * ROW_STEP, MAX_ROW_DELAY) : 0) + i * COL_STEP}s` }}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => showTip(key, full, event.currentTarget)}
                >
                  <span
                    className={`cell-label ${facet?.key === col.key ? 'on' : ''}`}
                    aria-hidden={!wrapped}
                    title={wrapped ? t('facet.what') : undefined}
                    onClick={
                      wrapped
                        ? (event) => {
                            event.stopPropagation()
                            showFacet(col, event.currentTarget)
                          }
                        : undefined
                    }
                  >
                    {l(col.title)}
                  </span>
                  {verdict?.arrow && (
                    <b className="cell-arrow" aria-label={t(verdict.arrow === 'up' ? legend[0] : legend[1])}>
                      {verdict.arrow === 'up' ? <UpIcon /> : <DownIcon />}
                    </b>
                  )}
                  {icons.length ? (
                    <div className="icons">
                      {icons.slice(0, iconsShown).map((icon) => (
                        <i key={icon.label} style={{ background: icon.color }} className={icon.dark ? 'dark' : ''}>
                          {icon.symbol}
                        </i>
                      ))}
                      {icons.length > iconsShown && <i className="icons-more">+{icons.length - iconsShown}</i>}
                      {icons.length === 1 && <span className="icon-label">{icons[0].label}</span>}
                    </div>
                  ) : (
                    <span className="cell-text">{shown}</span>
                  )}
                </div>
              )
              })}
            </div>
          )
          if (!twin) return body
          return (
            <div className="twin" key={g.id}>
              {body}
              <p className="twin-note">
                <b>{t('twin.badge')}</b>
                <span>{t('twin.text', { name: name(g) })}</span>
                <i>{t('twin.hint')}</i>
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
