import { BaseFunction } from "@/utils/types"

export function upperFirst<Name extends string>(string: Name): Capitalize<Name> {
  if (!string) return '' as any

  const chr = string[0]
  const trailing = string.slice(1)

  return chr.toUpperCase() + trailing as any
}

export function lowerFirst<Name extends string>(string: Name): Uncapitalize<Name> {
  if (!string) return '' as any

  const chr = string[0]
  const trailing = string.slice(1)

  return chr.toLowerCase() + trailing as any
}

export function max(...args: number[]): number | undefined {
  if (!args.length) return undefined
  return args.reduce((max, v) => v > max ? v : max, args[0])
}

function _message(message: string): string {
  return `[vue-asyncx]: ${message}`
}

export { _message as message }

export function warn(message: string, ...rest: any[]): void {
  console.warn(_message(message), ...rest);
}

export function getFunction<C, F extends (...args: any[]) => any>(creator: C, args: any[], fallback: F, error: string): 
  C extends (...args: any[]) => infer R 
    ? (R extends (...args: any[]) => any 
      ? R 
      : F) 
    : F {
  if (typeof creator !== 'function') return fallback as any
  try {
    const result = creator(...args)
    return typeof result === 'function' ? result : fallback as any
  } catch(e) {
    warn(error, e)
    return fallback as any
  }
}

export function debounce<Fn extends BaseFunction>(fn: Fn, delay: number): Fn {
  let timer = null; // 声明一个闭包变量来保存定时器

  return function(...args) {
    // 1. 如果定时器已存在，直接清除它
    if (timer) clearTimeout(timer);

    // 2. 重新开启定时器，delay 毫秒后执行函数
    timer = setTimeout(() => {
      fn.apply(this, args); // 保持 this 指向并传递参数
    }, delay);
  } as any;
}