import { FunctionMonitorWithTracker, withFunctionMonitor } from "../utils";
import { MergeReturnTypes, runFunctions } from "../utils/base";
import { useSetup } from "./function";

export type StateCreator = (params: { monitor: FunctionMonitorWithTracker }) => any
export type StateCreatorParams = Parameters<StateCreator>[0]
export type BoostCreator<Fn> = (params: { method: Fn, monitor: FunctionMonitorWithTracker }) => any

export function useCore<
  Fn extends (...args: any) => any,
  Options,
  const StateCreators extends readonly StateCreator[],
  const BoostCreators extends readonly BoostCreator<Fn>[]
>({
  fn,
  options,
  stateCreators,
  boostCreators,
}: {
  fn: Fn,
  options?: Options,
  stateCreators: StateCreators, 
  boostCreators: BoostCreators
}): MergeReturnTypes<readonly [...StateCreators, ...BoostCreators]> {
  const { run, monitor } = withFunctionMonitor(fn)
  const states = runFunctions(stateCreators.map((creator) => () => creator({
    monitor
  })))
  const method = useSetup(run, options)
  const boosts = runFunctions(boostCreators.map((creator) => () => creator({
    method, monitor
  })))
  return { 
    ...states, 
    ...boosts 
  } as any
}