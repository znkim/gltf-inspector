import { expect, it } from 'vitest';
import { idToColor } from '../debug-materials/IdDebugMaterial';

it('creates stable nonzero colors for ids', () => {
  expect(idToColor(1)).toBe(idToColor(1));
  expect(idToColor(1)).not.toBe(idToColor(2));
  expect(idToColor(1)).toBeGreaterThan(0);
});
