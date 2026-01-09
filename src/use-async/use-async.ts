import { parseArguments } from "../shared/function"
import { setupFunctionPipeline } from "../pipeline/setup-function-pipeline"
import { withAddonLoading } from "../addons/loading"
import { withAddonArguments } from "../addons/arguments"
import { withAddonError } from "../addons/error"
import { withAddonFunction } from "../addons/function"
import { withAddonWatch } from "../addons/watch"
import { toNamedAddons } from "../addons/utils"
import type { UseAsync } from './types'

export const useAsync: UseAsync = (...args) => {
  const { name = 'method', fn, options } = parseArguments(args)
  return setupFunctionPipeline({
    fn,
    options,
    addons: [
      ...toNamedAddons(name, [
        withAddonLoading(),
        withAddonError(),
        withAddonArguments(),
        withAddonFunction(),
        withAddonWatch(options)
      ]),
      ...(options?.addons || [])
    ] as any
  }) as any
}

export { useAsync as useAsyncFunction }

