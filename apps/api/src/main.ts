import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import compression from 'compression'
import { raw } from 'express'
import { refreshDifficulty } from '@nanda/core/difficulty'
import { AppModule } from './app.module'
import { egressMeter } from './egress-meter'
import { liftCookies } from './lift-cookies'
import { rateLimit } from './rate-limit'

const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((o) => o.trim())

async function bootstrap() {
  const port = Number(process.env.PORT ?? 4000)
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  app.set('trust proxy', 1)
  app.use(rateLimit)
  app.use(liftCookies)
  app.use(egressMeter)
  const plain = ['/api/stream/', '/api/tune/audio']
  app.use(
    compression({
      filter: (req, res) => !plain.some((path) => req.path.startsWith(path)) && compression.filter(req, res),
    }),
  )
  app.use(raw({ type: 'multipart/form-data', limit: '40mb' }))
  app.enableCors({ origin: origins, credentials: true, maxAge: 86400 })
  await app.listen(port, '0.0.0.0')
  console.log(`[nanda] слухаю порт ${port}, CORS для: ${origins.join(', ')}`)
  void refreshDifficulty()
}

void bootstrap()
