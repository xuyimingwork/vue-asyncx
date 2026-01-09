import { getFunction } from "../utils/base"

export function useSetup<
  Fn extends (...args: any) => any,
>(fn: Fn, options?: any): Fn {
  return getFunction(
    options?.setup, [fn], fn, 
    'Run options.setup failed, fallback to default behavior.'
  )
}

