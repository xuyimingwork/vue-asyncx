import { withAddonArguments } from "../addons/arguments";
import { withAddonLoading } from "../addons/loading";
import { toNamedAddon, toNamedAddons } from "../addons/utils";
import { useSetup } from "../shared/function";
import { withFunctionMonitor } from "../utils";
import { message } from "../utils/base";
import { SetupFunctionPipeline } from "./types";

const setupFunctionPipeline: SetupFunctionPipeline = (options) => {
  const { fn, addons } = options
  const { run, monitor } = withFunctionMonitor(fn)
  const { states, postAddons } = addons.reduce((acc, addon) => {
    if (typeof addon !== 'function') return acc
    const result = addon({ monitor, _types: undefined })
    if (typeof result === 'function') {
      acc.postAddons.push(result)
      return acc
    }
    acc.states = mergeAddonResults(acc.states, result)
    return acc
  }, { states: {}, postAddons: [] })
  const method = useSetup(run, options.options)
  if (!postAddons.length) return states as any
  return postAddons.reduce((acc, addon) => {
    const result = addon({ method })
    return mergeAddonResults(acc, result)
  }, states)
}

export { setupFunctionPipeline }

function mergeAddonResults(base: any, patch: any): any {
  if (typeof patch !== 'object' || !patch) return base
  if (!Object.keys(patch).length) return base
  const duplicates = getDuplicateKeys(base, patch)
  if (duplicates.length) throw Error(message(`Addon has duplicate keys: ${duplicates.join(',')}`))
  return { ...base, ...patch }
}

function getDuplicateKeys(obj1: object, obj2: object): string[] {
  return Object.keys(obj2).filter(key => key in obj1)
}