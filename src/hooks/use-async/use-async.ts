import { withAddonArguments } from "@/addons/arguments"
import { withAddonError } from "@/addons/error"
import { withAddonFunction } from "@/addons/function"
import { withAddonLoading } from "@/addons/loading"
import { withAddonWatch } from "@/addons/watch"
import { toNamedAddons } from "@/core/naming"
import { setupFunctionPipeline } from "@/core/setup-pipeline"
import { parseArguments } from "@/hooks/shared"
import type { UseAsync } from './types'

export const useAsync: UseAsync = (...args) => {
  const { name = 'method', fn, options } = parseArguments(args)
  return setupFunctionPipeline({
    fn,
    options,
    addons: toNamedAddons(name, [
      withAddonLoading(),
      withAddonError(),
      withAddonArguments(),
      withAddonFunction(),
      ...(options?.addons || []),
      withAddonWatch(options)
    ]) as any
  }) as any
}

export { useAsync as useAsyncFunction }

