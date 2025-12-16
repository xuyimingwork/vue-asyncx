export type StringDefaultWhenEmpty<S extends string, D extends string> = S extends '' ? D : S
export type Simplify<T> = {[KeyType in keyof T]: T[KeyType]} & {};

export function upperFirst(string: string): string {
  if (!string) return ''

  const chr = string[0]
  const trailing = string.slice(1)

  return chr.toUpperCase() + trailing
}

export function max(...args: number[]): number | undefined {
  if (!args.length) return undefined
  return args.reduce((max, v) => v > max ? v : max, args[0])
}

function _message(message: string): string {
  return `[vue-asyncx]: ${message}`
}

export { _message as message }

export function warn(message: string, ...rest: any[]) {
  console.warn(_message(message), ...rest);
}

export function getFunction(creator: any, args: any[], fallback: (...args: any) => any, error: string) {
  if (typeof creator !== 'function') return fallback
  try {
    const result = creator(...args)
    return typeof result === 'function' ? result : fallback
  } catch(e) {
    warn(error, e)
    return fallback
  }
}