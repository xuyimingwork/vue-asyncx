import { describe, expect, test } from "vitest"
import { getAsyncDataContext, prepareAsyncDataContext } from "../use-async-data/context"

describe('context single', () => {
  test('should return null when not prepare', () => {
    expect(getAsyncDataContext()).toBeNull()
  })
  test('should set context after prepare', () => {
    const context = { getData: () => 1, updateData: (v) => {} }
    const restore = prepareAsyncDataContext(context)
    expect(getAsyncDataContext()).toBe(context)
    restore()
  })
  test('should return null after restore', () => {
    const context = { getData: () => 1, updateData: (v) => {} }
    const restore = prepareAsyncDataContext(context)
    expect(getAsyncDataContext()).toBe(context)
    restore()
    expect(getAsyncDataContext()).toBeNull()
  })
})

describe('context multiple', () => {
  test('should set context in order when prepare in order', () => {
    const context1 = { getData: () => 1, updateData: (v) => {} }
    const restore1 = prepareAsyncDataContext(context1)
    expect(getAsyncDataContext()).toBe(context1)
    const context2 = { getData: () => 1, updateData: (v) => {} }
    const restore2 = prepareAsyncDataContext(context2)
    expect(getAsyncDataContext()).toBe(context2)
    restore2()
    restore1()
  })

  test('should restore context in order after restore in order', () => {
    const context1 = { getData: () => 1, updateData: (v) => {} }
    const restore1 = prepareAsyncDataContext(context1)
    const context2 = { getData: () => 1, updateData: (v) => {} }
    const restore2 = prepareAsyncDataContext(context2)
    expect(getAsyncDataContext()).toBe(context2)
    restore2()
    expect(getAsyncDataContext()).toBe(context1)
    restore1()
    expect(getAsyncDataContext()).toBeNull()
  })

  test('should throw error when not restore in order', () => {
    const context1 = { getData: () => 1, updateData: (v) => {} }
    const restore1 = prepareAsyncDataContext(context1)
    const context2 = { getData: () => 1, updateData: (v) => {} }
    const restore2 = prepareAsyncDataContext(context2)
    expect(getAsyncDataContext()).toBe(context2)
    expect(() => restore1()).toThrowError()
    expect(getAsyncDataContext()).toBe(context2)
    expect(() => restore2()).not.toThrowError()
    expect(getAsyncDataContext()).toBe(context1)
    expect(() => restore1()).not.toThrowError()
    expect(getAsyncDataContext()).toBeNull()
  })

  test('should maintain context isolation when nested', () => {
    const context1 = { getData: () => 'context1', updateData: (v: string) => {} }
    const restore1 = prepareAsyncDataContext(context1)
    expect(getAsyncDataContext().getData()).toBe('context1')
    
    const context2 = { getData: () => 'context2', updateData: (v: string) => {} }
    const restore2 = prepareAsyncDataContext(context2)
    expect(getAsyncDataContext().getData()).toBe('context2')
    
    restore2()
    expect(getAsyncDataContext()!.getData()).toBe('context1')
    
    restore1()
    expect(getAsyncDataContext()).toBeNull()
  })

  test('should throw when restore is called twice', () => {
    const context = { getData: () => 1, updateData: (v) => {} }
    const restore = prepareAsyncDataContext(context)
    expect(getAsyncDataContext()).toBe(context)
    restore()
    expect(() => restore()).toThrowError()
  })

  test('should handle triple-nested prepare/restore in order', () => {
    const c1 = { getData: () => 'c1', updateData: (v: string) => {} }
    const r1 = prepareAsyncDataContext(c1)
    const c2 = { getData: () => 'c2', updateData: (v: string) => {} }
    const r2 = prepareAsyncDataContext(c2)
    const c3 = { getData: () => 'c3', updateData: (v: string) => {} }
    const r3 = prepareAsyncDataContext(c3)

    expect(getAsyncDataContext()!.getData()).toBe('c3')
    r3()
    expect(getAsyncDataContext()!.getData()).toBe('c2')
    r2()
    expect(getAsyncDataContext()!.getData()).toBe('c1')
    r1()
    expect(getAsyncDataContext()).toBeNull()
  })
})

describe('context getData and updateData behavior', () => {
  test('should get initial data correctly', () => {
    const initialData = { count: 0 }
    const context = {
      getData: () => initialData,
      updateData: (v: typeof initialData) => {}
    }
    const restore = prepareAsyncDataContext(context)
    expect(getAsyncDataContext()!.getData()).toBe(initialData)
    restore()
  })

  test('should update data correctly', () => {
    let data = { count: 0 }
    const context = {
      getData: () => data,
      updateData: (v: typeof data) => { data = v }
    }
    const restore = prepareAsyncDataContext(context)
    const { getData, updateData } = getAsyncDataContext()
    expect(getData().count).toBe(0)
    updateData({ count: 1 })
    expect(getData().count).toBe(1)
    updateData({ count: 2 })
    expect(getData().count).toBe(2)
    restore()
  })

  test('should handle undefined data', () => {
    const context = {
      getData: () => undefined,
      updateData: (v: any) => {}
    }
    const restore = prepareAsyncDataContext(context)
    expect(getAsyncDataContext()!.getData()).toBeUndefined()
    restore()
  })

  test('should handle null data', () => {
    const context = {
      getData: () => null,
      updateData: (v: any) => {}
    }
    const restore = prepareAsyncDataContext(context)
    expect(getAsyncDataContext()!.getData()).toBeNull()
    restore()
  })

  test('should handle complex data structures', () => {
    const complexData = {
      nested: {
        array: [1, 2, 3],
        object: { key: 'value' }
      }
    }
    let data = complexData
    const context = {
      getData: () => data,
      updateData: (v: typeof data) => { data = v }
    }
    const restore = prepareAsyncDataContext(context)
    const { getData, updateData } = getAsyncDataContext()
    expect(getData()).toEqual(complexData)
    const updated = {
      nested: {
        array: [4, 5, 6],
        object: { key: 'newValue' }
      }
    }
    updateData(updated)
    expect(getData()).toEqual(updated)
    restore()
  })
})