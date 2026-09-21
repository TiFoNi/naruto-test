import ClassicMode from './ClassicMode'
import ImageMode from './ImageMode'
import { emptyStats, useStoredState, type Stats } from './storage'

type Mode = 'classic' | 'image'

const MODES: { id: Mode; label: string; icon: string }[] = [
  { id: 'classic', label: 'Классика', icon: '?' },
  { id: 'image', label: 'Картинка', icon: '🖼' },
]

function useModeStats(key: string) {
  const [stats, setStats] = useStoredState<Stats>(key, emptyStats)
  const solved = (guesses: number) =>
    setStats((s) => {
      const streak = s.streak + 1
      return { solved: s.solved + 1, streak, best: Math.max(s.best, streak), totalGuesses: s.totalGuesses + guesses }
    })
  const gaveUp = () => setStats((s) => ({ ...s, streak: 0 }))
  return { stats, solved, gaveUp }
}

export default function App() {
  const [mode, setMode] = useStoredState<Mode>('mode', 'classic')
  const classic = useModeStats('stats-classic')
  const image = useModeStats('stats-image')
  const current = mode === 'classic' ? classic : image

  return (
    <div className="app">
      <header>
        <h1 className="logo">
          NARUTO<span>DLE</span>
        </h1>
        <div className="tagline">бесконечный режим</div>
        <nav className="modes">
          {MODES.map((m) => (
            <button
              key={m.id}
              className={`mode-button ${mode === m.id ? 'active' : ''}`}
              onClick={() => setMode(m.id)}
            >
              <span className="mode-icon">{m.icon}</span>
              {m.label}
            </button>
          ))}
        </nav>
        <div className="stats">
          <div>
            <b>{current.stats.solved}</b>угадано
          </div>
          <div>
            <b>{current.stats.streak}</b>серия
          </div>
          <div>
            <b>{current.stats.best}</b>рекорд
          </div>
          <div>
            <b>{current.stats.solved ? (current.stats.totalGuesses / current.stats.solved).toFixed(1) : '–'}</b>
            ср. попыток
          </div>
        </div>
      </header>

      <main>
        <div hidden={mode !== 'classic'}>
          <ClassicMode stats={classic.stats} onSolved={classic.solved} onGaveUp={classic.gaveUp} />
        </div>
        <div hidden={mode !== 'image'}>
          <ImageMode stats={image.stats} onSolved={image.solved} onGaveUp={image.gaveUp} />
        </div>
      </main>

      <footer>Данные и изображения: Naruto Wiki (Fandom) через Dattebayo API · фанатский проект</footer>
    </div>
  )
}
