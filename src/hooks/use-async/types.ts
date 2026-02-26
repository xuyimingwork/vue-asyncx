import type { Addons, MergeAddonResults } from '@/addons/types';
import type { BaseFunction, CamelReplaceKeys, NonEmptyString, Simplify } from "@/utils/types";
import type { ComputedRef, Ref, WatchCallback, WatchOptions, WatchSource } from 'vue';

type UseAsyncNameDefault = 'method'

/**
 * useAsync 返回值类型
 *
 * @description
 * 根据传入的 name 动态生成属性名。
 *
 * 命名映射规则（name 采用小驼峰，如 'confirm'）：
 * - `{name}` → 包装后的异步函数
 * - `{name}Loading` → 加载状态
 * - `{name}Arguments` → 最近一次调用的参数列表
 * - `{name}ArgumentFirst` → 参数列表的首个值
 * - `{name}Error` → 执行时的异常
 *
 * @template Fn - 异步函数类型
 * @template Name - 名称，默认 'method'
 * @template AddonResults - 插件扩展的返回值
 */
export type UseAsyncResult<
  Fn extends BaseFunction, 
  Name extends string,
  AddonResults extends any[] = any[]
> = Simplify<{
  [K in NonEmptyString<Name, UseAsyncNameDefault>]: Fn
} & {
  [K in `${NonEmptyString<Name, UseAsyncNameDefault>}Loading`]: Ref<boolean>
} & {
  [K in `${NonEmptyString<Name, UseAsyncNameDefault>}Arguments`]: ComputedRef<Parameters<Fn>>
} & {
  [K in `${NonEmptyString<Name, UseAsyncNameDefault>}ArgumentFirst`]: ComputedRef<Parameters<Fn>['0']>
} & {
  [K in `${NonEmptyString<Name, UseAsyncNameDefault>}Error`]: Ref<any>
} & CamelReplaceKeys<MergeAddonResults<AddonResults>, Name>>

/**
 * watch 配置选项
 *
 * @extends WatchOptions - 继承 Vue watch 的全部配置（immediate、deep、flush、once 等）
 */
export interface UseAsyncWatchOptions<Fn extends BaseFunction> extends WatchOptions {
  /** 自定义 watch handler，用于过滤或转换监听源 */
  handlerCreator?: (fn: Fn) => WatchCallback
}

/**
 * useAsync 配置选项
 *
 * @template Fn - 异步函数类型
 * @template Addons - 插件类型
 */
export type UseAsyncOptions<Fn extends BaseFunction, Addons = any> = {
  /** 监听的数据源，变化时执行异步函数。支持 Vue WatchSource 的全部形式 */
  watch?: WatchSource | WatchSource[]
  /** watch 的配置项，如 immediate、deep、handlerCreator 等 */
  watchOptions?: UseAsyncWatchOptions<Fn>
  /** 是否在创建时立即执行一次 */
  immediate?: boolean
  /** 转换最终函数或注册外部监听（如 debounce、事件监听、轮询） */
  setup?: (fn: Fn) => BaseFunction | void
  /** 自定义插件，扩展返回值 */
  addons?: Addons
}

/** useAsync 函数类型 */
export interface UseAsync {
  /**
   * 封装异步函数，提供 loading、error、arguments 等响应式状态。不指定名称时使用默认 'method'。
   *
   * @description
   * 将异步函数包装为可调用的方法，并自动管理其执行状态。返回的函数保持原有签名，
   * 可原样接收参数和返回 Promise。适用于提交、删除、确认等不关心返回数据的场景。
   *
   * @param fn - 要封装的异步函数
   * @param options - 配置选项，支持 immediate、watch、setup 等
   * @returns 默认 name='method'，映射为 method、methodLoading、methodArguments、methodArgumentFirst、methodError
   *
   * @example
   * const { method, methodLoading } = useAsync(() => api.confirm())
   * method()
   *
   * @see {@link useAsyncData} - 需要展示异步返回数据时使用
   * @see {@link UseAsyncOptions} - 完整配置选项
   * @see {@link UseAsyncResult} - 返回值类型定义
   */
  <
    Fn extends BaseFunction, 
    AddonResults extends any[] = any[]
  >(
    fn: Fn, 
    options?: UseAsyncOptions<Fn, Addons<Fn, AddonResults>>
  ): UseAsyncResult<Fn, UseAsyncNameDefault, AddonResults>;
  /**
   * 封装异步函数，提供 loading、error、arguments 等响应式状态。指定名称以自定义函数及关联状态的命名。
   *
   * @remarks 推荐用法。自定义名称可提升代码可读性。
   *
   * @description
   * 将异步函数包装为可调用的方法，并自动管理其执行状态。返回的函数保持原有签名，
   * 可原样接收参数和返回 Promise。适用于提交、删除、确认等不关心返回数据的场景。
   *
   * @param name - 函数及关联状态的名称。命名映射：`{name}`→函数，`{name}Loading`→加载状态，`{name}Arguments`→参数列表，`{name}ArgumentFirst`→首个参数，`{name}Error`→异常
   * @param fn - 要封装的异步函数
   * @param options - 配置选项，支持 immediate、watch、setup 等
   * @returns 根据 name 映射：{name}、{name}Loading、{name}Arguments、{name}ArgumentFirst、{name}Error
   *
   * @example
   * const { confirm, confirmLoading, confirmError } = useAsync('confirm', () => api.confirm())
   * confirm()
   *
   * @example
   * const { submit } = useAsync('submit', (id: string, payload: any) => api.submit(id, payload))
   * submit('item1', { force: true }).then(result => console.log(result))
   *
   * @example
   * const { init, initLoading } = useAsync('init', () => api.init(), { immediate: true })
   *
   * @example
   * const { init } = useAsync('init', () => api.init(props.id), {
   *   watch: () => props.id,
   *   immediate: true
   * })
   *
   * @example
   * const { init } = useAsync('init', () => api.init(), {
   *   setup: (fn) => debounce(fn, 500)
   * })
   *
   * @see {@link useAsyncData} - 需要展示异步返回数据时使用
   * @see {@link UseAsyncOptions} - 完整配置选项
   * @see {@link UseAsyncResult} - 返回值类型定义
   */
  <
    Fn extends BaseFunction, 
    Name extends string = string,
    AddonResults extends any[] = any[]
  >(
    name: Name, 
    fn: Fn, 
    options?: UseAsyncOptions<Fn, Addons<Fn, AddonResults>>
  ): UseAsyncResult<Fn, Name, AddonResults>
}

