import { GAMES } from './games'
import { apiJson } from './games/meta.server'
import ui, { type Lang } from './i18n/ui'

type Row = { name: string; nameUk?: string; nameEn: string; answer?: boolean }

const NAMES = 80

const titled = (row: Row, lang: Lang) => (lang === 'en' ? row.nameEn : lang === 'uk' ? (row.nameUk ?? row.name) : row.name)

export default async function WorldAbout({ game, lang }: { game: string; lang: Lang }) {
  const world = GAMES.find((one) => one.id === game)
  if (!world) return null

  const data = await apiJson<{ entities: Row[] }>(`entities?game=${game}`, 600)
  const list = (data?.entities ?? []).filter((row) => row.answer !== false)
  if (!list.length) return null

  const names = list.map((row) => titled(row, lang)).sort((one, two) => one.localeCompare(two, lang))
  const shown = names.slice(0, NAMES)
  const count = ui[world.unit === 'manga' ? 'dash.titles' : world.unit === 'hero' ? 'dash.heroes' : world.unit === 'player' ? 'dash.players' : 'dash.characters'][lang]

  return (
    <section className="world-about">
      <h2>{world.label[lang]}</h2>
      <p>
        {world.description[lang]} {count.replace('{count}', String(list.length))}.
      </p>
      <p className="world-names">
        {ui['about.roster'][lang]}: {shown.join(', ')}
        {names.length > shown.length ? ui['about.more'][lang].replace('{count}', String(names.length - shown.length)) : '.'}
      </p>
    </section>
  )
}
