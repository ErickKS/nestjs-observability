import { Module } from '@nestjs/common'
import { context, trace } from '@opentelemetry/api'
import { PrometheusModule } from '@willsoto/nestjs-prometheus'
import { LoggerModule } from 'nestjs-pino'

@Module({
  imports: [
    PrometheusModule.register(),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
        customProps: () => {
          const span = trace.getSpan(context.active())
          const ctx = span?.spanContext()
          return ctx ? { traceId: ctx.traceId, spanId: ctx.spanId } : {}
        },
      },
    }),
  ],
  providers: [],
})
export class ObservabilityModule {}
