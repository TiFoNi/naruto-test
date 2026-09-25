import Link from 'next/link'
import ChallengeMaker from './ChallengeMaker'
import { useAuth } from './auth'
import type { Game } from './games/types'
import { useI18n } from './i18n'
import { CheckIcon, CloseIcon, DownIcon, MinusIcon, TrophyIcon, UpIcon } from './icons'
import type { ModeId } from './modes'
import { useHref } from './router'
import { average, type Stats } from './stats'

type Props = {
  game: Game
  mode: ModeId
  daily: boolean
  stats: Stats
  playing: boolean
  busy?: boolean
  legend?: boolean
  howto?: 'image' | 'page' | 'ability'
  onGiveUp: () => void
}

const STEPS = {
  image: ['howto.step1', 'howto.step2', 'howto.step3'],
  page: ['howtoPage.step1', 'howtoPage.step2', 'howtoPage.step3'],
  ability: ['howtoAbility.step1', 'howtoAbility.step2', 'howtoAbility.step3'],
} as const

function HowTo({ kind }: { kind: 'image' | 'page' | 'ability' }) {
  const { t } = useI18n()
  return (
    <div className="play-card play-howto">
      <span className="play-card-title">{t('howto.title')}</span>
      {STEPS[kind].map((key, i) => (
        <span key={key}>
          <i>{i + 1}</i>
          {t(key)}
        </span>
      ))}
    </div>
  )
}

export function Legend({ game }: { game: Game }) {
  const { t } = useI18n()
  const arrows = game.legend === 'debut' ? (['legend.debutLater', 'legend.debutEarlier'] as const) : (['legend.higher', 'legend.lower'] as const)

  return (
    <div className="play-card play-legend">
      <span className="play-card-title">{t('legend.title')}</span>
      <span>
        <i className="legend-badge correct">
          <CheckIcon />
        </i>
        {t('legend.correct')}
      </span>
      <span>
        <i className="legend-badge partial">
          <MinusIcon />
        </i>
        {t('legend.partial')}
      </span>
      <span>
        <i className="legend-badge wrong">
          <CloseIcon />
        </i>
        {t('legend.wrong')}
      </span>
      <span>
        <i className="legend-badge arrow">
          <UpIcon />
        </i>
        {t(arrows[0])}
      </span>
      <span>
        <i className="legend-badge arrow">
          <DownIcon />
        </i>
        {t(arrows[1])}
      </span>
    </div>
  )
}

export default function PlaySide({ game, mode, daily, stats, playing, busy, legend, howto, onGiveUp }: Props) {
  const { t } = useI18n()
  const href = useHref()
  const { user } = useAuth()
  const cells = daily
    ? [
        { key: 'streak', label: t('daily.streak'), value: user?.streak ?? 0, hot: true },
        { key: 'best', label: t('daily.best'), value: user?.bestStreak ?? 0 },
      ]
    : [
        { key: 'solved', label: t('stats.solved'), value: stats.solved },
        { key: 'streak', label: t('stats.streak'), value: stats.streak, hot: true },
        { key: 'best', label: t('stats.best'), value: stats.best },
        { key: 'avg', label: t('stats.avg'), value: average(stats) },
      ]

  return (
    <aside className="play-side">
      <div className="play-card play-stats">
        {cells.map((cell) => (
          <div key={cell.key} className={cell.hot ? 'hot' : ''}>
            <span>{cell.label}</span>
            <b>{cell.value}</b>
          </div>
        ))}
      </div>

      {legend && <Legend game={game} />}
      {howto && <HowTo kind={howto} />}

      <div className="play-actions">
        {!daily && user && <ChallengeMaker game={game} mode={mode} />}
        {user && (
          <Link className="lb-link" href={href.leaderboard(game.id, mode)}>
            <TrophyIcon /> {t('nav.leaderboard')}
          </Link>
        )}
        {playing && (
          <button type="button" className="give-up" onClick={onGiveUp} disabled={busy}>
            {t('play.giveUp')}
          </button>
        )}
      </div>
    </aside>
  )
}
