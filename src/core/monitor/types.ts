/**
 * @fileoverview Monitor 类型定义
 * 
 * @module core/monitor/types
 */

/**
 * Track 状态类型
 * 
 * @description 表示调用追踪对象的状态：pending（等待中）、fulfilled（成功）、rejected（失败）
 */
export type TrackState = 'pending' | 'fulfilled' | 'rejected'

/**
 * Track 查询状态类型
 * 
 * @description 用于查询 Track 状态，包括 'finished'（已完成，无论是成功还是失败）
 */
export type TrackQueryState = TrackState | 'finished'

/**
 * 调用追踪对象
 * 
 * @description 表示单次函数调用的追踪信息，包含调用序号、状态和关联数据。
 * 用于处理竟态条件，确保只有最新调用的状态才会更新到最终结果。
 */
export type InternalTrack = {
  /** 调用序号，唯一标识每次调用 */
  readonly sn: number

  /** 检查当前是否处于指定状态 */
  is: (state?: TrackQueryState) => boolean

  /** 标记为成功 */
  fulfill: () => void
  /** 标记为失败 */
  reject: () => void

  /** 存储关联数据（使用 Symbol 作为键） */
  setData: (key: symbol, value?: any) => void
  /** 获取关联数据 */
  getData: <V = any>(key: symbol) => V | undefined
}

/**
 * 调用追踪器
 * 
 * @description 管理所有函数调用的追踪状态，提供创建追踪对象的能力。
 */
export type Tracker = {
  /** 创建新的调用追踪对象 */
  track: () => InternalTrack
}

export type Track = Pick<InternalTrack, 
  'sn' | 
  'is' |
  'getData' | 'setData'
> & {
  // takeData 由 monitor 实现，不在 tracker 的 Track 类型中
  takeData: <V = any>(key: symbol) => V | undefined
}

/**
 * 函数监控器事件映射
 * 
 * @description 定义了所有可监听的事件类型及其数据结构。
 */
export type FunctionMonitorEventMap = {
  /** 函数调用初始化事件，用于准备上下文 */
  'init': { args: any[], track: Track }
  /** 函数执行前事件，用于观察逻辑。注：enhance-arguments 发生在 before 后 */
  'before': { args: any[], track: Track }
  /** 函数执行后事件（同步部分完成） */
  'after': { track: Track }
  /** 函数成功完成事件 */
  'fulfill': { track: Track, value: any }
  /** 函数执行失败事件 */
  'reject': { track: Track, error: any }
  /** track 数据变化事件，当 track 的 setData 触发更新时转发 */
  'track:updated': { track: Track }
}

/**
 * 事件处理函数类型
 * 
 * @template T - 事件类型
 */
export type EventHandler<T extends keyof FunctionMonitorEventMap> = (
  event: FunctionMonitorEventMap[T]
) => void

/**
 * 基础函数监控器接口
 * 
 * @description 提供函数执行生命周期的事件发布订阅机制。
 * 支持监听 init、before、after、fulfill、reject 等事件。
 */
export interface InternalFunctionMonitor {
  /**
   * @deprecated 该 API 仅用于内部兼容功能（如已废弃的 enhanceFirstArgument），外部调用无效
   * @internal 该 API 仅用于内部兼容功能（如已废弃的 enhanceFirstArgument），外部调用无效
   * 
   * 设置参数增强拦截器
   * 
   * @description 这是一个特殊的拦截器机制，用于在函数执行前转换参数。
   * 执行顺序：init → before → enhance-arguments → after → fulfill/reject
   * 覆盖逻辑：只能设置一个拦截器，后设置的会覆盖先设置的
   * 
   * @param event - 事件类型，固定为 'enhance-arguments'
   * @param handler - 拦截器函数，接收参数和 track，返回转换后的参数数组或 void
   */
  use(event: 'enhance-arguments', handler: (data: { args: any[], track: Track }) => any[] | void): void
  
  /**
   * 获取参数增强拦截器
   * 
   * @internal 该 API 仅用于内部兼容功能，不对外暴露。
   * 
   * @param event - 事件类型，固定为 'enhance-arguments'
   * 
   * @returns 返回当前设置的拦截器函数，如果未设置则返回 undefined
   */
  get(event: 'enhance-arguments'): ((data: { args: any[], track: Track }) => any[] | void) | undefined
  
  /**
   * 注册事件监听器
   * 
   * @template T - 事件类型
   * 
   * @param event - 事件类型
   * @param handler - 事件处理函数
   */
  on<T extends keyof FunctionMonitorEventMap>(
    event: T,
    handler: EventHandler<T>
  ): void
  
  /**
   * 移除事件监听器
   * 
   * @template T - 事件类型
   * 
   * @param event - 事件类型
   * @param handler - 要移除的事件处理函数
   */
  off<T extends keyof FunctionMonitorEventMap>(
    event: T,
    handler: EventHandler<T>
  ): void
  
  /**
   * 触发事件
   * 
   * @param event - 事件类型
   * @param data - 事件数据
   */
  emit(event: 'init', data: FunctionMonitorEventMap['init']): void
  emit(event: 'before', data: FunctionMonitorEventMap['before']): void
  emit(event: 'fulfill', data: FunctionMonitorEventMap['fulfill']): void
  emit(event: 'reject', data: FunctionMonitorEventMap['reject']): void
  emit(event: 'after', data: FunctionMonitorEventMap['after']): void
  emit(event: 'track:updated', data: FunctionMonitorEventMap['track:updated']): void
}

/**
 * 函数监控器接口
 * 
 * @description 提供函数执行生命周期的事件监控能力。
 */
export type FunctionMonitor = Pick<InternalFunctionMonitor, 'on' | 'off'>
