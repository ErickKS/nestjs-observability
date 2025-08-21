import { Attributes, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api'

interface TraceOptions {
  name?: string
  kind?: SpanKind
  captureArgs?: boolean
  captureResult?: boolean
  captureExceptions?: boolean
  attributes?: Attributes
  events?: string[]
}

type TraceOptionsOrFunction = TraceOptions | ((...args: unknown[]) => TraceOptions)

function isAsyncFunction(fn: (...args: unknown[]) => unknown): boolean {
  // Check constructor name first (most reliable)
  if (fn.constructor.name === 'AsyncFunction') return true

  // Check function string representation
  const fnString = fn.toString().replace(/\s+/g, ' ').trim()

  // Look for async keyword at the beginning (after possible whitespace)
  if (/^async\s/.test(fnString)) return true

  // Look for async in method definitions: async methodName() or async *methodName()
  if (/:\s*async\s+/.test(fnString) || /async\s+\*/.test(fnString)) return true

  return false
}

function resolveTraceOptions(optionsOrFn: TraceOptionsOrFunction, args: unknown[]): TraceOptions {
  if (typeof optionsOrFn === 'function') return optionsOrFn(...args)
  return optionsOrFn
}

function executeWithSpan<T>(
  originalMethod: (...args: unknown[]) => T | Promise<T>,
  context: unknown,
  args: unknown[],
  spanName: string,
  optionsOrFn: TraceOptionsOrFunction,
  isAsync: boolean
): T | Promise<T> {
  const tracer = trace.getTracer('custom-tracer')

  // Resolve options dynamically based on arguments
  const options = resolveTraceOptions(optionsOrFn, args)
  const finalSpanName = options.name || spanName

  if (isAsync) {
    return tracer.startActiveSpan(
      finalSpanName,
      {
        kind: options.kind || SpanKind.INTERNAL,
        attributes: options.attributes,
      },
      async span => {
        try {
          span.addEvent('operation.started')

          if (options.captureArgs && args.length > 0) {
            const sanitizedArgs = args.map(arg => sanitizeObject(arg))
            span.setAttribute('input.args', JSON.stringify(sanitizedArgs))
          }

          const result = await originalMethod.apply(context, args)

          span.setAttributes({ 'operation.success': true })

          if (options.captureResult && result !== undefined && result !== null) {
            const sanitizedResult = sanitizeObject(result)
            span.setAttribute('output.result', JSON.stringify(sanitizedResult))
          }

          if (options.events) {
            for (const event of options.events) {
              span.addEvent(event)
            }
          }

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
    ) as Promise<T>
  }

  // Synchronous execution
  return tracer.startActiveSpan(
    finalSpanName,
    {
      kind: options.kind || SpanKind.INTERNAL,
      attributes: options.attributes,
    },
    span => {
      try {
        span.addEvent('operation.started')

        if (options.captureArgs && args.length > 0) {
          const sanitizedArgs = args.map(arg => sanitizeObject(arg))
          span.setAttribute('input.args', JSON.stringify(sanitizedArgs))
        }

        const result = originalMethod.apply(context, args)

        // Handle case where sync method returns a Promise
        if (result && typeof result.then === 'function') {
          console.warn(`Method ${spanName} appears to return a Promise but was not detected as async. Consider using async/await.`)
        }

        span.setAttributes({ 'operation.success': true })

        if (options.captureResult && result !== undefined && result !== null) {
          const sanitizedResult = sanitizeObject(result)
          span.setAttribute('output.result', JSON.stringify(sanitizedResult))
        }

        if (options.events) {
          for (const event of options.events) {
            span.addEvent(event)
          }
        }

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
  ) as T
}

export function Span(optionsOrFn: TraceOptionsOrFunction = {}) {
  return (target: unknown, propertyName: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value
    const spanName = `${(target as object).constructor.name}.${propertyName}`

    if (typeof originalMethod !== 'function') {
      throw new Error(`@Span can only be applied to methods. ${propertyName} is not a function.`)
    }

    const isAsync = isAsyncFunction(originalMethod)

    if (isAsync) {
      descriptor.value = async function (...args: unknown[]) {
        return await executeWithSpan(originalMethod, this, args, spanName, optionsOrFn, true)
      }
    } else {
      descriptor.value = function (...args: unknown[]) {
        return executeWithSpan(originalMethod, this, args, spanName, optionsOrFn, false)
      }
    }

    return descriptor
  }
}

function isSensitiveField(fieldName: string): boolean {
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization', 'cookie', 'session', 'credential', 'private', 'auth']
  return sensitiveFields.some(sensitive => fieldName.toLowerCase().includes(sensitive))
}

function sanitizeObject(obj: unknown, maxDepth = 3, currentDepth = 0): unknown {
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
