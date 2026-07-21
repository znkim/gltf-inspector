import { expect, it } from 'vitest';
import { coordinateIssues, estimateFloat32Spacing } from '../inspection/CoordinateAnalyzer';

it('estimates Float32 spacing for large coordinates', () => {
  expect(estimateFloat32Spacing(1)).toBeCloseTo(Math.pow(2, -23));
  expect(estimateFloat32Spacing(1_000_000)).toBeGreaterThan(0.05);
});

it('creates coordinate warnings from adjustable thresholds', () => {
  const issues = coordinateIssues(
    {
      maximumAbsoluteVertexCoordinate: 1000,
      sceneCenterDistanceFromOrigin: 5000,
      rootTranslationMagnitude: 1000,
      modelDimensions: [1, 1, 1],
      estimatedFloat32Spacing: 0.001,
      recenterRecommended: true
    },
    { largeCoordinate: 100, translationToSizeRatio: 10 }
  );
  expect(issues.map((issue) => issue.code)).toEqual([
    'LARGE_VERTEX_COORDINATE',
    'LARGE_ROOT_TRANSLATION',
    'DISPLAY_RECENTER_RECOMMENDED'
  ]);
});
