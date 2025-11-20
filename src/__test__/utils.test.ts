import { describe, expect, test } from "vitest";
import { upperFirst } from "../utils";

describe('upperFirst', () => {
  test('无值情况', () => {
    expect(upperFirst('')).toBe('')
    expect(upperFirst(undefined as any)).toBe('')
  })

  test('首字母大写', () => {
    expect(upperFirst('abc')).toBe('Abc')
    expect(upperFirst('Abc')).toBe('Abc')
  })
})