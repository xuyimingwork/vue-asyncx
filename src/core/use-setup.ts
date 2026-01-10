import { getFunction } from "@/utils/base"
import { BaseFunction } from "@/utils/types"

export function useSetup<
  Fn extends BaseFunction,
>(fn: Fn, options?: any): Fn {
  return getFunction(
    options?.setup, [fn], fn, 
    'Run options.setup failed, fallback to default behavior.'
  )
}

