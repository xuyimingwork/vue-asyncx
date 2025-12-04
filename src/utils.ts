export type StringDefaultWhenEmpty<S extends string, D extends string> = S extends '' ? D : S

export function upperFirst(string: string): string {
  if (!string) return ''

  const chr = string[0]
  const trailing = string.slice(1)

  return chr.toUpperCase() + trailing
}

export { createFunctionTracker } from './utils.tracker'
export type { Track, Tracker } from './utils.tracker'