export type StringDefaultWhenEmpty<S extends string, D extends string> = S extends '' ? D : S
export { upperFirst } from './utils.base'
export { createFunctionTracker } from './utils.tracker'
export type { Track, Tracker } from './utils.tracker'