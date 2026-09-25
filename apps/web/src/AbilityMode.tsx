import AbilityIcon from './AbilityIcon'
import CharacterSearch from './CharacterSearch'
import PlaySide from './PlaySide'
import RoundResult from './RoundResult'
import RoundStatus from './RoundStatus'
import Thumb from './Thumb'
import Yesterday from './Yesterday'
import { useAuth } from './auth'
import type { Game } from './games/types'
import { useI18n, type UiKey } from './i18n'
import { LockIcon, SparkIcon } from './icons'
import type { Stats } from './stats'
import { useRound } from './useRound'
import { apiSrc } from './api'
import { ABILITY_STAGES } from '@nanda/game'
import { useEffect, useRef, useState } from 'react'

type Props = { game: Game; active: boolean; stats: Stats; daily?: boolean; challenge?: string }

const clarityAt = (step: number) => Math.round((step / ABILITY_STAGES) * 100)

export default function AbilityMode({ game, active, stats, daily = false, challenge }: Props) {
  const { t, name, lang } = useI18n()
  const { user } = useAuth()
  const { round, guesses, exclude, over, won, skipped, answer, yesterday, busy, error, guess, giveUp, next, retry } = useRound(
    game,
    'ability',
    active,
    daily,
    challenge,
  )

  const wrong = guesses.filter((g) => !g.pending).length - (won ? 1 : 0)
  const src = round?.image ? `${apiSrc(round.image)}&v=${over ? 'done' : wrong}` : null
  const step = over ? ABILITY_STAGES : Math.min(wrong, ABILITY_STAGES)
  const playing = !!round && !over
  const scored = daily || !!challenge
  const hintAt = round?.hintAt ?? ABILITY_STAGES
  const hintLeft = Math.max(0, hintAt - wrong)
  const ability = round?.ability?.[lang]

  const [number, setNumber] = useState(1)
  const played = stats.solved + stats.skipped
  const playedRef = useRef(played)
  playedRef.current = played

  useEffect(() => {
    if (round?.id) setNumber(playedRef.current + 1)
  }, [round?.id])

  const shortcut = useRef<() => void>(() => {})
  shortcut.current = () => {
    if (active && over && !scored) next()
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
      if ((event.target as HTMLElement | null)?.tagName === 'INPUT') return
      shortcut.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const mood = !over ? 'ask' : won ? 'won' : 'lost'
  const heroName = answer ? name(answer) : ''
  const headline = mood === 'ask' ? t('play.abilityTitle') : t(won ? 'ability.won' : 'ability.lost', { name: heroName })
  const subline =
    mood === 'ask'
      ? t('play.abilityPrompt')
      : won
        ? t('ability.wonHint', { count: guesses.length, clarity: clarityAt(Math.min(wrong, ABILITY_STAGES)) })
        : t(daily ? 'ability.lostHintDaily' : 'ability.lostHint')

  const streakLabel: UiKey = daily ? 'play.pillDays' : 'play.pillStreak'
  const streakValue = daily ? (user?.streak ?? 0) : stats.streak

  return (
    <section className="play-layout ability-layout">
      <div className={`ability-stage ${over ? (won ? 'won' : 'lost') : ''}`}>
        <span className="ability-glow" aria-hidden />
        <AbilityIcon className="ability-art" src={src ?? undefined} resetKey={round?.id} />
        <span className="ability-clarity">{t('ability.clarity', { clarity: clarityAt(step) })}</span>
        {round && <span className="ability-round">{daily ? t('daily.daily') : t('play.roundNo', { number })}</span>}
        {over && answer && (
          <span className="ability-banner">
            <small>{t(won ? 'ability.bannerWon' : 'page.bannerLost')}</small>
            <b>{ability ? `${heroName} · ${ability}` : heroName}</b>
          </span>
        )}
      </div>

      <div className="play-main">
        <div className={`play-card mode-ask state-${mood}`}>
          <h2>{headline}</h2>
          <p>{subline}</p>
          <div className="mode-pills">
            <span>{t('play.pillAttempts', { count: guesses.length })}</span>
            <span className="hot">{t(streakLabel, { count: streakValue })}</span>
          </div>
        </div>

        <div className="play-card zoom-scale">
          <div className="zoom-scale-head">
            <span className="play-card-title">{t('ability.scaleTitle')}</span>
            <span>
              {playing && step < ABILITY_STAGES ? t('ability.nextClarity', { clarity: clarityAt(step + 1) }) : t('ability.fullClarity')}
            </span>
          </div>
          <div className="zoom-steps clarity-steps">
            {Array.from({ length: ABILITY_STAGES + 1 }, (_, i) => (
              <span key={i} className={i === step ? 'now' : i < step ? 'past' : ''}>
                <i />
                <b>{clarityAt(i)}%</b>
              </span>
            ))}
          </div>
        </div>

        <div className={`ability-reveal ${ability ? 'open' : ''}`}>
          <span className="ability-reveal-mark" aria-hidden>
            {ability ? <SparkIcon /> : <LockIcon />}
          </span>
          <span className="ability-reveal-text">
            <span className="play-card-title">{t('ability.revealTitle')}</span>
            <b>{ability ?? t('ability.revealIn', { count: hintLeft })}</b>
          </span>
          <span className="ability-dots" aria-hidden>
            {Array.from({ length: hintAt }, (_, i) => (
              <i key={i} className={i < wrong ? 'on' : ''} />
            ))}
          </span>
        </div>

        {playing && <CharacterSearch game={game} exclude={exclude} active={active} busy={busy} onPick={guess} compact />}

        {over && !scored && (
          <button type="button" className="primary mode-next" onClick={next}>
            {t('ability.next')}
          </button>
        )}

        <RoundStatus loading={!round && !error} error={error} onRetry={retry} />

        {round && over && answer && scored && (
          <RoundResult
            game={game}
            answer={answer}
            guesses={guesses.length}
            won={won}
            skipped={skipped}
            stats={stats}
            onNext={next}
            challenge={challenge}
            mode="ability"
            nextAt={round.nextAt}
            compact
          />
        )}

        {round?.daily && yesterday && <Yesterday game={game} entity={yesterday} />}

        <div className="tries">
          <span className="play-card-title">{t('play.tries')}</span>
          {guesses.length === 0 ? (
            <p className="tries-empty">{t(over ? 'play.noTriesOver' : 'play.noTries')}</p>
          ) : (
            <div className="tries-list">
              {guesses.map(({ entity: g, pending }, i) => {
                const hit = won && g.id === answer?.id
                const before = guesses.slice(i + 1).filter((x) => !x.pending && x.entity.id !== answer?.id).length
                return (
                  <div key={g.id} className={`try ${pending ? 'pending' : hit ? 'hit' : 'miss'}`}>
                    <Thumb game={game} entity={g} size={36} />
                    <span className="try-name">{name(g)}</span>
                    <span className="try-zoom">{clarityAt(Math.min(before, ABILITY_STAGES))}%</span>
                    {!pending && <span className="try-verdict">{t(hit ? 'play.hit' : 'play.miss')}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <PlaySide game={game} mode="ability" daily={daily} stats={stats} playing={playing} howto="ability" onGiveUp={giveUp} />
    </section>
  )
}
