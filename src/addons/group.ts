import { defineStateData } from "@/addons/data/state"
import { AddonTypes } from "@/addons/types"
import type { FunctionMonitor, Track } from "@/core/monitor"
import type { ComputedRef } from "vue"
import { computed, reactive, ref } from "vue"
import { defineStateArguments } from "./arguments"
import { defineStateError } from "./error"
import { defineStateLoading } from "./loading"

const GROUP_UPDATE_HANDLER = Symbol('vue-asyncx:group:update-handler')

/**
 * 内部 Group 类型
 */
type Group = {
  loading: boolean
  error: any
  arguments: any
  argumentFirst: any
  data: any
  dataExpired: any
}

/**
 * Group 类型（基于 Method 类型）
 */
type GroupType<M extends (...args: any[]) => any> = {
  loading: boolean
  error: any
  arguments: Parameters<M> | undefined
  argumentFirst: Parameters<M>['0'] | undefined
  data: Awaited<ReturnType<M>> | undefined
  dataExpired: boolean
}

/**
 * Groups 类型
 */
type Groups = Record<string | number, Group>

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
  by: (args: any[]) => string | number
}

/**
 * 创建默认的 group 状态对象
 * 
 * @returns 默认状态对象
 */
function createDefaultGroupState(): Group {
  return {
    loading: false,
    error: undefined,
    arguments: undefined,
    argumentFirst: undefined,
    data: undefined,
    dataExpired: false
  }
}

/**
 * withAddonGroup addon
 * 
 * @description 用于支持"并行、同源、同语义操作"场景，通过 key 分组管理状态。
 * 
 * 核心特性：
 * - 不使用可选链：`group[key].loading` 而不是 `group[key]?.loading`
 * - 固定属性：`group[key]` 始终包含 `loading`、`error`、`arguments`、`data`
 * - 直接值：`group[key].loading` 是 `boolean`，不是 `Ref<boolean>`
 * - 自动同步：所有 addon 的 setData 操作自动同步到 group
 * - 竟态处理：只有最新调用的状态才会更新到 group
 * 
 * @param config - 配置对象
 * @param config.by - 根据函数参数生成 group key 的函数
 * 
 * @returns addon 函数
 * 
 * @example
 * ```ts
 * const { confirm, confirmGroup } = useAsync('confirm', confirmApi, {
 *   addons: [withAddonGroup({ by: (args) => args[0] })]
 * })
 * 
 * // 模板中使用（不需要可选链）
 * <button 
 *   :loading="confirmGroup[item.id].loading" 
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
} {
  return (({ monitor }: { monitor: FunctionMonitor }) => {
    const DEFAULT_GROUP = createDefaultGroupState()
    const { by } = config

    // 内部保存 groups，用于追踪状态
    const groups = reactive<Groups>({})
    const updates = new Map<string | number, (track: Track) => void>()

    // 在 init 事件中存储 key 和 track.sn（提前到 init 阶段，避免时序问题）
    monitor.on('init', ({ args, track }) => {
      const key = String(by(args))
      if (!groups[key]) {
        const group = ref(createDefaultGroupState())
        const { update: updateLoading } = defineStateLoading({
          set: (v) => group.value.loading = v
        })
        const {
          update: updateArguments,
          argumentFirst
        } = defineStateArguments({
          get: () => group.value.arguments,
          set: (v) => group.value.arguments = v
        })
        group.value.argumentFirst = argumentFirst
        const { update: updateError } = defineStateError({
          set: (v) => group.value.error = v
        })
        const {
          update: updateData,
          dataExpired
        } = defineStateData({
          set: (v) => group.value.data = v
        })
        group.value.dataExpired = dataExpired
        groups[key] = group as any
        updates.set(key, (track) => {
          updateArguments(track)
          updateLoading(track)
          updateError(track)
          updateData(track)
        })
      }
      track.setData(GROUP_UPDATE_HANDLER, updates.get(key))
    })

    // 监听所有 'track:updated' 事件，自动同步到 groups
    monitor.on('track:updated', ({ track }) => {
      const update = track.getData(GROUP_UPDATE_HANDLER)
      update(track)
    })

    return {
      __name__Group: computed(() => new Proxy({} as Record<string | number, Group>, {
        get(target, p: string | symbol) {
          // 过滤掉 symbol，只处理 string | number
          if (typeof p === 'symbol') return undefined
          const key = p as string | number
          return groups[key] || DEFAULT_GROUP
        }
      })) as ComputedRef<Record<string | number, GroupType<any>>>
    }
  }) as any
}
