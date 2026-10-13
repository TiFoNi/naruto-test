import { GAMES } from './games'
import { apiJson } from './games/meta.server'
import ui, { type Lang } from './i18n/ui'
import { InfoIcon } from './icons'

type Row = { answer?: boolean }

export default async function WorldAbout({ game, lang }: { game: string; lang: Lang }) {
  const world = GAMES.find((one) => one.id === game)
  if (!world) return null

  const data = await apiJson<{ entities: Row[] }>(`entities?game=${game}`, 600)
  const list = (data?.entities ?? []).filter((row) => row.answer !== false)
  if (!list.length) return null

  const count = ui[world.unit === 'manga' ? 'dash.titles' : world.unit === 'hero' ? 'dash.heroes' : world.unit === 'player' ? 'dash.players' : 'dash.characters'][lang]

  return (
    <details className="world-i">
      <summary title={ui['about.world'][lang]} aria-label={ui['about.world'][lang]}>
        <InfoIcon />
      </summary>
      <div className="world-pop">
        <span className="world-pop-head">
          <b>{ui['about.world'][lang]}</b>
          <small>{count.replace('{count}', String(list.length))}</small>
        </span>
        <p>{world.description[lang]}</p>
      </div>
    </details>
  )
}
