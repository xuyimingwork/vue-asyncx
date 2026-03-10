/**
 * E2E 测试：验证 VueAsyncx 在 CDN 环境下正常运行
 * 使用 vitest browser 模式，加载 index.cdn.html 作为测试页面
 * Vue 2: pnpm run test:browser -- --mode vue2
 * Vue 3: pnpm run test:browser (默认)
 */
import { describe, expect, test } from 'vitest'

// 从 window 获取 CDN 加载的全局变量（由 index.cdn.html 的 script 标签注入）
const getGlobals = () => ({
  Vue: (globalThis as any).Vue,
  VueAsyncx: (globalThis as any).VueAsyncx,
})

describe(`Browser CDN Vue v${globalThis.Vue.version}`, () => {
  test('should mount Vue on window', () => {
    const { Vue } = getGlobals()
    expect(Vue).toBeDefined()
    // Vue 2 为构造函数 (function)，Vue 3 为对象 (object)
    expect(['function', 'object']).toContain(typeof Vue)
  })

  test('should mount VueAsyncx on window', () => {
    const { VueAsyncx } = getGlobals()
    expect(VueAsyncx).toBeDefined()
    expect(typeof VueAsyncx).toBe('object')
  })

  test('should export all expected APIs from VueAsyncx', () => {
    const { VueAsyncx } = getGlobals()
    const expected = [
      'useAsync',
      'useAsyncData',
      'useAsyncFunction',
      'unFirstArgumentEnhanced',
      'getAsyncDataContext',
      'withAddonGroup',
    ]
    expected.forEach((key) => {
      expect(VueAsyncx[key]).toBeDefined()
      expect(typeof VueAsyncx[key]).toBe('function')
    })
  })

  test('should work with useAsync sync function', () => {
    const { Vue, VueAsyncx } = getGlobals()
    const { useAsync } = VueAsyncx
    const { ref } = Vue
    const add = (a: number, b: number) => a + b

    const Component = {
      setup() {
        const result = useAsync(add)
        return { result }
      },
      template: '<div id="sync-result">{{ result.method(1, 2) }}</div>',
    }

    mountApp(Vue, Component)
    const el = document.getElementById('sync-result')
    expect(el?.textContent).toBe('3')
    unmountApp(Vue)
  })

  test('should work with useAsync async function', async () => {
    const { Vue, VueAsyncx } = getGlobals()
    const { useAsync } = VueAsyncx
    const { ref, onMounted, nextTick } = Vue
    const asyncFn = async (x: number) => {
      await new Promise((r) => setTimeout(r, 20))
      return x * 2
    }

    const Component = {
      setup() {
        const result = useAsync(asyncFn)
        const output = ref('')
        onMounted(async () => {
          const res = await result.method(5)
          output.value = String(res)
        })
        return { output }
      },
      template: '<div id="async-result">{{ output }}</div>',
    }

    mountApp(Vue, Component)
    await nextTick()
    await new Promise((r) => setTimeout(r, 50))

    const el = document.getElementById('async-result')
    expect(el?.textContent).toBe('10')
    unmountApp(Vue)
  })

  test('should work with useAsyncData sync', () => {
    const { Vue, VueAsyncx } = getGlobals()
    const { useAsyncData } = VueAsyncx

    const Component = {
      setup() {
        const { data, queryData } = useAsyncData(() => ({ value: 42 }))
        queryData()
        return { data }
      },
      template: '<div id="data-result">{{ data?.value }}</div>',
    }

    mountApp(Vue, Component)
    const el = document.getElementById('data-result')
    expect(el?.textContent).toBe('42')
    unmountApp(Vue)
  })

  test('should return addon function from withAddonGroup', () => {
    const { VueAsyncx } = getGlobals()
    const { withAddonGroup } = VueAsyncx
    const addon = withAddonGroup({ key: () => 'fixed' })
    expect(typeof addon).toBe('function')
  })
})

// --- 辅助函数 ---

function ensureAppContainer() {
  let app = document.getElementById('app')
  if (!app) {
    app = document.createElement('div')
    app.id = 'app'
    document.body.appendChild(app)
  }
  return app
}

function mountApp(Vue: any, Component: any) {
  const app = ensureAppContainer()
  app.innerHTML = ''

  if (Vue.createApp) {
    const instance = Vue.createApp(Component)
    ;(window as any).__vueApp = instance
    instance.mount('#app')
  } else {
    const vm = new Vue({
      ...Component,
      el: '#app',
    })
    ;(window as any).__vueApp = vm
  }
}

function unmountApp(_Vue: any) {
  const app = (window as any).__vueApp
  if (app) {
    if (app.unmount) {
      app.unmount()
    } else if (app.$destroy) {
      app.$destroy()
    }
    ;(window as any).__vueApp = null
  }
  // Vue 2 的 el 会替换 #app，需重新创建容器供后续测试使用
  const el = document.getElementById('app')
  if (el) {
    el.innerHTML = ''
  } else {
    ensureAppContainer()
  }
}
