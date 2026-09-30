import { GAMES } from './games'

export default function GameAccent({ game }: { game: string }) {
  const accent = GAMES.find((one) => one.id === game)?.accent
  if (!accent || !/^#[0-9a-f]{3,8}$/i.test(accent)) return null
  return <style>{`html[data-auth="1"]{--accent:${accent}}`}</style>
}
