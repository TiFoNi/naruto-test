import { useEffect } from 'react'
import ClassicMode from './ClassicMode'
import ImageMode from './ImageMode'
import { GAMES, gameById } from './games'
import type { Game, GameId } from './games/types'
import { emptyStats, useStoredState, type Stats } from './storage'

type Mode = 'classic' | 'image'

const statsKey = (game: GameId, mode: Mode) => (game === 'naruto' ? `stats-${mode}` : `stats-${game}-${mode}`)

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

function GameModes({ game, mode, visible }: { game: Game; mode: Mode; visible: boolean }) {
  const classic = useModeStats(statsKey(game.id, 'classic'))
  const image = useModeStats(statsKey(game.id, 'image'))
  const current = mode === 'classic' ? classic : image

  return (
    <div hidden={!visible}>
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
      <div hidden={mode !== 'classic'}>
        <ClassicMode game={game} active={visible && mode === 'classic'} stats={classic.stats} onSolved={classic.solved} onGaveUp={classic.gaveUp} />
      </div>
      <div hidden={mode !== 'image'}>
        <ImageMode game={game} active={visible && mode === 'image'} stats={image.stats} onSolved={image.solved} onGaveUp={image.gaveUp} />
      </div>
    </div>
  )
}

export default function App() {
  const [gameId, setGameId] = useStoredState<GameId>('game', 'naruto')
  const [mode, setMode] = useStoredState<Mode>('mode', 'classic')
  const game = gameById(gameId)

  useEffect(() => {
    document.documentElement.dataset.game = game.id
  }, [game.id])

  const modes: { id: Mode; label: string; icon: string }[] = [
    { id: 'classic', label: 'Классика', icon: '?' },
    { id: 'image', label: game.image.label, icon: '🖼' },
  ]

  return (
    <div className="app">
      <header>
        <nav className="games">
          {GAMES.map((g) => (
            <button key={g.id} className={`game-button ${g.id === game.id ? 'active' : ''}`} onClick={() => setGameId(g.id)}>
              {g.label}
            </button>
          ))}
        </nav>
        <h1 className="logo">
          {game.logo[0]}
          <span>{game.logo[1]}</span>
        </h1>
        <div className="tagline">бесконечный режим</div>
        <nav className="modes">
          {modes.map((m) => (
            <button key={m.id} className={`mode-button ${mode === m.id ? 'active' : ''}`} onClick={() => setMode(m.id)}>
              <span className="mode-icon">{m.icon}</span>
              {m.label}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {GAMES.map((g) => (
          <GameModes key={g.id} game={g} mode={mode} visible={g.id === game.id} />
        ))}
      </main>

      <footer>
        Фанатский проект · данные и изображения: Naruto Wiki, Dattebayo API, Valve, OpenDota, Dota 2 Wiki, Attack on Titan Wiki,
        Bleach Wiki, MyAnimeList
      </footer>
    </div>
  )
}
