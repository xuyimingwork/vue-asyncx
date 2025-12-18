export type StringDefaultWhenEmpty<S extends string, D extends string> = S extends '' ? D : S
export type UpperFirst<S extends string> =
  S extends `${infer F}${infer R}`
    ? `${Uppercase<F>}${R}`
    : S;
export type Simplify<T> = {[KeyType in keyof T]: T[KeyType]} & {};
export type Fn = (...args: any[]) => any;
export type Merge<A, B> = Omit<A, keyof B> & B;
export type ObjectShape<T> =
  T extends object
    ? (T extends Function ? {} : T)
    : {};
export type MergeReturnTypes<
  Fns extends readonly Fn[],
  Acc = {}
> = Simplify<Fns extends readonly [infer F, ...infer Rest]
  ? F extends Fn
    ? MergeReturnTypes<
          Rest extends readonly Fn[] ? Rest : [],
          Merge<Acc, ObjectShape<ReturnType<F>>>
        >
      : Acc
  : Acc>;

export function upperFirst<Name extends string>(string: Name): UpperFirst<Name> {
  if (!string) return '' as any

  const chr = string[0]
  const trailing = string.slice(1)

  return chr.toUpperCase() + trailing as any
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

export function runFunctions<const Fns extends readonly (() => any)[]>(fns: Fns): MergeReturnTypes<Fns> {
  return fns.reduce((acc, fn) => {
    return { ...acc, ...fn() }
  }, {})
}