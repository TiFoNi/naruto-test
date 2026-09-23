import Thumb from './Thumb'
import type { Entity, Game } from './games/types'
import { useI18n } from './i18n'

export default function Yesterday({ game, entity }: { game: Game; entity: Entity }) {
  const { t, name } = useI18n()
  return (
    <div className="yesterday">
      <span className="muted">{t('daily.yesterday')}</span>
      <Thumb game={game} entity={entity} size={24} />
      <b>{name(entity)}</b>
    </div>
  )
}
