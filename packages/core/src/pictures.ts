import sharp from 'sharp'

export type Shape = 'square' | 'poster' | 'wide'

export const CARD = { width: 288, height: 384 }
export const MINI = { width: 168, height: 224 }
export const FULL = { width: 800, height: 900 }
export const SQUARE = 800
export const CELL = 96

export async function framed(source: Buffer, width: number, height: number, quality: number) {
  const back = await sharp(source).resize(width, height, { fit: 'cover' }).blur(18).modulate({ brightness: 0.75 }).toBuffer()
  const front = await sharp(source).resize(width, height, { fit: 'inside' }).toBuffer()
  return sharp(back).composite([{ input: front, gravity: 'center' }]).webp({ quality }).toBuffer()
}

export async function derive(source: Buffer, shape: Shape = 'square', detailed?: Buffer | null) {
  const trimmed = await sharp(source).trim().png().toBuffer({ resolveWithObject: true })
  const { width, height } = trimmed.info
  const extra = detailed ? await sharp(detailed).trim().png().toBuffer({ resolveWithObject: true }) : null
  const base = extra && extra.info.width > width ? extra : trimmed
  const tight = Math.max(CARD.width / width, CARD.height / height) > 1.2
  const square = shape === 'square'

  const side = Math.min(SQUARE, base.info.width, base.info.height)
  const full = square
    ? await sharp(base.data).resize(side, side, { fit: 'cover', position: 'top' }).webp({ quality: 88 }).toBuffer()
    : await sharp(base.data).resize({ ...FULL, fit: 'inside', withoutEnlargement: true }).webp({ quality: 88 }).toBuffer()

  const card = tight
    ? await framed(trimmed.data, CARD.width, CARD.height, 82)
    : await sharp(trimmed.data).resize(CARD.width, CARD.height, { fit: 'cover', position: 'top' }).webp({ quality: 80 }).toBuffer()

  const mini = square
    ? await sharp(full).resize(MINI.width, MINI.width, { fit: 'cover' }).webp({ quality: 78 }).toBuffer()
    : await sharp(card).resize(MINI.width, MINI.height, { fit: 'cover', position: 'top' }).webp({ quality: 78 }).toBuffer()

  const thumb = square
    ? await sharp(full).resize(CELL, CELL, { fit: 'cover' }).webp({ quality: 88 }).toBuffer()
    : tight
      ? await framed(trimmed.data, CELL, CELL, 88)
      : await sharp(trimmed.data)
          .extract({ left: Math.floor((width - Math.min(width, height)) / 2), top: 0, width: Math.min(width, height), height: Math.min(width, height) })
          .resize(CELL, CELL, { fit: 'cover', position: sharp.strategy.attention })
          .webp({ quality: 88 })
          .toBuffer()

  return { full, card, mini, thumb }
}
