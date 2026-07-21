import { describe, expect, it } from 'vitest';
import { Matrix4 } from 'three';
import { maxMatrixDelta, sourceRecompositionError } from '../inspection/TransformInspector';

describe('matrix decomposition', () => {
  it('round-trips a TRS-compatible matrix', () => {
    const matrix = new Matrix4().makeTranslation(1, 2, 3);
    expect(sourceRecompositionError({ matrix: matrix.elements })).toBeLessThan(1e-8);
  });

  it('detects matrix delta', () => {
    const a = new Matrix4().identity();
    const b = new Matrix4().makeScale(2, 1, 1);
    expect(maxMatrixDelta(a, b)).toBe(1);
  });
});
