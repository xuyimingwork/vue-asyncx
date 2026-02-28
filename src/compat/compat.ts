import * as Vue from 'vue';

function _set<V = any>(target: any, key: string, val: V): V {
  target[key] = val
  return val
}

const V = (Vue as any).default || Vue
const isVue2 = (V && V.version?.startsWith('2') && typeof V.set === 'function')

export const set: typeof _set =  /* @__PURE__ */ (isVue2 ? V.set : _set);
