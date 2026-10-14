import type { ComponentType } from 'react'
import {
  BoltIcon,
  BookIcon,
  CalendarIcon,
  ClockIcon,
  CrownIcon,
  DiceIcon,
  EyeIcon,
  FilmIcon,
  FlagIcon,
  FlameIcon,
  GamepadIcon,
  GlobeIcon,
  GridIcon,
  HashIcon,
  InfinityIcon,
  LayersIcon,
  MedalIcon,
  MoonIcon,
  PageIcon,
  PictureIcon,
  PuzzleIcon,
  RefreshIcon,
  ShieldIcon,
  SortIcon,
  SoundIcon,
  SparkIcon,
  SpeechIcon,
  StarIcon,
  SunriseIcon,
  SwordsIcon,
  TargetIcon,
  TrophyIcon,
  UsersIcon,
  ZoomInIcon,
} from './icons'

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  solved: LayersIcon,
  firstTry: MedalIcon,
  sniper: TargetIcon,
  marathon: InfinityIcon,
  daily: CalendarIcon,
  perfectWeek: CrownIcon,
  sharpEye: EyeIcon,

  modeTour: GridIcon,
  modeClassic: PuzzleIcon,
  modeImage: PictureIcon,
  modeAbility: SparkIcon,
  modePage: PageIcon,
  modeOdd: SortIcon,
  modePhrase: SoundIcon,
  allRounder: StarIcon,

  worlds: GlobeIcon,
  worldDone: BookIcon,
  worldShare: FilmIcon,
  gamer: GamepadIcon,

  duelWins: SwordsIcon,
  duelPlayed: UsersIcon,
  blitz: BoltIcon,
  boardWins: HashIcon,

  streak: FlameIcon,
  nightOwl: MoonIcon,
  earlyBird: SunriseIcon,

  trophies: TrophyIcon,

  lucky: DiceIcon,
  comeback: RefreshIcon,
  polyglot: SpeechIcon,
  gaveUpNever: ShieldIcon,
  sniperDay: ZoomInIcon,
  owlMarathon: MoonIcon,

  seasonSolved: FlagIcon,
  seasonDays: ClockIcon,
  seasonDaily: CalendarIcon,
  seasonFirstTry: MedalIcon,
  seasonDuel: SwordsIcon,
  seasonWorlds5: GlobeIcon,
  seasonModes4: GridIcon,
  seasonMarathon30: InfinityIcon,
}

const ART: Record<string, string> = {
  firstTry: 'firstTry',
  sharpEye: 'sharpEye',
  owlMarathon: 'owlMarathon',
  duelPlayed: 'duelPlayed',
  blitz: 'blitz',
  marathon: 'marathon',
  allRounder: 'allRounder',
  gamer: 'gamer',
  trophies: 'trophies',
  lucky: 'lucky',
  perfectWeek: 'perfectWeek',
  modePhrase: 'modePhrase',
  worldShare: 'worldShare',
  comeback: 'comeback',
  gaveUpNever: 'gaveUpNever',
  earlyBird: 'earlyBird',
  worlds: 'worlds',
  streak: 'streak',
}

export default function AwardIcon({ award, family }: { award?: string | null; family?: string | null }) {
  const art = ART[family ?? ''] ?? ART[award ?? '']
  if (art) return <img className="icon award-art" src={`/awards/${art}.webp`} alt="" width={512} height={512} loading="lazy" decoding="async" draggable={false} />
  const Icon = ICONS[family ?? ''] ?? ICONS[award ?? ''] ?? TrophyIcon
  return <Icon />
}
