export const CONTACT = { email: 'hello@nandaguessr.com', support: '' }

export const SOCIALS: { id: string; label: string; handle: string; href: string; accent: string }[] = [
  { id: 'tg', label: 'Telegram', handle: '@nandaguessr', href: 'https://t.me/nandaguessr', accent: '#3aa8f0' },
  { id: 'tiktok', label: 'TikTok', handle: '@nandaguessr__', href: 'https://www.tiktok.com/@nandaguessr__', accent: '#fe2c55' },
  { id: 'yt', label: 'YouTube', handle: '@NandaGuessr', href: 'https://www.youtube.com/@NandaGuessr', accent: '#f0362f' },
]

export type Source = { name: string; href: string; licence: string }

export const SOURCES: Source[] = [
  { name: 'Naruto Wiki', href: 'https://naruto.fandom.com', licence: 'CC BY-SA' },
  { name: 'Dattebayo API', href: 'https://dattebayo-api.onrender.com', licence: 'api' },
  { name: 'Attack on Titan Wiki', href: 'https://attackontitan.fandom.com', licence: 'CC BY-SA' },
  { name: 'Bleach Wiki', href: 'https://bleach.fandom.com', licence: 'CC BY-SA' },
  { name: 'Tokyo Ghoul Wiki', href: 'https://tokyoghoul.fandom.com', licence: 'CC BY-SA' },
  { name: 'Berserk Wiki', href: 'https://berserk.fandom.com', licence: 'CC BY-SA' },
  { name: 'Kimetsu no Yaiba Wiki', href: 'https://kimetsu-no-yaiba.fandom.com', licence: 'CC BY-SA' },
  { name: 'One Piece Wiki', href: 'https://onepiece.fandom.com', licence: 'CC BY-SA' },
  { name: 'Mortal Kombat Wiki', href: 'https://mortalkombat.fandom.com', licence: 'CC BY-SA' },
  { name: 'Hunterpedia', href: 'https://hunterxhunter.fandom.com', licence: 'CC BY-SA' },
  { name: 'Black Clover Wiki', href: 'https://blackclover.fandom.com', licence: 'CC BY-SA' },
  { name: "JoJo's Bizarre Encyclopedia", href: 'https://jojo.fandom.com', licence: 'CC BY-SA' },
  { name: 'Soul Eater Wiki', href: 'https://souleater.fandom.com', licence: 'CC BY-SA' },
  { name: 'Fire Force Wiki', href: 'https://fireforce.fandom.com', licence: 'CC BY-SA' },
  { name: 'Death Note Wiki', href: 'https://deathnote.fandom.com', licence: 'CC BY-SA' },
  { name: 'Dota 2 Wiki', href: 'https://dota2.fandom.com', licence: 'CC BY-SA' },
  { name: 'OpenDota', href: 'https://www.opendota.com', licence: 'api' },
  { name: 'Valve', href: 'https://www.valvesoftware.com', licence: 'owner' },
  { name: 'MangaDex', href: 'https://mangadex.org', licence: 'api' },
  { name: 'MyAnimeList', href: 'https://myanimelist.net', licence: 'api' },
  { name: 'Wikidata', href: 'https://www.wikidata.org', licence: 'CC0' },
  { name: 'Wikimedia Commons', href: 'https://commons.wikimedia.org', licence: 'files' },
]
