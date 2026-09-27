import { useEffect, useRef, useState } from 'react'
import Thumb from './Thumb'
import type { Game } from './games/types'
import { useI18n } from './i18n'
import { DownIcon, UpIcon } from './icons'
import type { Guess } from './useRound'

const sizeClass = (text: string) => (text.length > 44 ? 'size-xs' : text.length > 26 ? 'size-s' : '')

const CELL_WIDTH = 96
const CELL_GAP = 6
const MIN_CELL = 74
const CARD_PADDING = 10
const ICON_SIZE = 22
const ICON_GAP = 3
const CELL_PADDING = 7
const TIP_WIDTH = 240
const TIP_SPACE = 140


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
  const [tip, setTip] = useState<{ key: string; text: string; x: number; y: number; below: boolean } | null>(null)

  useEffect(() => {
    if (!tip) return
    const away = () => setTip(null)
    document.addEventListener('mousedown', away)
    window.addEventListener('scroll', away, true)
    window.addEventListener('resize', away)
    return () => {
      document.removeEventListener('mousedown', away)
      window.removeEventListener('scroll', away, true)
      window.removeEventListener('resize', away)
    }
  }, [tip])

  const showTip = (key: string, text: string, target: HTMLElement) => {
    if (tip?.key === key) return setTip(null)
    const rect = target.getBoundingClientRect()
    const half = TIP_WIDTH / 2
    const x = Math.min(Math.max(rect.left + rect.width / 2, half + 8), window.innerWidth - half - 8)
    const below = rect.top < TIP_SPACE
    setTip({ key, text, x, y: below ? rect.bottom + 8 : rect.top - 8, below })
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

      const side = width < need ? Math.floor((room - inRow * CELL_GAP) / inRow) : CELL_WIDTH
      const inner = Math.max(0, side - CELL_PADDING * 2) + ICON_GAP
      const step = ICON_SIZE + ICON_GAP
      setIconLimit(Math.max(2, Math.floor(inner / step) * Math.floor(inner / step)))
    }

    check()
    const watcher = new ResizeObserver(check)
    watcher.observe(el)
    return () => watcher.disconnect()
  }, [cols])

  if (!guesses.length)
    return (
      <div className="grid-scroll" ref={box}>
        <p className="grid-empty">{t(loading ? 'loading' : 'play.emptyGrid')}</p>
      </div>
    )

  return (
    <div className={`grid-scroll ${wrapped ? 'is-wrapped' : ''}`} ref={box}>
      {tip && (
        <span
          className={`cell-tip ${tip.below ? 'below' : ''}`}
          style={{ left: tip.x, top: tip.y, width: TIP_WIDTH }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {tip.text}
        </span>
      )}
      <div className="grid" style={{ ['--cols' as string]: cols, ['--wrap-cols' as string]: perRow }}>
        <div className="grid-row header">
          <div>{t(game.unit === 'manga' ? 'play.manga' : game.unit === 'hero' ? 'play.hero' : game.unit === 'player' ? 'play.player' : 'play.character')}</div>
          {game.columns.map((c) => (
            <div key={c.key}>{l(c.title)}</div>
          ))}
        </div>
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
              const full = icons.length ? icons.map((icon) => icon.label).join(', ') : text
              const shown = icons.length > iconLimit ? iconLimit - 1 : icons.length
              return (
                <div
                  key={col.key}
                  className={`cell ${kind} ${sizeClass(text)} ${tip?.key === key ? 'has-tip' : ''}`}
                  style={{ animationDelay: `${(row < (firstBatch.current ?? 0) ? Math.min(row * ROW_STEP, MAX_ROW_DELAY) : 0) + i * COL_STEP}s` }}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => showTip(key, full, event.currentTarget)}
                >
                  {verdict?.arrow && (
                    <b className="cell-arrow" aria-label={t(verdict.arrow === 'up' ? legend[0] : legend[1])}>
                      {verdict.arrow === 'up' ? <UpIcon /> : <DownIcon />}
                    </b>
                  )}
                  {icons.length ? (
                    <div className="icons">
                      {icons.slice(0, shown).map((icon) => (
                        <i key={icon.label} style={{ background: icon.color }} className={icon.dark ? 'dark' : ''}>
                          {icon.symbol}
                        </i>
                      ))}
                      {icons.length > shown && <i className="icons-more">+{icons.length - shown}</i>}
                      {icons.length === 1 && <span className="icon-label">{icons[0].label}</span>}
                    </div>
                  ) : (
                    <span className="cell-text">{text}</span>
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
