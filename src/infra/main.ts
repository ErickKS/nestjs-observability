// biome-ignore assist/source/organizeImports: OTEL service
import tracingService from './observability/tracing'

import { NestFactory } from '@nestjs/core'
import { Logger } from 'nestjs-pino'
import { AppModule } from './app.module'
import { EnvService } from './env/env.service'

async function bootstrap() {
  tracingService.start()

  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  app.useLogger(app.get(Logger))

  const configService = app.get(EnvService)
  const port = configService.get('PORT')
  await app.listen(port)
}

async function shutdown() {
  try {
    await tracingService.shutdown()
    console.log('Shutdown complete')
    process.exit(0)
  } catch (err) {
    console.error('Error during shutdown:', err)
    process.exit(1)
  }
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

bootstrap()
