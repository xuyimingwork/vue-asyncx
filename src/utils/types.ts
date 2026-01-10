/**
 * @fileoverview 类型工具系统
 * 
 * 该模块提供 TypeScript 类型工具，用于支持 Vue-AsyncX 的类型推导。
 * 
 * 主要功能：
 * - 基础类型定义（BaseFunction、Not 等）
 * - 字符串处理工具（CamelReplace、NonEmptyString 等）
 * - 对象处理工具（Merge、ObjectShape 等）
 * - 类型判断工具（IsUnion 等）
 * 
 * 这些工具主要用于：
 * - 插件返回类型的合并和转换
 * - 命名约定的类型推导
 * - 类型安全的保障
 * 
 * @module utils/types
 */

/**
 * 基础函数类型
 * 
 * @description 匹配任何具有任意参数和返回值的函数。
 * 用于约束函数类型，确保类型安全。
 * 
 * @example
 * ```ts
 * const fn: BaseFunction = () => {}
 * const fn2: BaseFunction = (a: number) => a
 * ```
 */
export type BaseFunction = (...args: any) => any;

/**
 * 基础逻辑工具：取反
 */
export type Not<T extends boolean> = T extends true ? false : true;

/**
 * 确保字符串非空。
 * 如果输入字符串 `S` 为空字符串，则返回默认类型 `D`，否则返回 `S`。
 * @template S - 输入的字符串字面量类型。
 * @template D - 如果 S 为空时的回退默认值。
 */
export type NonEmptyString<S extends string, D extends string> = 
  S extends '' ? D : S

/**
 * 驼峰化工具：根据位置决定应用小驼峰还是大驼峰
 * @param S - 待转换的字符串
 * @param IsFirst - 是否作为结果字符串的起始词（起始词小写，后续词大写）
 */
export type ToCamel<
  S extends string, 
  IsFirst extends boolean
> = IsFirst extends true ? Uncapitalize<S> : Capitalize<S>;

/**
 * 驼峰替换工具：将字符串中的 Pattern 替换为 Replacement，并自动处理驼峰命名。
 * @param Input        - 原始字符串 (e.g., "get__name__")
 * @param Pattern      - 待匹配的占位符模式 (e.g., "__name__")
 * @param Replacement  - 替换后的目标内容 (e.g., "user")
 * @param OnNoPattern  - 【配置项】若 Input 中完全不含 Pattern 时的返回结果。
 * 默认为 Input (保留原样)；业务中可传入 never (丢弃)。
 * @param IsSuffix     - 【内部状态】标记当前是否已处于匹配项之后的后缀部分。
 */
export type CamelReplace<
  Input extends string,
  Pattern extends string,
  Replacement extends string,
  OnNoPattern = Input,
  IsSuffix extends boolean = false,
> = Input extends `${infer Prefix}${Pattern}${infer Suffix}`
  ? Prefix extends ""
    /**
     * 情况 A: Pattern 出现在字符串开头 (Prefix 为空)
     * 逻辑：其大小写取决于它是否是全局第一个词。
     * - 若 IsSuffix 为 false: 它是首位 -> Camelize(..., true) -> 小写
     * - 若 IsSuffix 为 true : 它是后续项 -> Camelize(..., false) -> 大写
     */
    ? `${ToCamel<Replacement, Not<IsSuffix>>}${CamelReplace<Suffix, Pattern, Replacement, OnNoPattern, true>}`
    /**
     * 情况 B: Pattern 出现在字符串中间或结尾 (Prefix 不为空)
     * 逻辑：既然前面已有 Prefix，Replacement 必然是后缀部分，直接首字母大写。
     */
    : `${Prefix}${Capitalize<Replacement>}${CamelReplace<Suffix, Pattern, Replacement, OnNoPattern, true>}`
  /**
   * 情况 C: 递归出口（不再包含 Pattern）
   * 逻辑：
   * - 若 IsSuffix 为 true : 说明之前发生过替换，将剩余的 Suffix 拼接回去。
   * - 若 IsSuffix 为 false: 说明从头到尾没匹配到 Pattern，返回预设的 OnNoPattern。
   */
  : (IsSuffix extends true ? Input : OnNoPattern);

/**
 * 对象属性名驼峰替换工具：将属性名中的 Pattern 替换为 Replacement
 * 
 * @param T               - 目标对象
 * @param Replacement     - 替换后的名称
 * @param Pattern         - 占位符模式，默认 '__name__'
 * @param KeepNoPattern   - 是否保留不含 Pattern 的属性，默认 false (移除)
 */
export type CamelReplaceKeys<
  T,
  Replacement extends string,
  Pattern extends string = '__name__',
  KeepNoPattern extends boolean = false // 这里用 any 作为内部占位，逻辑中会解析为原键名 K
> = Simplify<{
  [K in keyof T as K extends string 
    ? CamelReplace<K, Pattern, Replacement, KeepNoPattern extends true ? K : never> 
    : (KeepNoPattern extends true ? K : never)
  ]: T[K];
}>;

/**
 * 判断一个类型是否为联合类型 (Union Type)。
 * 
 * @template T - 待检查的类型。
 * @example
 * IsUnion<string | number> // true
 * IsUnion<string> // false
 */
export type IsUnion<T, U = T> = T extends U 
  ? [U] extends [T] 
    ? false 
    : true 
  : never;

/**
 * 展平复杂的交叉类型，提升 IDE 的悬浮提示体验。
 * 将 `A & B` 形式的交叉类型映射为单一的扁平对象结构，从而显著提升 IDE 悬浮提示的可读性。
 * 
 * @template T - 待简化的对象类型。
 */
export type Simplify<T> = {[K in keyof T]: T[K]} & {};

/**
 * 两个类型的智能合并。
 * 从 A 中剔除 B 已有的键，然后合并 B。若有同名键，B 的类型将覆盖 A。
 * 支持联合类型分发：如果 A 是联合类型，合并操作将分别应用于每个成员。
 * @template A - 基础类型。
 * @template B - 覆盖类型（高优先级）。
 * @example
 * type Res = Merge<{ a: string, b: number }, { b: string }>; // { a: string, b: string }
 */
export type Merge<A, B> = A extends any ? Simplify<Omit<A, keyof B> & B> : never;

/**
 * 递归合并元组/数组中的所有类型。
 * 将数组中的每一项依次从左到右执行 Merge 操作。
 * @template Items - 包含待合并项的只读数组/元组。
 * @template Acc - 累加器，记录当前合并的结果，默认为空对象。
 * @example
 * type Merged = MergeTypes<[{a: 1}, {b: 2}, {a: 3}]>; // { a: 3, b: 2 }
 */
export type MergeTypes<Items extends readonly any[], Acc = {}> = Items extends readonly [infer Item, ...infer Rest]
  ? MergeTypes<Rest, Merge<Acc, Item>>
  : Acc

/**
 * 提取类型的“对象形状”。
 * 该工具旨在过滤掉非纯对象类型：
 * 1. 识别并排除 `any`（转为 `{}`）。
 * 2. 排除函数、数组、null、undefined 等（均转为 `{}`）。
 * 3. 仅保留纯粹的对象结构。
 * @template T - 待检查的类型。
 */
export type ObjectShape<T> = 0 extends (1 & T) ? {} : // ObjectShape<any> => {}
  T extends BaseFunction ? {} : // ObjectShape<() => void> => {}
  T extends readonly any[] ? {} : // ObjectShape<any[]> => {}
  T extends object ? T : {} // ObjectShape<null> => {} / ObjectShape<undefined> => {}

/**
 * 批量提取对象形状。
 * 将数组或元组中的每一项转换为对应的 `ObjectShape`。
 * @template List - 待转换的类型列表。
 */
export type ObjectShapeList<List extends readonly any[]> = {
  [K in keyof List]: ObjectShape<List[K]>
}