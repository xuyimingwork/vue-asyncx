import { describe, expectTypeOf, test } from 'vitest'
import type { MergeReturnTypes, ObjectShape } from '../base';

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

describe('MergeReturnTypes types', () => {
  test('should merge multi function return types', () => {
    const f1 = () => ({ a: 1 });
    const f2 = () => ({ b: 'hello' });
    const f3 = () => ({ c: true });
    expectTypeOf<MergeReturnTypes<[typeof f1, typeof f2, typeof f3]>>().toEqualTypeOf<{ a: number; b: string; c: boolean }>();
  });

  test('should return {} when no function', () => {
    expectTypeOf<MergeReturnTypes<[]>>().toEqualTypeOf<{}>();
  });
})