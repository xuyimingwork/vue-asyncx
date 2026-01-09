type MapKeysSmart<T, Name extends string, Placeholder extends string = "__placeholder__"> = {
  [K in keyof T as K extends string 
    ? K extends `${infer P}${Uncapitalize<Placeholder>}${infer S}` // 匹配小写开头
      ? `${P}${Uncapitalize<Name>}${S}`
    : K extends `${infer P}${Capitalize<Placeholder>}${infer S}` // 匹配大写开头
      ? `${P}${Capitalize<Name>}${S}`
    : never // 不包含则丢弃
    : never
  ]: T[K]
};

// --- 测试 ---

interface Example {
  __placeholder___id: number;     // 预期：user_id
  __placeholder____placeholder___id: number;     // 预期：user_id
  current__placeholder__: string; // 预期：currentUser
  __placeholder__Data: boolean;   // 预期：UserData
  query__placeholder__Data: any; // 预期 queryUserName
  query__placeholder__DataBy__placeholder__: any; // 预期 queryUserNameByUser
  unrelated: number;          // 预期：丢弃
}

type FinalResult = MapKeysSmart<Example, "user">;

// ---------- 另一个方案：允许 placeholder 多次出现

type ProcessKey<S extends string, Name extends string, P extends string> = 
  S extends `${infer Pre}${Uncapitalize<P>}${infer Post}`
    ? `${Pre}${Uncapitalize<Name>}${ProcessKey<Post, Name, P>}`
    : S extends `${infer Pre}${Capitalize<P>}${infer Post}`
    ? `${Pre}${Capitalize<Name>}${ProcessKey<Post, Name, P>}`
    : S;

type MapKeysFinal<T, Name extends string, P extends string = "__placeholder__"> = {
  [K in keyof T as K extends string 
    ? (K extends `${string}${Uncapitalize<P>}${string}` | `${string}${Capitalize<P>}${string}` 
        ? ProcessKey<K, Name, P> 
        : never)
    : never
  ]: T[K];
};

type Test = MapKeysFinal<Example, "user">;

// ------------- 自动判断大小写

type PH = "__placeholder__";

/**
 * 核心转换逻辑
 */
type TransformKey<K extends string, Name extends string> =
  // 1. 恰好等于占位符本身 -> 直接返回 Name (原样)
  K extends PH 
    ? Name
  // 2. 出现在首部 (接后缀) -> Name 小写 + 后缀不变
  : K extends `${PH}${infer Rest}`
    ? `${Uncapitalize<Name>}${Rest}`
  // 3. 出现在中后部 (有前缀) -> 前缀不变 + Name 大写 + 递归处理剩余
  : K extends `${infer Prefix}${PH}${infer Rest}`
    ? `${Prefix}${Capitalize<Name>}${TransformKey<Rest, Name>}`
  : K;

/**
 * 最终 Map 类型
 */
export type MapKeys<T, Name extends string> = {
  [K in keyof T as K extends string 
    ? K extends `${string}${PH}${string}` // 只要包含就处理
      ? TransformKey<K, Name>
      : never 
    : never
  ]: T[K];
};

type A = MapKeys<Example, "user">;

// 禁止出现相同的返回值属性

// 这里的 Key 会是一个联合类型，例如 'a' | 'b'
type ExtractKey<F> = F extends (...args: any[]) => infer R 
  ? (R extends Record<string, any> ? keyof R : never) 
  : never;

type ValidateUnique<T extends any[], Seen = never> = 
  T extends [infer First, ...infer Rest]
    ? (ExtractKey<First> & Seen) extends never // 这里的 & 是交集检查
      ? [First, ...ValidateUnique<Rest, Seen | ExtractKey<First>>]
      : ["错误: 属性名重复", ...ValidateUnique<Rest, Seen | ExtractKey<First>>] // 重复则设为 never 触发报错
    : T;

function registerFunctions<T extends any[]>(
  fns: [...T] & ValidateUnique<T>
) {
  return fns;
}

// 测试
registerFunctions([
  () => ({ a: 1, b: 2 }),
  () => ({ c: 3 }),
  () => ({ a: 4 }), // ❌ 这里会报错，因为 'a' 已经在第一个函数中出现了
]);

// 排除保留属性

// 1. 定义禁止外部使用的保留属性
type ReservedKeys = "internal" | "metadata" | "config";

// 2. 提取函数返回值中的所有键
type GetKeys<F> = F extends (...args: any[]) => infer R 
  ? (R extends Record<string, any> ? keyof R : never) 
  : never;

// 3. 递归校验：既检查保留属性，又检查属性重复
type ValidateFns<T extends any[], Seen = never> = 
  T extends [infer First, ...infer Rest]
    ? (
        // A. 检查是否包含保留属性
        GetKeys<First> & ReservedKeys extends never
          ? (
              // B. 检查业务属性是否与之前重复
              GetKeys<First> & Seen extends never
                ? [First, ...ValidateFns<Rest, Seen | GetKeys<First>>]
                : [(args: never) => "错误: 属性名重复", ...ValidateFns<Rest, Seen | GetKeys<First>>]
            )
          : [(args: never) => "错误: 禁用的保留属性 (internal/metadata/config)", ...ValidateFns<Rest, Seen | GetKeys<First>>]
      )
    : T;

// 4. 函数定义
function runFunctions<T extends any[]>(
  fns: [...T] & ValidateFns<T>
) {
  return fns;
}

const a = runFunctions([
  () => ({ a: 1 }),
  () => ({ b: 2 }),
  () => undefined,
]);

const b = runFunctions([
  () => ({ a: 1 }),
  () => ({ internal: "data" }), // 报错: 禁用的保留属性
]);

const c = runFunctions([
  () => ({ score: 100 }),
  () => ({ score: 99 }), // 报错: 属性名重复
]);

