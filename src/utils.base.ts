export function upperFirst(string: string): string {
  if (!string) return ''

  const chr = string[0]
  const trailing = string.slice(1)

  return chr.toUpperCase() + trailing
}

export function max(...args: number[]): number | undefined {
  if (!args.length) return undefined
  return args.reduce((max, v) => v > max ? v : max, args[0])
}