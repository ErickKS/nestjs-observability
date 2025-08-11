import { z } from 'zod'

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  PORT: z.coerce.number().optional().default(3333),
  OTEL_SERVICE_NAME: z.string(),
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: z.url(),
})

export type Env = z.infer<typeof envSchema>
