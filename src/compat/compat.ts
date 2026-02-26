export function set<V = any>(target: object, key: string, val: V): V {
  target[key] = val
  return val
}