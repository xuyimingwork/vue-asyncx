/**
 * @fileoverview 事件总线系统
 * 
 * 该模块提供通用的事件发布订阅机制，用于在 monitor 和 track 之间复用事件逻辑。
 * 
 * @module core/eventbus
 */

/**
 * 事件总线接口
 * 
 * @template EventMap - 事件类型映射，键为事件名称，值为事件数据类型
 * 
 * @description 提供类型安全的事件发布订阅机制。
 */
export type EventBus<EventMap extends Record<string, any>> = {
  /**
   * 注册事件监听器
   * 
   * @template T - 事件类型
   * 
   * @param event - 事件类型
   * @param handler - 事件处理函数
   */
  on<T extends keyof EventMap>(
    event: T,
    handler: (data: EventMap[T]) => void
  ): void
  
  /**
   * 移除事件监听器
   * 
   * @template T - 事件类型
   * 
   * @param event - 事件类型
   * @param handler - 要移除的事件处理函数
   */
  off<T extends keyof EventMap>(
    event: T,
    handler: (data: EventMap[T]) => void
  ): void
  
  /**
   * 触发事件
   * 
   * @template T - 事件类型
   * 
   * @param event - 事件类型
   * @param data - 事件数据
   */
  emit<T extends keyof EventMap>(
    event: T,
    data: EventMap[T]
  ): void
}

/**
 * 创建事件总线实例
 * 
 * @description 创建一个新的事件总线实例，支持类型安全的事件发布订阅机制。
 * 使用 Map 和 Set 管理事件处理器，支持多个监听器。
 * 
 * @template EventMap - 事件类型映射，键为事件名称，值为事件数据类型
 * 
 * @returns 返回事件总线实例
 * 
 * @example
 * ```ts
 * type MyEventMap = {
 *   'user:login': { userId: string }
 *   'user:logout': { userId: string }
 * }
 * 
 * const bus = createEventBus<MyEventMap>()
 * 
 * bus.on('user:login', ({ userId }) => {
 *   console.log('User logged in:', userId)
 * })
 * 
 * bus.emit('user:login', { userId: '123' })
 * ```
 */
export function createEventBus<EventMap extends Record<string, any>>(): EventBus<EventMap> {
  // 使用 Map 存储每个事件类型的处理器集合
  const handlers = new Map<keyof EventMap, Set<(data: EventMap[keyof EventMap]) => void>>()
  
  return {
    on<T extends keyof EventMap>(event: T, handler: (data: EventMap[T]) => void): void {
      // 如果事件类型不存在，创建新的 Set
      const set = handlers.get(event) || new Set()
      handlers.set(event, set)
      // 添加处理器到 Set
      set.add(handler as any)
    },
    
    off<T extends keyof EventMap>(event: T, handler: (data: EventMap[T]) => void): void {
      // 从 Set 中移除处理器
      handlers.get(event)?.delete(handler as any)
    },
    
    emit<T extends keyof EventMap>(event: T, data: EventMap[T]): void {
      // 触发所有注册的处理器
      handlers.get(event)?.forEach(h => h(data))
    }
  }
}
