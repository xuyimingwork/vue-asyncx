import { createTracker, Track, Tracker } from "./tracker"

export type FunctionMonitorEventMap = {
  'before': { args: any[], track: Track }
  'fulfill': { track: Track, value: any }
  'reject': { track: Track, error: any }
  'after': { track: Track }
}

type EventHandler<T extends keyof FunctionMonitorEventMap> = (
  event: FunctionMonitorEventMap[T]
) => void

export interface FunctionMonitor {
  use(event: 'enhance-arguments', handler: (data: { args: any[], track: Track }) => any[] | void): void
  get(event: 'enhance-arguments'): ((data: { args: any[], track: Track }) => any[] | void) | undefined
  on<T extends keyof FunctionMonitorEventMap>(
    event: T,
    handler: EventHandler<T>
  ): void
  off<T extends keyof FunctionMonitorEventMap>(
    event: T,
    handler: EventHandler<T>
  ): void
  emit(event: 'before', data: FunctionMonitorEventMap['before']): void
  emit(event: 'fulfill', data: FunctionMonitorEventMap['fulfill']): void
  emit(event: 'reject', data: FunctionMonitorEventMap['reject']): void
  emit(event: 'after', data: FunctionMonitorEventMap['after']): void
}

export interface FunctionMonitorWithTracker extends FunctionMonitor {
  has: {
    finished: Tracker['has']['finished']
  }
}

export function createFunctionMonitor(): FunctionMonitor {
  const handlers = new Map<keyof FunctionMonitorEventMap, Set<EventHandler<any>>>()
  let enhanceArgumentsInterceptor: ((data: { args: any[], track: Track }) => any[] | void) | undefined

  const monitor: FunctionMonitor = {
    use(event: 'enhance-arguments', handler: any): void {
      if (event === 'enhance-arguments') return enhanceArgumentsInterceptor = handler
    },
    get(event: 'enhance-arguments'): any {
      if (event === 'enhance-arguments') return enhanceArgumentsInterceptor
    },
    on<T extends keyof FunctionMonitorEventMap>(event: T, handler: EventHandler<T>) {
      const set = handlers.get(event)
      if (!set) handlers.set(event, new Set())
      handlers.get(event).add(handler)
    },
    off<T extends keyof FunctionMonitorEventMap>(event: T, handler: EventHandler<T>) {
      handlers.get(event)?.delete(handler)
    },
    emit<T extends keyof FunctionMonitorEventMap>(
      event: T,
      data: FunctionMonitorEventMap[T]
    ): void {
      handlers.get(event)?.forEach(h => h(data))
    }
  }

  return monitor
}

function runInterceptor(interceptor?: () => any, fallback?: any) {
  if (typeof interceptor !== 'function') return fallback
  const result = interceptor()
  if (result === undefined) return fallback
  return result
}

export function withFunctionMonitor<Fn extends (...args: any) => any>(
  fn: Fn
): {
  run: Fn
  monitor: FunctionMonitorWithTracker
} {
  const tracker = createTracker()
  const monitor = createFunctionMonitor() as FunctionMonitorWithTracker
  
  // Setup delegate to tracker.has.finished
  monitor.has = {
    finished: tracker.has.finished
  }

  const run = ((...args: Parameters<Fn>): ReturnType<Fn> => {
    const track = tracker.track()

    // Emit before event
    monitor.emit('before', { args, track })

    // Call enhance-arguments interceptor to transform args
    // const enhanceArgumentsInterceptor = 
    const transformedArgs: Parameters<Fn> = runInterceptor(
      monitor.get('enhance-arguments') && (() => {
        const result = monitor.get('enhance-arguments')({ args, track })
        return Array.isArray(result) ? result : undefined
      }),
      args
    )

    try {
      const result = fn(...transformedArgs)
      
      // Emit after event right after function call, before finish
      monitor.emit('after', { track })
      
      if (result instanceof Promise) {
        result.then(
          (value) => {
            track.fulfill()
            monitor.emit('fulfill', { track, value })
          },
          (error) => {
            track.reject()
            monitor.emit('reject', { track, error })
          }
        )
      } else {
        track.fulfill()
        monitor.emit('fulfill', { track, value: result })
      }
      
      return result
    } catch (e) {
      // Emit after event in catch block, before reject
      monitor.emit('after', { track })
      track.reject()
      monitor.emit('reject', { track, error: e })
      throw e
    }
  }) as Fn

  return { run, monitor }
}

