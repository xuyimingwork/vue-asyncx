import { withRefresh, withRefreshFactory } from "./rfc3.2.1-plugins";

// 1. Define the shape of a Plugin
type MyPlugin<TFn, TResult> = (args: { fn: TFn }) => TResult;

// 2. Helper to merge an array of objects into one (Intersection)
// This converts [A, B, C] into A & B & C
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;

// 3. The Create Function
// 3.1. The Create Function using Homomorphic Mapped Type
function create<TFn, TResults extends any[]>(config: {
  fn: TFn;
  plugins: { [K in keyof TResults]: MyPlugin<TFn, TResults[K]> };
}): UnionToIntersection<TResults[number]> {
  const { fn, plugins } = config;
  
  // Implementation logic to merge plugin results
  return plugins.reduce((acc, plugin) => {
    return { ...acc, ...plugin({ fn }) };
  }, {} as any);
}
// 3.2. The Create Function using NoInfer, not work
// function create<TFn, const Pns extends readonly MyPlugin<NoInfer<TFn>, any>[]>(config: {
//   fn: TFn;      // TFn is inferred exclusively from here
//   plugins: Pns; // This site is used only for validation, not for guessing TFn
// }): UnionToIntersection<
//   Pns[number] extends (...args: any[]) => infer R 
//     ? R 
//     : never
// > {
//   const { fn, plugins } = config;
  
//   return plugins.reduce((acc, plugin) => {
//     return { ...acc, ...plugin({ fn }) };
//   }, {} as any);
// }

// Definitions (using generic P to allow inference)
// 这里是利用参数反向赋值泛型？
// function withRefresh<T>(params: { fn: T }): { refresh: T } {
//   return { 
//     refresh: params.fn
//   }
// };
// use definePlugin without type
// type AnyPlugin = <TFn>(args: { fn: TFn }) => any;
// function definePlugin<P extends AnyPlugin>(plugin: P): P {
//   return plugin;
// }
// const withRefresh = definePlugin(
//   ({ fn }) => ({
//     refresh: fn
//   })
// )
const withAbc = () => ({ 
  abc: 1 
});
// Case 1: res1 is { refresh: () => number } & { abc: number }
const fn1 = (): number => 1
const res1 = create({ 
  fn: fn1, 
  plugins: [
    // withRefresh, 
    withRefreshFactory(), 
    withAbc
  ] 
});

// Case 2: res2 is { refresh: () => boolean } & { abc: number }
const fn2 = (): boolean => true
const res2 = create({ 
  fn: fn2, 
  plugins: [withRefresh, withAbc]
});

console.log(res1.refresh()); // returns 1 (number)
console.log(res2.refresh()); // returns true (boolean)

