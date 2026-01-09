export type StringDefaultWhenEmpty<S extends string, D extends string> = S extends '' ? D : S
export type UpperFirst<S extends string> =
  S extends `${infer F}${infer R}`
    ? `${Uppercase<F>}${R}`
    : S;
export type Simplify<T> = {[K in keyof T]: T[K]} & {};
export type Fn = (...args: any[]) => any;
export type Merge<A, B> = A extends any ? Simplify<Omit<A, keyof B> & B> : never;
export type MergeTypes<Array extends readonly any[], Acc = {}> = Array extends readonly [infer Item, ...infer Rest]
  ? MergeTypes<
      Rest,
      Merge<Acc, ObjectShape<Item>>
    >
  : Acc;
export type ObjectShape<T> = 0 extends (1 & T) ? {} : // ObjectShape<any> => {}
  T extends Function ? {} : // ObjectShape<() => void> => {}
  T extends readonly any[] ? {} : // ObjectShape<any[]> => {}
  T extends object ? T : {} // ObjectShape<null> => {} / ObjectShape<undefined> => {} ...
export type MergeReturnTypes<
  Fns extends readonly Fn[],
  Acc = {}
> = Fns extends readonly [
    infer F extends Fn, 
    ...infer Rest extends readonly Fn[]
  ]
  ? MergeReturnTypes<
      Rest,
      Merge<Acc, ObjectShape<ReturnType<F>>>
    >
  : Acc;
export type IsUnion<T, U = T> = T extends U 
  ? [U] extends [T] 
    ? false 
    : true 
  : never;

export function upperFirst<Name extends string>(string: Name): Capitalize<Name> {
  if (!string) return '' as any

  const chr = string[0]
  const trailing = string.slice(1)

  return chr.toUpperCase() + trailing as any
}

export function lowerFirst<Name extends string>(string: Name): Uncapitalize<Name> {
  if (!string) return '' as any

  const chr = string[0]
  const trailing = string.slice(1)

  return chr.toLowerCase() + trailing as any
}

export function max(...args: number[]): number | undefined {
  if (!args.length) return undefined
  return args.reduce((max, v) => v > max ? v : max, args[0])
}

function _message(message: string): string {
  return `[vue-asyncx]: ${message}`
}

export { _message as message }

export function warn(message: string, ...rest: any[]): void {
  console.warn(_message(message), ...rest);
}

export function getFunction<C, F extends (...args: any[]) => any>(creator: C, args: any[], fallback: F, error: string): 
  C extends (...args: any[]) => infer R 
    ? (R extends (...args: any[]) => any 
      ? R 
      : F) 
    : F {
  if (typeof creator !== 'function') return fallback as any
  try {
    const result = creator(...args)
    return typeof result === 'function' ? result : fallback as any
  } catch(e) {
    warn(error, e)
    return fallback as any
  }
}