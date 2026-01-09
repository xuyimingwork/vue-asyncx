import { describe, expectTypeOf, test } from 'vitest'
import type { ObjectShape } from '../types';

describe('ObjectShape types', () => {
  test('should return {} when any', () => {
    expectTypeOf<ObjectShape<any>>().toEqualTypeOf<{}>();
  });

  test('should return {} when undefined', () => {
    expectTypeOf<ObjectShape<undefined>>().toEqualTypeOf<{}>();
  });

  test('should return {} when null', () => {
    expectTypeOf<ObjectShape<null>>().toEqualTypeOf<{}>();
  });

  test('should return {} when void', () => {
    expectTypeOf<ObjectShape<void>>().toEqualTypeOf<{}>();
  });

  test('should return {} when []', () => {
    expectTypeOf<ObjectShape<any[]>>().toEqualTypeOf<{}>();
  });

  test('should return { a: boolean }', () => {
    expectTypeOf<ObjectShape<{ a: boolean }>>().toEqualTypeOf<{ a: boolean }>();
  });
})