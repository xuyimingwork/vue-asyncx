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
function create<TFn, TPlugins extends any[]>(config: {
  fn: TFn;
  plugins: { [K in keyof TPlugins]: MyPlugin<TFn, TPlugins[K]> };
}): UnionToIntersection<TPlugins[number]> {
  const { fn, plugins } = config;
  
  // Implementation logic to merge plugin results
  return plugins.reduce((acc, plugin) => {
    return { ...acc, ...plugin({ fn }) };
  }, {} as any);
}

// Definitions (using generic P to allow inference)
const withRefresh = <T>({ fn }: { fn: T }) => ({ 
  refresh: fn as T
});
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
  plugins: [withRefresh, withAbc] 
});

// Case 2: res2 is { refresh: () => boolean } & { abc: number }
const fn2 = (): boolean => true
const res2 = create({ 
  fn: fn2, 
  plugins: [withRefresh, withAbc] 
});

console.log(res1.refresh()); // returns 1 (number)
console.log(res2.refresh()); // returns true (boolean)

// can we introduce a definePlugin function
// make withRefresh to const withRefresh = definePlugin(({ fn }) => ({ refresh: fn }))
// reduce type define in withRefresh
// and keep the rest & function the same
// notice in current situation, withRefresh's type T will be auto assign type of fn pass to create
