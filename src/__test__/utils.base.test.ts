import { describe, expect, test } from "vitest";
import { upperFirst, max } from "../utils.base";

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
})