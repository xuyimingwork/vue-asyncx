import { describe, expect, test } from "vitest";
import { upperFirst } from "../utils";

describe('upperFirst', () => {
  test('无值情况', () => {
    expect(upperFirst('')).toBe('')
  })

  test('首字母大写', () => {
    expect(upperFirst('abc')).toBe('Abc')
  })
})