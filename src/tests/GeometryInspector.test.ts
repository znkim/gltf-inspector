import { expect, it } from 'vitest';
import { triangleCount } from '../inspection/GeometryInspector';

it('counts triangles by primitive mode', () => {
  expect(triangleCount(4, 9)).toBe(3);
  expect(triangleCount(5, 5)).toBe(3);
  expect(triangleCount(6, 5)).toBe(3);
  expect(triangleCount(1, 10)).toBe(0);
});
