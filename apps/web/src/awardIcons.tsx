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

export default function AwardIcon({ award, family }: { award?: string | null; family?: string | null }) {
  const Icon = ICONS[family ?? ''] ?? ICONS[award ?? ''] ?? TrophyIcon
  return <Icon />
}
