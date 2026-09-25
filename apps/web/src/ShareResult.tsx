import { BRAND } from './brand'
import { useI18n } from './i18n'
import { CopyIcon } from './icons'

export type Tile = 'hit' | 'miss' | 'idle'

type Props = { caption: string; tiles: Tile[]; summary: string; won: boolean }

const NETWORKS = ['X', 'Telegram', 'Facebook', 'Reddit']

export default function ShareResult({ caption, tiles, summary, won }: Props) {
  const { t } = useI18n()

  return (
    <section className="play-card share">
      <span className="play-card-title">{t('share.title')}</span>
      <div className="share-body">
        <div className="share-preview">
          <div className="share-head">
            <span className="share-brand">
              {BRAND.parts[0]}
              <em>{BRAND.parts[1]}</em>
            </span>
            <span className="share-caption">{caption}</span>
          </div>
          <div className="share-tiles" style={{ ['--tiles' as string]: tiles.length }}>
            {tiles.map((tile, index) => (
              <i key={index} className={tile} />
            ))}
          </div>
          <span className={`share-summary ${won ? 'won' : 'lost'}`}>{summary}</span>
        </div>
        <div className="share-actions">
          <button type="button" className="share-copy">
            <CopyIcon /> {t('share.copy')}
          </button>
          <div className="share-networks">
            {NETWORKS.map((network) => (
              <button key={network} type="button">
                {network}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
