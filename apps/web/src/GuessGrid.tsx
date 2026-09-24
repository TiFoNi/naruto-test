import { useRef } from 'react'
import Thumb from './Thumb'
import type { Game } from './games/types'
import { useI18n } from './i18n'
import { DownIcon, UpIcon } from './icons'
import type { Guess } from './useRound'

const sizeClass = (text: string) => (text.length > 44 ? 'size-xs' : text.length > 26 ? 'size-s' : '')

const ROW_STEP = 0.06
const COL_STEP = 0.05
const MAX_ROW_DELAY = 0.5

export default function GuessGrid({ game, guesses }: { game: Game; guesses: Guess[] }) {
  const { t, l, tv, lang, name } = useI18n()
  const legend = game.legend === 'debut' ? (['legend.debutLater', 'legend.debutEarlier'] as const) : (['legend.higher', 'legend.lower'] as const)
  const firstBatch = useRef<number | null>(null)
  if (firstBatch.current === null && guesses.length > 0) firstBatch.current = guesses.length
  const cols = game.columns.length + 1

  if (!guesses.length)
    return (
      <p className="grid-empty">{t('play.emptyGrid')}</p>
    )

  return (
    <div className="grid-scroll">
      <div className="grid" style={{ ['--cols' as string]: cols }}>
        <div className="grid-row header">
          <div>{t(game.unit === 'manga' ? 'play.manga' : game.unit === 'hero' ? 'play.hero' : 'play.character')}</div>
          {game.columns.map((c) => (
            <div key={c.key}>{l(c.title)}</div>
          ))}
        </div>
        {guesses.map(({ entity: g, judgement, pending }, row) => (
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
              return (
                <div
                  key={col.key}
                  title={text}
                  className={`cell ${kind} ${sizeClass(text)}`}
                  style={{ animationDelay: `${(row < (firstBatch.current ?? 0) ? Math.min(row * ROW_STEP, MAX_ROW_DELAY) : 0) + i * COL_STEP}s` }}
                >
                  {verdict?.arrow && (
                    <b className="cell-arrow" aria-label={t(verdict.arrow === 'up' ? legend[0] : legend[1])}>
                      {verdict.arrow === 'up' ? <UpIcon /> : <DownIcon />}
                    </b>
                  )}
                  {icons.length ? (
                    <div className="icons">
                      {icons.map((icon) => (
                        <i key={icon.label} title={icon.label} style={{ background: icon.color }} className={icon.dark ? 'dark' : ''}>
                          {icon.symbol}
                        </i>
                      ))}
                      {icons.length === 1 && <span className="icon-label">{icons[0].label}</span>}
                    </div>
                  ) : (
                    <span>{text}</span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
