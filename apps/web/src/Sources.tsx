import { SOURCES } from './contacts'
import ui, { type Lang } from './i18n/ui'

const NOTE: Record<string, keyof typeof ui> = {
  'CC BY-SA': 'sources.ccbysa',
  CC0: 'sources.cc0',
  api: 'sources.api',
  files: 'sources.files',
  owner: 'sources.owner',
}

export default function Sources({ lang }: { lang: Lang }) {
  return (
    <div className="legal sources-page page-main">
      <h1>{ui['sources.title'][lang]}</h1>
      <p className="legal-intro">{ui['sources.intro'][lang]}</p>

      <ul className="sources-list">
        {SOURCES.map((source) => (
          <li key={source.name}>
            <a href={source.href} target="_blank" rel="noreferrer noopener">
              {source.name}
            </a>
            <small>{ui[NOTE[source.licence] ?? 'sources.api'][lang]}</small>
          </li>
        ))}
      </ul>

      <p className="legal-intro">{ui['footer.disclaimer'][lang]}</p>
    </div>
  )
}
