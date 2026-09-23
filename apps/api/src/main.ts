import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((o) => o.trim())

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.enableCors({ origin: origins, credentials: true })
  await app.listen(Number(process.env.PORT ?? 4000), '0.0.0.0')
}

void bootstrap()
