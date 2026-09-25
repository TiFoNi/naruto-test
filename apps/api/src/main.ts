import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import compression from 'compression'
import { raw } from 'express'
import { AppModule } from './app.module'

const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((o) => o.trim())

async function bootstrap() {
  const port = Number(process.env.PORT ?? 4000)
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  app.set('trust proxy', 1)
  app.use(compression())
  app.use(raw({ type: 'multipart/form-data', limit: '40mb' }))
  app.enableCors({ origin: origins, credentials: true })
  await app.listen(port, '0.0.0.0')
  console.log(`[nanda] слухаю порт ${port}, CORS для: ${origins.join(', ')}`)
}

void bootstrap()
