import CharacterSearch from './CharacterSearch'
import PlaySide from './PlaySide'
import RoundResult from './RoundResult'
import RoundStatus from './RoundStatus'
import Thumb from './Thumb'
import Yesterday from './Yesterday'
import type { Game } from './games/types'
import { useI18n } from './i18n'
import { SoundIcon } from './icons'
import type { Stats } from './stats'
import { useRound } from './useRound'
import { useEffect, useRef, useState } from 'react'
import { apiSrc } from './api'

type Props = { game: Game; active: boolean; stats: Stats; daily?: boolean; challenge?: string }

export default function PhraseMode({ game, active, stats, daily = false, challenge }: Props) {
  const { t, name, lang } = useI18n()
  const { round, guesses, exclude, over, won, skipped, answer, yesterday, busy, error, guess, giveUp, next, retry } = useRound(
    game,
    'phrase',
    active,
    daily,
    challenge,
  )
  const playing = !!round && !over
  const scored = !skipped || over
  const phrases = round?.phrases ?? []
  const voiceAt = round?.voiceAt ?? 3
  const voiceLeft = Math.max(voiceAt - phrases.length, 0)
  const mood = over ? (won ? 'won' : 'lost') : 'ask'
  const [open, close] = lang === 'en' ? ['\u201c', '\u201d'] : ['«', '»']

  const player = useRef<HTMLAudioElement>(null)
  const [sounding, setSounding] = useState(-1)

  useEffect(() => {
    player.current?.pause()
    setSounding(-1)
  }, [round?.id])

  const listen = (index: number) => {
    const audio = player.current
    if (!audio || !round?.voice) return
    if (sounding === index && !audio.paused) {
      audio.pause()
      setSounding(-1)
      return
    }
    const src = apiSrc(`${round.voice}&i=${index}`)
    if (!src) return
    audio.src = src
    audio.play().then(() => setSounding(index), () => setSounding(-1))
  }

  const headline = over
    ? t(won ? 'phrase.headlineWon' : 'phrase.headlineLost')
    : t('play.phraseTitle')
  const subline = over
    ? t(won ? 'phrase.wonHint' : 'phrase.lostHint', { count: guesses.length })
    : t('play.phrasePrompt')

  return (
    <section className="play-layout phrase-layout">
      <div className="phrase-column">
        <div className="phrase-card">
          <ol className="phrase-list">
            {phrases.map((line, index) => (
              <li key={index} className={index === phrases.length - 1 ? 'fresh' : ''}>
                <span className="phrase-quote">
                  {open}
                  {line}
                  {close}
                </span>
                {round?.voice && (
                  <button
                    type="button"
                    className={`phrase-play ${sounding === index ? 'on' : ''}`}
                    onClick={() => listen(index)}
                    aria-label={t('phrase.listen')}
                    title={t('phrase.listen')}
                  >
                    <SoundIcon />
                  </button>
                )}
              </li>
            ))}
          </ol>
          {!over && (
            <p className="phrase-left muted">
              {!!round?.phrasesLeft && t('phrase.more', { count: round.phrasesLeft })}
              {!!voiceLeft && <span className="phrase-lock">{t('phrase.voiceIn', { count: voiceLeft })}</span>}
            </p>
          )}
          <audio ref={player} preload="none" onEnded={() => setSounding(-1)} onPause={() => setSounding(-1)} hidden />
        </div>
      </div>

      <div className="play-main">
        <div className={`play-card mode-ask state-${mood}`}>
          <h2>{headline}</h2>
          <p>{subline}</p>
        </div>

        {!over && !error && <CharacterSearch game={game} exclude={exclude} busy={busy || !round} onPick={guess} compact />}

        {over && !scored && (
          <button type="button" className="primary mode-next" onClick={next}>
            {t('ability.next')}
          </button>
        )}

        <RoundStatus error={error} onRetry={retry} />

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
            mode="phrase"
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
              {guesses.map(({ entity: g, pending }) => {
                const hit = won && g.id === answer?.id
                return (
                  <div key={g.id} className={`try ${pending ? 'pending' : hit ? 'hit' : 'miss'}`}>
                    <Thumb game={game} entity={g} size={36} />
                    <span className="try-name">{name(g)}</span>
                    {!pending && <span className="try-verdict">{t(hit ? 'play.hit' : 'play.miss')}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <PlaySide game={game} mode="phrase" daily={daily} stats={stats} playing={playing} howto="phrase" onGiveUp={giveUp} />
    </section>
  )
}
