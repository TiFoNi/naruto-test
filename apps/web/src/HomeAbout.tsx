import ui, { type Lang } from './i18n/ui'
import type { GameMeta } from './games/meta'
import { counts } from './seo'

export default function HomeAbout({ lang, games }: { lang: Lang; games: GameMeta[] }) {
  const cards = games.reduce((sum, game) => sum + game.count, 0)
  const steps = [ui['home.step1'][lang], ui['home.step2'][lang], ui['home.step3'][lang]]

  return (
    <section className="home-about">
      <h2>{ui['howto.title'][lang]}</h2>
      <ol>
        {steps.map((step, index) => (
          <li key={step}>
            <i>{index + 1}</i>
            {step}
          </li>
        ))}
      </ol>
      <p>{counts(lang, games.length, cards)}</p>
    </section>
  )
}
