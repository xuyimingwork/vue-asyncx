import type { UseAsyncOptions, UseAsyncResult } from "@/hooks/use-async/types";
import type { BaseFunction, NonEmptyString, Simplify } from "@/utils/types";
import type { Ref, ShallowRef } from "vue";

type UseAsyncDataNameDefault = 'data'

/**
 * useAsyncData 配置选项
 *
 * @extends UseAsyncOptions - 继承 useAsync 的全部配置（immediate、watch、setup 等）
 *
 * @template Fn - 异步函数类型
 * @template Shallow - 是否使用 shallowRef
 * @template AddonResults - 插件扩展的返回值
 */
export interface UseAsyncDataOptions<Fn extends BaseFunction, Shallow extends boolean, AddonResults extends any[] = any[]> extends UseAsyncOptions<Fn, AddonResults> {
  /** 数据的初始值，在首次查询完成前使用 */
  initialData?: Awaited<ReturnType<Fn>>,
  /** 为 true 时使用 shallowRef 包裹数据，适用于大对象优化 */
  shallow?: Shallow,
  /** @deprecated 已废弃，请使用 getAsyncDataContext */
  enhanceFirstArgument?: boolean
}

/**
 * useAsyncData 返回值类型
 *
 * @description
 * 根据传入的 name 动态生成属性名。
 *
 * 命名映射规则（name 采用小驼峰，如 'user'；Name 为首字母大写，如 'User'）：
 * - `{name}` → 异步返回的数据
 * - `query{Name}` → 触发数据更新的查询函数
 * - `query{Name}Loading` → 加载状态
 * - `query{Name}Arguments` → 最近一次调用的参数列表
 * - `query{Name}ArgumentFirst` → 参数列表的首个值
 * - `query{Name}Error` → 查询时的异常
 * - `{name}Expired` → 数据是否过期
 *
 * @template Fn - 异步函数类型
 * @template Name - 数据名称，默认 'data'
 * @template Shallow - 是否使用 shallowRef
 * @template AddonResults - 插件扩展的返回值
 */
export type UseAsyncDataResult<
  Fn extends BaseFunction,
  Name extends string,
  Shallow extends boolean = false,
  AddonResults extends any[] = any[]
> = Simplify<UseAsyncResult<Fn, `query${Capitalize<(NonEmptyString<Name, UseAsyncDataNameDefault>)>}`, AddonResults> 
  & { 
  [K in (NonEmptyString<Name, UseAsyncDataNameDefault>)]: Shallow extends true 
    ? ShallowRef<Awaited<ReturnType<Fn>>> 
    : Ref<Awaited<ReturnType<Fn>>> 
} & {
  /**
   * 当前 data 赋值后，有新的调用完成，但 data 未被覆盖。
   * 如：
   * - 某次调用的更新 data 后，该调用报错
   * - 某次调用成功后，后续调用报错
   * 与 error 区别：
   * - error 跟随调用，新调用发起后 error 立即重置
   * - expired 跟随 data，新调用的过程与结果才会影响 expired
   * 
   * @example
   * case1: p1 ok，p2 error，data 来自 p1，error 来自 p2，expired 为 true
   * case2: p1 ok，p2 error，p3 pending，data 来自 p1，error 为 undefined，expired 为 true
   * case3: p1 ok, p2 error，p3 update，data 来自 p3，error 为 undefined，expired 为 false
   */
  [K in `${NonEmptyString<Name, UseAsyncDataNameDefault>}Expired`]: Ref<boolean>
}>

/** useAsyncData 函数类型 */
export interface UseAsyncData {
  /**
   * 管理异步数据，提供响应式数据、查询函数及关联状态。不指定名称时使用默认 'data'。
   *
   * @description
   * 将异步函数包装为查询方法，自动管理返回数据的响应式更新。返回 data、queryData、queryDataLoading、dataExpired 等。
   *
   * @param fn - 返回数据的异步函数
   * @param options - 配置选项，支持 initialData、shallow、immediate、watch、setup 等
   * @returns 默认 name='data'，映射为 data、queryData、queryDataLoading、queryDataArguments、queryDataError、dataExpired
   *
   * @example
   * const { data, queryData, queryDataLoading } = useAsyncData(() => api.getUser())
   * queryData()
   *
   * @see {@link useAsync} - 不需要展示数据时使用
   * @see {@link getAsyncDataContext} - 在异步执行过程中更新数据
   * @see {@link UseAsyncDataOptions} - 完整配置选项
   * @see {@link UseAsyncDataResult} - 返回值类型定义
   */
  <
    Data = any,
    Fn extends (...args: any) => Data | Promise<Data> | PromiseLike<Data> = (...args: any) => Data | Promise<Data> | PromiseLike<Data>,
    Shallow extends boolean = false,
    AddonResults extends any[] = any[]
  >(
    fn: Fn, 
    options?: UseAsyncDataOptions<Fn, Shallow, AddonResults>
  ): UseAsyncDataResult<Fn, UseAsyncDataNameDefault, Shallow, AddonResults>;
  /**
   * 管理异步数据，提供响应式数据、查询函数及关联状态。指定名称以自定义数据及关联状态的命名。
   *
   * @remarks 推荐用法。自定义名称可提升代码可读性。
   *
   * @description
   * 将异步函数包装为查询方法，自动管理返回数据的响应式更新。name='user' 时返回 user、queryUser、queryUserLoading、queryUserArguments、queryUserError、userExpired 等。
   *
   * @param name - 数据及关联状态的名称。命名映射：`{name}`→数据，`query{Name}`→查询函数，`query{Name}Loading`→加载状态，`query{Name}Arguments`→参数列表，`query{Name}Error`→异常，`{name}Expired`→数据过期
   * @param fn - 返回数据的异步函数
   * @param options - 配置选项，支持 initialData、shallow、immediate、watch、setup 等
   * @returns 根据 name 映射：{name}、query{Name}、query{Name}Loading、query{Name}Arguments、query{Name}Error、{name}Expired
   *
   * @example
   * const { user, queryUser, queryUserLoading } = useAsyncData('user', () => api.getUser())
   * queryUser()
   *
   * @example
   * const { user, queryUser } = useAsyncData('user', (id: string) => api.getUser(id))
   * queryUser('user1')  // user.value 自动更新为结果
   *
   * @see {@link useAsync} - 不需要展示数据时使用
   * @see {@link getAsyncDataContext} - 在异步执行过程中更新数据
   * @see {@link UseAsyncDataOptions} - 完整配置选项
   * @see {@link UseAsyncDataResult} - 返回值类型定义
   */
  <
    Data = any,
    Fn extends (...args: any) => Data | Promise<Data> | PromiseLike<Data> = (...args: any) => Data | Promise<Data> | PromiseLike<Data>,
    DataName extends string = string,
    Shallow extends boolean = false,
    AddonResults extends any[] = any[]
  >(
    name: DataName, 
    fn: Fn, 
    options?: UseAsyncDataOptions<Fn, Shallow, AddonResults>
  ): UseAsyncDataResult<Fn, DataName, Shallow, AddonResults>
}

