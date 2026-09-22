import Thumb from './Thumb'
import type { Game } from './games/types'
import { useI18n } from './i18n'
import type { Guess } from './useRound'

const sizeClass = (text: string) => (text.length > 44 ? 'size-xs' : text.length > 26 ? 'size-s' : '')

export default function GuessGrid({ game, guesses }: { game: Game; guesses: Guess[] }) {
  const { t, l, tv, lang, name } = useI18n()
  const legend = game.legend === 'debut' ? (['legend.debutLater', 'legend.debutEarlier'] as const) : (['legend.higher', 'legend.lower'] as const)

  if (!guesses.length) return null

  return (
    <div className="grid-scroll">
      <div className="grid" style={{ ['--cols' as string]: game.columns.length + 1 }}>
        <div className="grid-row header">
          <div>{t(game.unit === 'hero' ? 'play.hero' : 'play.character')}</div>
          {game.columns.map((c) => (
            <div key={c.key}>{l(c.title)}</div>
          ))}
        </div>
        {guesses.map(({ entity: g, judgement, pending }) => (
          <div className={`grid-row ${pending ? 'pending' : ''}`} key={g.id}>
            <div className="cell portrait" title={name(g)}>
              <Thumb game={game} entity={g} className="portrait-thumb" />
              <span className="portrait-name">{name(g)}</span>
            </div>
            {game.columns.map((col, i) => {
              if (pending) return <div key={col.key} className="cell pending" />
              const ctx = { tv, lang }
              const text = col.text(g, ctx)
              const icons = col.icons?.(g, ctx) ?? []
              const verdict = judgement?.[col.key]
              return (
                <div
                  key={col.key}
                  title={text}
                  className={`cell ${verdict?.verdict ?? 'wrong'} ${sizeClass(text)}`}
                  style={{ animationDelay: `${i * 0.07}s` }}
                >
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
                  {verdict?.arrow && (
                    <b className="arrow" aria-label={t(verdict.arrow === 'up' ? legend[0] : legend[1])}>
                      {verdict.arrow === 'up' ? '↑' : '↓'}
                    </b>
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

export function Legend({ game }: { game: Game }) {
  const { t } = useI18n()
  const legend = game.legend === 'debut' ? (['legend.debutLater', 'legend.debutEarlier'] as const) : (['legend.higher', 'legend.lower'] as const)
  return (
    <ul className="legend">
      <li><span className="swatch correct" />{t('legend.correct')}</li>
      <li><span className="swatch partial" />{t('legend.partial')}</li>
      <li><span className="swatch wrong" />{t('legend.wrong')}</li>
      <li><b className="arrow">↑</b>{t(legend[0])}</li>
      <li><b className="arrow">↓</b>{t(legend[1])}</li>
    </ul>
  )
}
