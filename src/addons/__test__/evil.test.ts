// addons/__test__/evil.test.ts
// 恶意插件：试图覆盖内部状态（track 的只读 key）
// 拆分为多种 EvilAddon 类型，每种专注一种攻击方式
import { withAddonArguments } from '@/addons/arguments'
import { withAddonData } from '@/addons/data'
import { withAddonError } from '@/addons/error'
import { withAddonLoading } from '@/addons/loading'
import type { FunctionMonitor } from '@/core/monitor'
import {
  RUN_ARGUMENTS,
  RUN_DATA,
  RUN_DATA_UPDATED,
  RUN_ERROR,
  RUN_LOADING
} from '@/core/monitor'
import { setupFunctionPipeline } from '@/core/setup-pipeline'
import type { BaseFunction } from '@/utils/types'
import { afterEach, describe, expect, it, vi } from 'vitest'

function withMethodAddon() {
  return ({ monitor }: { monitor: FunctionMonitor }) => {
    return ({ method }: { method: BaseFunction }) => ({ method })
  }
}

/** 试图伪造 loading 状态 */
function withEvilAddonOverwriteLoading() {
  return ({ monitor }: { monitor: FunctionMonitor }) => {
    monitor.on('before', ({ track }) => {
      track.setData(RUN_LOADING, false) // 加载中却伪造「未在加载」
    })
    monitor.on('fulfill', ({ track }) => {
      track.setData(RUN_LOADING, true) // 已完成却伪造「仍在加载」
    })
    return {}
  }
}

/** 试图清空或篡改 arguments */
function withEvilAddonOverwriteArguments() {
  return ({ monitor }: { monitor: FunctionMonitor }) => {
    monitor.on('before', ({ track }) => {
      track.setData(RUN_ARGUMENTS, [])
    })
    return {}
  }
}

/** 试图修改 RUN_DATA_UPDATED */
function withEvilAddonOverwriteDataUpdated() {
  return ({ monitor }: { monitor: FunctionMonitor }) => {
    monitor.on('before', ({ track }) => {
      track.setData(RUN_DATA_UPDATED, true)
    })
    monitor.on('fulfill', ({ track }) => {
      track.setData(RUN_DATA_UPDATED, false)
    })
    return {}
  }
}

/** 非 pending 状态尝试写入 RUN_DATA */
function withEvilAddonOverwriteDataWhenFulfilled() {
  return ({ monitor }: { monitor: FunctionMonitor }) => {
    monitor.on('fulfill', ({ track }) => {
      track.setData(RUN_DATA, { hacked: 1 })
    })
    return {}
  }
}

/** 试图写入或清空 RUN_ERROR */
function withEvilAddonOverwriteError() {
  return ({ monitor }: { monitor: FunctionMonitor }) => {
    monitor.on('fulfill', ({ track }) => {
      track.setData(RUN_ERROR, new Error('hacked'))
    })
    monitor.on('reject', ({ track }) => {
      track.setData(RUN_ERROR, undefined)
    })
    return {}
  }
}

describe('Evil Addon (试图覆盖内部状态)', () => {
  afterEach(() => vi.useRealTimers())

  describe('RUN_LOADING 只读', () => {
    it('should ignore addon that tries to set RUN_LOADING to false during loading', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (id: number) => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return { id }
      })

      const result = setupFunctionPipeline({
        fn,
        addons: [withEvilAddonOverwriteLoading(), withAddonLoading(), withMethodAddon()]
      })

      const method = result.method as any
      const loading = result.__name__Loading

      method(1)
      expect(loading.value).toBe(true)

      await vi.runAllTimersAsync()
      await Promise.resolve()
      expect(loading.value).toBe(false)
    })

    it('should ignore addon that tries to set RUN_LOADING to true after fulfill', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return { done: true }
      })

      const result = setupFunctionPipeline({
        fn,
        addons: [withEvilAddonOverwriteLoading(), withAddonLoading(), withMethodAddon()]
      })

      const method = result.method as any
      const loading = result.__name__Loading

      method()
      await vi.runAllTimersAsync()
      await Promise.resolve()

      expect(loading.value).toBe(false)
    })
  })

  describe('RUN_ARGUMENTS 只读', () => {
    it('should ignore addon that tries to clear RUN_ARGUMENTS in before', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (id: number, name: string) => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return { id, name }
      })

      const result = setupFunctionPipeline({
        fn,
        addons: [withEvilAddonOverwriteArguments(), withAddonArguments(), withMethodAddon()]
      })

      const method = result.method as any
      const args = result.__name__Arguments
      const argFirst = result.__name__ArgumentFirst

      method(1, 'alice')
      expect(args.value).toEqual([1, 'alice'])
      expect(argFirst.value).toBe(1)

      await vi.runAllTimersAsync()
      await Promise.resolve()
    })
  })

  describe('RUN_DATA_UPDATED 只读', () => {
    it('should ignore addon that tries to modify RUN_DATA_UPDATED', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (id: number) => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return { id }
      })

      const result = setupFunctionPipeline({
        fn,
        addons: [withEvilAddonOverwriteDataUpdated(), withAddonData(), withMethodAddon()]
      })

      const method = result.method as any
      const data = result.__name__

      method(1)
      await vi.runAllTimersAsync()
      await Promise.resolve()

      expect(data.value).toEqual({ id: 1 })
    })
  })

  describe('RUN_DATA 非 pending 时只读', () => {
    it('should ignore addon that tries to overwrite RUN_DATA in fulfill', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async (id: number, name: string) => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return { id, name }
      })

      const result = setupFunctionPipeline({
        fn,
        addons: [withEvilAddonOverwriteDataWhenFulfilled(), withAddonData(), withMethodAddon()]
      })

      const method = result.method as any
      const data = result.__name__

      method(1, 'alice')
      await vi.runAllTimersAsync()
      await Promise.resolve()

      expect(data.value).toEqual({ id: 1, name: 'alice' })
    })
  })

  describe('RUN_ERROR 只读', () => {
    it('should ignore addon that tries to set RUN_ERROR on fulfill', async () => {
      vi.useFakeTimers()
      const fn = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return { ok: true }
      })

      const result = setupFunctionPipeline({
        fn,
        addons: [withEvilAddonOverwriteError(), withAddonError(), withMethodAddon()]
      })

      const method = result.method as any
      const error = result.__name__Error

      method()
      await vi.runAllTimersAsync()
      await Promise.resolve()

      expect(error.value).toBeUndefined()
    })

    it('should ignore addon that tries to clear RUN_ERROR on reject', async () => {
      vi.useFakeTimers()
      const err = new Error('real error')
      const fn = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        throw err
      })

      const result = setupFunctionPipeline({
        fn,
        addons: [withEvilAddonOverwriteError(), withAddonError(), withMethodAddon()]
      })

      const method = result.method as any
      const errorRef = result.__name__Error

      const promise = method()
      await vi.runAllTimersAsync()
      await expect(promise).rejects.toBe(err)

      expect(errorRef.value).toBe(err)
    })
  })
})
