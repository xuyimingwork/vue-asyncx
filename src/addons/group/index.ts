import type { AddonTypes } from "@/addons/types"
import type { FunctionMonitor, Track } from "@/core/monitor"
import type { ComputedRef, Ref } from "vue"

import { computed, ref } from "vue"

import { debounce } from "@/utils/base"
import { createGroupState, type Group } from "./state"

const GROUP_KEY = Symbol('vue-asyncx:group:key')

/**
 * Group 类型（基于 Method 类型）
 */
export type GroupType<M extends (...args: any[]) => any> = {
  loading: boolean
  error: any
  arguments: Parameters<M> | undefined
  argumentFirst: Parameters<M>['0'] | undefined
  data: Awaited<ReturnType<M>> | undefined
  dataExpired: boolean
}

/**
 * Groups 类型（内部存储 Ref<Group>，但对外暴露 Group）
 */
type Groups = Record<string | number, Ref<Group>>

/**
 * withAddonGroup 配置
 */
export interface WithAddonGroupConfig {
  /**
   * 根据函数参数生成 group key
   * 
   * @param args - 函数调用参数
   * @returns group key（string 或 number）
   */
  key: (args: any[]) => string | number
  /**
   * 根据函数参数获取请求的 scope
   * 
   * @param args - 函数调用参数
   * @returns scope（string 或 number）
   */
  scope?: (args: any[]) => string | number
  /**
   * scope 自动清理的延迟时间（毫秒）
   * 
   * 当切换 scope 时，会自动清理其他 scope 的 group。此配置控制清理操作的延迟时间。
   * 使用 debounce 机制，在延迟时间内如果再次切换 scope，会重置计时器。
   * 
   * @default 100
   */
  clearAutoDelay?: number
}

/**
 * withAddonGroup addon
 * 
 * @description 用于支持"并行、同源、同语义操作"场景，通过 key 分组管理状态。
 * 
 * 核心特性：
 * - 固定属性：`group[key]` 在被创建后始终包含 `loading`、`error`、`arguments`、`data`
 * - 直接值：`group[key]?.loading` 是 `boolean`，不是 `Ref<boolean>`
 * - 需要使用可选链：`group[key]` 可能为 `undefined`（当该 key 还没有被调用过时）
 * - 自动同步：所有 addon 的 setData 操作自动同步到 group
 * - 竟态处理：只有最新调用的状态才会更新到 group
 * 
 * @param config - 配置对象
 * @param config.key - 根据函数参数生成 group key 的函数
 * @param config.scope - 根据函数参数获取请求的 scope（可选）
 * @param config.clearAutoDelay - scope 自动清理的延迟时间（毫秒，默认 100）
 * 
 * @returns addon 函数
 * 
 * @example
 * ```ts
 * const { confirm, confirmGroup } = useAsync('confirm', confirmApi, {
 *   addons: [withAddonGroup({ key: (args) => args[0] })]
 * })
 * 
 * // 模板中使用
 * <button 
 *   :loading="confirmGroup[item.id]?.loading" 
 *   @click="confirm(item.id)"
 * >
 *   确认
 * </button>
 * ```
 */
export function withAddonGroup(config: WithAddonGroupConfig): <T extends AddonTypes>(params: { 
  monitor: FunctionMonitor,
  _types: T
}) => {
  __name__Group: ComputedRef<Record<string | number, GroupType<T['Method']>>>
  clear__name__Group: (key?: string | number) => void
} {
  return (({ monitor }: { monitor: FunctionMonitor }) => {
    const { key: getKey, scope: getScope, clearAutoDelay = 100 } = config

    // 内部保存 groups，用于追踪状态
    const groups = ref<Groups>({})
    const updates = new Map<string, (track: Track) => void>()
    const scopes = new Map<string, any>()

    const clear = (key?: string | number) => {
      if (key === undefined) {
        groups.value = {}
        updates.clear()
        scopes.clear()
        return
      }

      key = String(key)
      delete groups.value[key]
      updates.delete(key)
      scopes.delete(key)
    }

    const clearAuto = debounce((scope) => {
      const keys = [...scopes].reduce((acc, [key, groupScope]) => {
        if (scope === groupScope) return acc
        acc.push(key);
        return acc;
      }, []);
      
      keys.forEach(key => clear(key))
    }, clearAutoDelay)

    const setupScope = getScope ? (args: any[], track: Track) => {
      const scope = getScope(args)
      scopes.set(track.getData(GROUP_KEY), scope)
      clearAuto(scope)
    } : () => {}

    // 在 init 事件中存储 key 和 track.sn（提前到 init 阶段，避免时序问题）
    monitor.on('init', ({ args, track }) => {
      const key = String(getKey(args))
      track.setData(GROUP_KEY, key)
      setupScope(args, track)
      if (groups.value[key]) return
      
      const { group, update } = createGroupState()
      groups.value[key] = group as any
      updates.set(key, update)
    })

    // 监听所有 'track:updated' 事件，自动同步到 groups
    monitor.on('track:updated', ({ track }) => {
      const key = track.getData(GROUP_KEY)
      const update = updates.get(key)
      if (!update) return
      update(track)
    })

    return {
      __name__Group: computed(() => groups.value),
      clear__name__Group: clear
    }
  }) as any
}
