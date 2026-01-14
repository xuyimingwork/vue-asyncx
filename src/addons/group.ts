import type { FunctionMonitor } from "@/core/monitor"
import { computed, reactive } from "vue"
import { TRACK_ADDON_ARGUMENTS } from "./arguments"
import { TRACK_ADDON_DATA } from "./data"
import { TRACK_ADDON_ERROR } from "./error"
import { TRACK_ADDON_LOADING } from "./loading"

/**
 * 私有 key：存储 group key（用于 track:data 事件中识别）
 */
const GROUP_KEY = Symbol('vue-asyncx:group:key')

/**
 * 内部 Group 类型（包含 sn）
 */
type InnerGroup = {
  loading: boolean
  error: any
  arguments: any
  data: any
  sn: number
}

/**
 * Group 类型（对外返回，不包含 sn）
 */
type Group = {
  loading: boolean
  error: any
  arguments: any
  data: any
}

/**
 * Groups 类型
 */
type Groups = Record<string | number, InnerGroup>

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
function createDefaultGroupState(): InnerGroup {
  return {
    loading: false,
    error: undefined,
    arguments: undefined,
    data: undefined,
    sn: 0
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
export function withAddonGroup(config: WithAddonGroupConfig) {
  return (({ monitor }: { monitor: FunctionMonitor }) => {
    const { by } = config
    
    // 内部保存 groups，用于追踪状态
    const groups = reactive<Groups>({})
    
    /**
     * 统一更新 group 状态
     * 
     * @param key - group key
     * @param updates - 要更新的状态（包含 sn 和可选的属性值）
     * @description 如果 updates.sn 大于当前 sn，则直接 assign 所有更新
     */
    function updateGroup(key: string | number, updates: Partial<InnerGroup> & { sn: number }): void {
      // 初始化状态（如果不存在）
      if (!groups[key]) {
        groups[key] = createDefaultGroupState()
      }
      
      const currentSn = groups[key].sn
      // 如果 sn 更小，直接返回
      if (updates.sn < currentSn) return
      
      // 如果 sn 大于等于当前 sn，直接赋值
      groups[key] = { ...groups[key], ...updates }
    }
    
    // 在 init 事件中存储 key 和 track.sn（提前到 init 阶段，避免时序问题）
    monitor.on('init', ({ args, track }) => {
      const key = by(args)
      
      // 存储 group key 到 track 中（供 track:data 事件使用）
      track.setData(GROUP_KEY, key)
      
      // 更新 sn
      updateGroup(key, { sn: track.sn })
    })
    
    // 共享 key 到 property 的映射
    const keyToPropertyMap = new Map<symbol, 'loading' | 'error' | 'arguments' | 'data'>([
      [TRACK_ADDON_LOADING, 'loading'],
      [TRACK_ADDON_ERROR, 'error'],
      [TRACK_ADDON_ARGUMENTS, 'arguments'],
      [TRACK_ADDON_DATA, 'data']
    ])
    
    // 监听所有 'track:data' 事件，自动同步到 groups
    // 注意：只监听共享 keys，私有 keys 不会触发事件
    monitor.on('track:data', ({ track, key, value }) => {
      const groupKey = track.getData<string | number>(GROUP_KEY)
      if (groupKey === undefined) return
      
      const property = keyToPropertyMap.get(key)
      if (!property) return
      
      updateGroup(groupKey, {
        sn: track.sn,
        [property]: value
      })
    })
    
    // 创建 computed，返回 Proxy
    const groupComputed = computed(() => {
      return new Proxy({} as Record<string | number, Group>, {
        get(target, p: string | symbol) {
          // 过滤掉 symbol，只处理 string | number
          if (typeof p === 'symbol') return undefined
          const key = p as string | number
          
          // 解构排除 sn，如果没有则使用默认值
          const { sn, ...group } = groups[key] || createDefaultGroupState()
          return group
        }
      })
    })
    
    return { __name__Group: groupComputed }
  }) as any
}
