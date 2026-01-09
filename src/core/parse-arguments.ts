import { message } from "@/utils/base"

export function parseArguments(args: any[]): { name?: string, fn: (...args: any) => any, options: any } {
  if (!Array.isArray(args) || !args.length) throw TypeError(message('Expected at least 1 argument, but got 0.'))
  const { name, fn, options } = typeof args[0] === 'function'
    ? { fn: args[0], options: args[1] }
    : { name: args[0] || undefined, fn: args[1], options: args[2] }
  if (name && typeof name !== 'string') throw TypeError(message(`Expected "name" to be a string, but received ${typeof name}.`))
  if (typeof fn !== 'function') throw TypeError(message(`Expected "fn" to be a function, but received ${typeof fn}.`))
  return { name, fn, options }
}

