import Link from 'next/link'

export type Section = { heading: string; paragraphs: string[]; list?: string[] }

export default function Legal({ title, updated, intro, sections }: { title: string; updated: string; intro: string; sections: Section[] }) {
  return (
    <main className="legal">
      <Link className="back" href="/">
        ← NandaGuessr
      </Link>
      <h1>{title}</h1>
      <p className="legal-updated">{updated}</p>
      <p className="legal-intro">{intro}</p>
      {sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.paragraphs.map((text) => (
            <p key={text}>{text}</p>
          ))}
          {section.list && (
            <ul>
              {section.list.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </main>
  )
}
