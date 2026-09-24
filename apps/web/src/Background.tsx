const GLYPHS = [
  { at: '6%', size: 120, seconds: 52, delay: -8, sign: '?', hot: false },
  { at: '18%', size: 56, seconds: 38, delay: -22, sign: '!', hot: true },
  { at: '31%', size: 84, seconds: 46, delay: -3, sign: '?', hot: false },
  { at: '47%', size: 40, seconds: 34, delay: -17, sign: '!', hot: false },
  { at: '58%', size: 140, seconds: 60, delay: -30, sign: '?', hot: true },
  { at: '71%', size: 64, seconds: 42, delay: -11, sign: '?!', hot: false },
  { at: '84%', size: 96, seconds: 50, delay: -40, sign: '!', hot: false },
  { at: '93%', size: 48, seconds: 36, delay: -6, sign: '?', hot: true },
]

export default function Background() {
  return (
    <div className="backdrop" aria-hidden>
      <span className="backdrop-blob blob-a" />
      <span className="backdrop-blob blob-b" />
      <span className="backdrop-blob blob-c" />
      <span className="backdrop-dots" />
      {GLYPHS.map((glyph) => (
        <span
          key={glyph.at}
          className={`backdrop-glyph ${glyph.hot ? 'hot' : ''}`}
          style={{ left: glyph.at, fontSize: glyph.size, animationDuration: `${glyph.seconds}s`, animationDelay: `${glyph.delay}s` }}
        >
          {glyph.sign}
        </span>
      ))}
      <span className="backdrop-vignette" />
    </div>
  )
}
