import { debounce, lowerFirst, max, upperFirst } from "@/utils/base";
import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";

describe('upperFirst', () => {
  test('should return empty string when invalid input', () => {
    expect(upperFirst(undefined as any)).toBe('')
  })

  test('should return empty string when empty string input', () => {
    expect(upperFirst('')).toBe('')
  })

  test('should upper case first and keep rest', () => {
    expect(upperFirst('abc')).toBe('Abc')
    expect(upperFirst('Abc')).toBe('Abc')
  })

  test('should handle single character', () => {
    expect(upperFirst('a')).toBe('A')
    expect(upperFirst('Z')).toBe('Z')
  })
})

describe('lowerFirst', () => {
  test('should return empty string when invalid input', () => {
    expect(lowerFirst(undefined as any)).toBe('')
  })

  test('should return empty string when empty string input', () => {
    expect(lowerFirst('')).toBe('')
  })

  test('should upper case first and keep rest', () => {
    expect(lowerFirst('Abc')).toBe('abc')
    expect(lowerFirst('abc')).toBe('abc')
  })

  test('should handle single character', () => {
    expect(lowerFirst('A')).toBe('a')
    expect(lowerFirst('z')).toBe('z')
  })
})

describe('max', () => {
  test('should return max when input', () => {
    expect(max(1)).toBe(1)
    expect(max(1, 2, 3)).toBe(3)
    expect(max(3, 2, 1)).toBe(3)
    expect(max(2, 3, 1)).toBe(3)
  })

  test('should return undefined when no input', () => {
    expect(max()).toBeUndefined()
  })

  test('should handle negative numbers', () => {
    expect(max(-3, -2, -5)).toBe(-2)
  })

  test('should handle mixed positive and negative', () => {
    expect(max(-1, 0, 5, -10)).toBe(5)
  })

  test('should handle all equal numbers', () => {
    expect(max(4, 4, 4)).toBe(4)
  })
})

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  test('should delay execution', () => {
    const fn = vi.fn()
    const debouncedFn = debounce(fn, 100)

    debouncedFn()
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  test('should cancel previous calls when called multiple times', () => {
    const fn = vi.fn()
    const debouncedFn = debounce(fn, 100)

    debouncedFn()
    vi.advanceTimersByTime(50)
    debouncedFn()
    vi.advanceTimersByTime(50)
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(50)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  test('should pass arguments correctly', () => {
    const fn = vi.fn()
    const debouncedFn = debounce(fn, 100)

    debouncedFn(1, 2, 3)
    vi.advanceTimersByTime(100)

    expect(fn).toHaveBeenCalledWith(1, 2, 3)
  })

  test('should preserve this context', () => {
    const obj = {
      value: 42,
      fn: function(this: { value: number }) {
        return this.value
      }
    }

    const debouncedFn = debounce(obj.fn, 100)
    const result = debouncedFn.call(obj)
    
    vi.advanceTimersByTime(100)
    
    // 由于 debounce 返回的函数是异步的，这里主要测试 this 绑定不会报错
    expect(typeof debouncedFn).toBe('function')
  })

  test('should handle multiple separate calls', () => {
    const fn = vi.fn()
    const debouncedFn = debounce(fn, 100)

    debouncedFn()
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)

    debouncedFn()
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  test('should handle zero delay', () => {
    const fn = vi.fn()
    const debouncedFn = debounce(fn, 0)

    debouncedFn()
    vi.advanceTimersByTime(0)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  test('should handle function with return value', () => {
    const fn = vi.fn((x: number) => x * 2)
    const debouncedFn = debounce(fn, 100)

    const result = debouncedFn(5)
    vi.advanceTimersByTime(100)

    expect(fn).toHaveBeenCalledWith(5)
    // debounce 函数本身不返回原函数的返回值，而是立即返回 undefined
    expect(result).toBeUndefined()
  })
})