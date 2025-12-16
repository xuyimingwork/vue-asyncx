export type StringDefaultWhenEmpty<S extends string, D extends string> = S extends '' ? D : S
export type Simplify<T> = {[KeyType in keyof T]: T[KeyType]} & {};
export { upperFirst } from './utils.base'
export { createTracker } from './utils.tracker'
export type { Track, Tracker } from './utils.tracker'