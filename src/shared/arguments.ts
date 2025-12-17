import { message } from "../utils"

export function parseArguments(args: any[], fallback: { name: string }) {
  if (!Array.isArray(args) || !args.length) throw TypeError(message('Expected at least 1 argument, but got 0.'))
  const { name, fn, options } = typeof args[0] === 'function'
    ? { name: fallback.name, fn: args[0], options: args[1] }
    : { name: args[0] || fallback.name, fn: args[1], options: args[2] }
  if (typeof name !== 'string') throw TypeError(message(`Expected "name" to be a string, but received ${typeof name}.`))
  if (typeof fn !== 'function') throw TypeError(message(`Expected "fn" to be a function, but received ${typeof fn}.`))
  return { name, fn, options }
}