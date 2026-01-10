import { upperFirst } from "@/utils/base";
import { useAsync } from "@/hooks/use-async/use-async";
import { withAddonData } from "@/addons/data";
import { toNamedAddons } from "@/core/naming";
import { parseArguments } from "@/hooks/shared";
import type { UseAsyncData } from "./types";

export const useAsyncData: UseAsyncData = function useAsyncData(...args: any[]): any {
  const { name = 'data', fn, options } = parseArguments(args)
  const queryName = `query${upperFirst(name) }` as const
  return useAsync(queryName, fn, {
    ...options,
    addons: toNamedAddons(name, [
      withAddonData({
        ...options,
        type: 'data'
      })
    ])
  })
}


export { unFirstArgumentEnhanced, getAsyncDataContext } from '@/addons/data'

