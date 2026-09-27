'use client'

import type { Game } from './games/types'
import { useI18n } from './i18n'

type Row = Record<string, string>

export default function RivalBoard({ game, rows, total }: { game: Game; rows: Row[]; total: number }) {
  const { t } = useI18n()
  const first = total - rows.length + 1

  return (
    <section className="play-card rival-board">
      <header className="rival-board-head">
        <span className="play-card-title">{t('duel.rivalBoard')}</span>
        <em className="rival-live">{t('duel.live')}</em>
      </header>
      <p className="muted">{t('duel.rivalBoardHint')}</p>
      {rows.length ? (
        <ol className="rival-rows" style={{ '--rival-cols': game.columns.length + 1 } as React.CSSProperties}>
          {rows
            .map((row, index) => ({ row, number: first + index }))
            .reverse()
            .map(({ row, number }) => (
              <li key={number}>
                <i>{number}</i>
                <span className="rival-cell mystery" aria-hidden>
                  ?
                </span>
                {game.columns.map((column) => (
                  <span key={column.key} className={`rival-cell ${row[column.key] ?? 'wrong'}`} />
                ))}
              </li>
            ))}
        </ol>
      ) : (
        <p className="rival-empty muted">{t('duel.rivalBoardEmpty')}</p>
      )}
    </section>
  )
}
