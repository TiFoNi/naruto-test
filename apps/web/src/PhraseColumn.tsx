'use client'

import { useEffect, useRef, useState } from 'react'
import { apiSrc } from './api'
import { useI18n } from './i18n'
import { MuteIcon, SoundIcon } from './icons'
import { useBeforePaint } from './paint'

const VOLUME = 'nanda.voice-volume'

const storedVolume = () => {
  try {
    const raw = localStorage.getItem(VOLUME)
    const value = Number(raw)
    return raw !== null && Number.isFinite(value) && value >= 0 && value <= 1 ? value : 1
  } catch {
    return 1
  }
}

type Line = { text: string; ru?: string }

type Props = { lines: Line[]; left: number; voiceLeft: number; voice?: string; resetKey?: string | number; over: boolean }

export default function PhraseColumn({ lines, left, voiceLeft, voice, resetKey, over }: Props) {
  const { t, lang } = useI18n()
  const player = useRef<HTMLAudioElement>(null)
  const [sounding, setSounding] = useState(-1)
  const [volume, setVolume] = useState(1)
  const [open, close] = lang === 'en' ? ['“', '”'] : ['«', '»']

  useBeforePaint(() => setVolume(storedVolume()), [])

  useEffect(() => {
    if (player.current) player.current.volume = volume
  }, [volume])

  useEffect(() => {
    player.current?.pause()
    setSounding(-1)
  }, [resetKey])

  const changeVolume = (value: number) => {
    setVolume(value)
    try {
      localStorage.setItem(VOLUME, String(value))
    } catch {
      return
    }
  }

  const listen = (index: number) => {
    const audio = player.current
    if (!audio || !voice) return
    if (sounding === index && !audio.paused) {
      audio.pause()
      setSounding(-1)
      return
    }
    const src = apiSrc(`${voice}&i=${index}`)
    if (!src) return
    audio.src = src
    audio.volume = volume
    audio.play().then(
      () => setSounding(index),
      () => setSounding(-1),
    )
  }

  return (
    <div className="phrase-column">
      <div className="phrase-card">
        <ol className="phrase-list">
          {lines.map((line, index) => (
            <li key={index} className={index === lines.length - 1 ? 'fresh' : ''}>
              <span className="phrase-text">
                <span className="phrase-quote">
                  {open}
                  {line.text}
                  {close}
                </span>
                {lang !== 'en' && line.ru && <span className="phrase-ru">{line.ru}</span>}
              </span>
              {voice && (
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
        <div className="phrase-foot">
          {!over && (
            <p className="phrase-left muted">
              {!!left && t('phrase.more', { count: left })}
              {!!voiceLeft && <span className="phrase-lock">{t('phrase.voiceIn', { count: voiceLeft })}</span>}
            </p>
          )}
          {voice && (
            <label className="phrase-volume" title={t('phrase.volume')}>
              <span aria-hidden>{volume ? <SoundIcon /> : <MuteIcon />}</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(event) => changeVolume(Number(event.target.value))}
                aria-label={t('phrase.volume')}
              />
            </label>
          )}
        </div>
        <audio ref={player} preload="none" onEnded={() => setSounding(-1)} onPause={() => setSounding(-1)} hidden />
      </div>
    </div>
  )
}
