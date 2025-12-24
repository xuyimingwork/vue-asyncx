import { FunctionMonitorWithTracker, withFunctionMonitor } from "../utils";
import { Fn, MergeReturnTypes, runFunctions } from "../utils/base";
import { useSetup } from "./function";

export type StateCreator = (params: { monitor: FunctionMonitorWithTracker }) => any
export type StateCreatorParams = Parameters<StateCreator>[0]
export type BoostCreator<Fn> = (params: { method: Fn, monitor: FunctionMonitorWithTracker }) => any

export type CorePlugin<Fn> = { 
  state?: StateCreator, 
  boost?: BoostCreator<Fn>
}

type ExtractFns<
  Plugins extends readonly CorePlugin<any>[], 
  Key extends keyof CorePlugin<any>
> = Plugins extends readonly [infer P, ...infer Rest]
  ? P extends CorePlugin<any>
    ? P[Key] extends Fn
      ? [P[Key], ...ExtractFns<Rest extends readonly CorePlugin<any>[] ? Rest : [], Key>]
      : ExtractFns<Rest extends readonly CorePlugin<any>[] ? Rest : [], Key>
    : []
  : [];

export function useCore<
  Fn extends (...args: any) => any,
  Options,
  const CorePlugins extends readonly CorePlugin<Fn>[],
>({
  fn,
  options,
  plugins,
}: {
  fn: Fn,
  options?: Options,
  plugins: CorePlugins,
}): MergeReturnTypes<readonly [
  ...ExtractFns<CorePlugins, 'state'>, 
  ...ExtractFns<CorePlugins, 'boost'>
]> {
  const { run, monitor } = withFunctionMonitor(fn)
  const stateCreators = plugins.map(plugin => plugin.state).filter(creator => !!creator)
  const states = runFunctions(stateCreators.map((creator) => () => creator({
    monitor
  })))
  const method = useSetup(run, options)
  const boostCreators = plugins.map(plugin => plugin.boost).filter(creator => !!creator)
  const boosts = runFunctions(boostCreators.map((creator) => () => creator({
    method, monitor
  })))
  return { 
    ...states, 
    ...boosts 
  } as any
}