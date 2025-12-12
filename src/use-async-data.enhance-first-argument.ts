const FLAG_FIRST_ARGUMENT_ENHANCED = '__va_fae'

export type FirstArgumentEnhanced<T = any, D = any> = {
  [FLAG_FIRST_ARGUMENT_ENHANCED]: true
  firstArgument?: T, 
  getData: () => D,
  updateData: (v: D) => void
}

/**
 * @deprecated 已废弃，请使用 getAsyncDataContext
 * @param arg 首个参数
 * @param defaultValue 当 arg === undefined 时的默认值
 * @returns 首个参数解构结果（符合 ts 类型要求）
 */
export function unFirstArgumentEnhanced<Arg = any, Data = any>(arg: Arg, defaultValue?: Arg): Arg extends undefined 
  ? FirstArgumentEnhanced<Arg, Data> 
  : Required<FirstArgumentEnhanced<Arg, Data>> {
  if (!isFirstArgumentEnhanced(arg)) throw Error('请配置 options.enhanceFirstArgument = true')
  const enhanced: FirstArgumentEnhanced<Arg, Data> = arg
  /**
   * js 的参数默认值规则：当参数为 undefined 时，使用默认值。
   * 即 hello() 与 hello(undefined) 都会触发默认值赋值规则。
   * 因此，当有配置默认值时，直接判断 enhanced.firstArgument 与 undefined 是否全等即可
   */
  if (arguments.length === 2 && enhanced.firstArgument === undefined) return { ...enhanced, firstArgument: defaultValue } as any
  return enhanced as any
}

function isFirstArgumentEnhanced(v: any): v is FirstArgumentEnhanced {
  return typeof v === 'object' && !!v && (FLAG_FIRST_ARGUMENT_ENHANCED in v)
}

export function normalizeArguments(args: any[], {
  enhanceFirstArgument,
  context
}: { 
  enhanceFirstArgument?: boolean
  context: any
}) {
  if (!enhanceFirstArgument) return args
  const [_first, ...restArgs] = args
  const first: FirstArgumentEnhanced = {
    [FLAG_FIRST_ARGUMENT_ENHANCED]: true,
    ...(args.length ? { firstArgument: _first } : {}), 
    ...context
  }

  return [first, ...restArgs]
}