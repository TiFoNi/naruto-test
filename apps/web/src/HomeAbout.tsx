import ui, { type Lang } from './i18n/ui'
import type { GameMeta } from './games/meta'

export const faq = (lang: Lang, games: GameMeta[]) => {
  const worlds = games.map((game) => game.label[lang]).join(', ')
  return [
    { q: ui['home.aboutTitle'][lang] + '?', a: ui['home.aboutLead'][lang] },
    { q: ui['faq.playQ'][lang], a: ui['faq.playA'][lang] },
    { q: ui['faq.freeQ'][lang], a: ui['faq.freeA'][lang] },
    { q: ui['faq.wordleQ'][lang], a: ui['faq.wordleA'][lang] },
    { q: ui['faq.worldsQ'][lang], a: `${games.length}: ${worlds}.` },
  ]
}

export default function HomeAbout({ lang, games }: { lang: Lang; games: GameMeta[] }) {
  const rows = faq(lang, games)

  return (
    <section className="home-about">
      <h2>{ui['home.aboutTitle'][lang]}</h2>
      <p>{ui['home.aboutLead'][lang]}</p>
      <dl>
        {rows.slice(1).map((row) => (
          <div key={row.q}>
            <dt>{row.q}</dt>
            <dd>{row.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
