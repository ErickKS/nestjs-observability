import { Attributes, Span as OTelSpan, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api'

interface TraceOptions {
  name?: string
  kind?: SpanKind
  captureArgs?: boolean
  captureResult?: boolean
  captureExceptions?: boolean
  attributes?: Attributes
  events?: string[]
}

type SpanOptionsFunction = (...args: unknown[]) => TraceOptions
type SpanConfig = TraceOptions | SpanOptionsFunction

export function Span(config: SpanConfig = {}) {
  return (target: unknown, propertyName: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value

    const isAsync = originalMethod.constructor.name === 'AsyncFunction'

    const createSpanLogic = (args: unknown[], span: OTelSpan, options: TraceOptions) => {
      const spanName = options.name || `${(target as object).constructor.name}.${propertyName}`

      span.addEvent('operation.started')

      if (options.captureArgs && args.length > 0) {
        const sanitizedArgs = args.map(arg => sanitizeObject(arg))
        span.setAttribute('input.args', JSON.stringify(sanitizedArgs))
      }

      if (options.attributes) span.setAttributes(options.attributes)

      return spanName
    }

    if (isAsync) {
      descriptor.value = async function (...args: unknown[]) {
        const options = typeof config === 'function' ? config(...args) : config
        const spanName = options.name || `${(target as object).constructor.name}.${propertyName}`

        const tracer = trace.getTracer('custom-tracer')
        return await tracer.startActiveSpan(
          spanName,
          {
            kind: options.kind || SpanKind.INTERNAL,
          },
          async span => {
            try {
              createSpanLogic(args, span, options)

              const result = await originalMethod.apply(this, args)

              span.setAttributes({
                'operation.success': true,
              })
              if (options.captureResult && result) {
                const sanitizedResult = sanitizeObject(result)
                span.setAttribute('output.result', JSON.stringify(sanitizedResult))
              }
              options.events?.forEach(event => span.addEvent(event))
              span.addEvent('operation.completed')
              span.setStatus({ code: SpanStatusCode.OK })
              return result
            } catch (error) {
              const err = error as Error
              if (options.captureExceptions !== false) {
                span.recordException(err)
                span.setAttributes({
                  'error.name': err.name,
                  'error.message': err.message,
                  'operation.success': false,
                })
              }
              span.setStatus({
                code: SpanStatusCode.ERROR,
                message: err.message,
              })
              span.addEvent('operation.failed', {
                'error.type': err.constructor.name,
              })
              throw error
            } finally {
              span.end()
            }
          }
        )
      }
    } else {
      descriptor.value = function (...args: unknown[]) {
        const options = typeof config === 'function' ? config(...args) : config
        const spanName = options.name || `${(target as object).constructor.name}.${propertyName}`

        const tracer = trace.getTracer('custom-tracer')
        return tracer.startActiveSpan(
          spanName,
          {
            kind: options.kind || SpanKind.INTERNAL,
          },
          span => {
            try {
              createSpanLogic(args, span, options)

              const result = originalMethod.apply(this, args)

              span.setAttributes({
                'operation.success': true,
              })

              if (options.captureResult && result) {
                const sanitizedResult = sanitizeObject(result)
                span.setAttribute('output.result', JSON.stringify(sanitizedResult))
              }

              options.events?.forEach(event => span.addEvent(event))
              span.addEvent('operation.completed')
              span.setStatus({ code: SpanStatusCode.OK })
              return result
            } catch (error) {
              const err = error as Error
              if (options.captureExceptions !== false) {
                span.recordException(err)
                span.setAttributes({
                  'error.name': err.name,
                  'error.message': err.message,
                  'operation.success': false,
                })
              }
              span.setStatus({
                code: SpanStatusCode.ERROR,
                message: err.message,
              })
              span.addEvent('operation.failed', {
                'error.type': err.constructor.name,
              })
              throw error
            } finally {
              span.end()
            }
          }
        )
      }
    }

    return descriptor
  }
}

function isSensitiveField(fieldName: string): boolean {
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization', 'cookie', 'session', 'credential', 'private', 'auth']
  return sensitiveFields.some(sensitive => fieldName.toLowerCase().includes(sensitive))
}

function sanitizeObject(obj: unknown, maxDepth: number = 3, currentDepth: number = 0) {
  if (currentDepth >= maxDepth) return '[Object: max depth reached]'
  if (obj === null || obj === undefined) return obj
  if (typeof obj !== 'object') return obj
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(item => sanitizeObject(item, maxDepth, currentDepth + 1))

  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveField(key)) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value, maxDepth, currentDepth + 1)
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}
