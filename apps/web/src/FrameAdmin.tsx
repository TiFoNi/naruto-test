'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import Avatar from './Avatar'
import { useAuth } from './auth'
import { FRAMES, TUNE_DEFAULT, frameUrl, keepTune, tuneOf, type FrameTune } from './frames'

const SIZES = [148, 92, 44]

const STEPS = [
  { key: 'scale' as const, label: 'размер', min: 1, max: 2.4, step: 0.01, tail: '×' },
  { key: 'x' as const, label: 'сдвиг по X', min: -20, max: 20, step: 0.5, tail: '%' },
  { key: 'y' as const, label: 'сдвиг по Y', min: -20, max: 20, step: 0.5, tail: '%' },
  { key: 'cut' as const, label: 'обрезка авы', min: 50, max: 100, step: 0.5, tail: '%' },
  { key: 'cx' as const, label: 'обрезка по X', min: -20, max: 20, step: 0.5, tail: '%' },
  { key: 'cy' as const, label: 'обрезка по Y', min: -20, max: 20, step: 0.5, tail: '%' },
]

export default function FrameAdmin() {
  const { user } = useAuth()
  const [picked, setPicked] = useState(FRAMES[0]?.id ?? '')
  const [all, setAll] = useState<Record<string, FrameTune>>({})
  const [took, setTook] = useState(false)

  useEffect(() => {
    setAll(Object.fromEntries(FRAMES.map((one) => [one.id, tuneOf(one.id)])))
  }, [])

  const one = all[picked] ?? TUNE_DEFAULT

  const set = (key: keyof FrameTune, value: number) => {
    const next = { ...all, [picked]: { ...one, [key]: value } }
    setAll(next)
    keepTune(next)
  }

  const reset = () => {
    const next = { ...all, [picked]: TUNE_DEFAULT }
    setAll(next)
    keepTune(next)
  }

  const text = JSON.stringify(
    Object.fromEntries(FRAMES.map((frame) => [frame.id, all[frame.id] ?? TUNE_DEFAULT])),
    null,
    2,
  )

  return (
    <div className="admin frame-admin">
      <header className="admin-head">
        <h1>Посадка рамок</h1>
        <p className="muted">Крути ползунки — аватарка меняется сразу по всему сайту. Потом скопируй JSON и отдай его мне.</p>
      </header>

      <div className="frame-admin-body">
        <aside className="frame-admin-list">
          {FRAMES.map((frame) => (
            <button
              key={frame.id}
              type="button"
              className={`frame-admin-pick ${picked === frame.id ? 'on' : ''}`}
              onClick={() => setPicked(frame.id)}
            >
              <span style={{ backgroundImage: `url(${frameUrl(frame.id)})` }} />
              <b>{frame.id}</b>
            </button>
          ))}
        </aside>

        <section className="frame-admin-main">
          <div className="frame-admin-stage">
            {SIZES.map((size) => (
              <div key={size} className="frame-admin-cell">
                <span style={{ '--face': `${size}px` } as CSSProperties}>
                  <Avatar id={user?.id} name={user?.nickname ?? 'T'} avatar={user?.avatar} frame={picked} />
                </span>
                <small>{size}px</small>
              </div>
            ))}
          </div>

          <div className="frame-admin-knobs">
            {STEPS.map((knob) => (
              <label key={knob.key}>
                <span>
                  {knob.label}
                  <b>
                    {one[knob.key]}
                    {knob.tail}
                  </b>
                </span>
                <input
                  type="range"
                  min={knob.min}
                  max={knob.max}
                  step={knob.step}
                  value={one[knob.key]}
                  onChange={(event) => set(knob.key, Number(event.target.value))}
                />
              </label>
            ))}
            <div className="frame-admin-acts">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(text)
                  setTook(true)
                  setTimeout(() => setTook(false), 1600)
                }}
              >
                {took ? 'Скопировано' : 'Сохранить'}
              </button>
              <button type="button" className="ghost" onClick={reset}>
                Сбросить
              </button>
            </div>
          </div>

          <textarea className="frame-admin-out" readOnly value={text} rows={FRAMES.length * 3 + 2} />
        </section>
      </div>
    </div>
  )
}
