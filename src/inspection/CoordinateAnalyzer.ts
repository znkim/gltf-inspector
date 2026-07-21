import { Box3, Vector3, type Object3D } from 'three';
import type { InspectorIssue } from '../types/gltf';
import type { WarningThresholds } from '../state/settingsStore';

export interface CoordinateAnalysis {
  maximumAbsoluteVertexCoordinate: number;
  sceneCenterDistanceFromOrigin: number;
  rootTranslationMagnitude: number;
  modelDimensions: number[];
  estimatedFloat32Spacing: number;
  recenterRecommended: boolean;
}

export function estimateFloat32Spacing(value: number): number {
  const magnitude = Math.abs(value);
  if (magnitude === 0) {
    return Math.pow(2, -149);
  }
  return Math.pow(2, Math.floor(Math.log2(magnitude)) - 23);
}

export function analyzeCoordinates(root: Object3D): CoordinateAnalysis {
  root.updateMatrixWorld(true);
  const sceneBox = new Box3().setFromObject(root);
  const center = new Vector3();
  const size = new Vector3();
  sceneBox.getCenter(center);
  sceneBox.getSize(size);
  let maxAbs = 0;
  root.traverse((object) => {
    const geometry = (object as Object3D & { geometry?: { attributes?: { position?: { array: ArrayLike<number> } } } }).geometry;
    const array = geometry?.attributes?.position?.array;
    if (!array) {
      return;
    }
    for (let i = 0; i < array.length; i += 1) {
      maxAbs = Math.max(maxAbs, Math.abs(array[i] ?? 0));
    }
  });
  return {
    maximumAbsoluteVertexCoordinate: maxAbs,
    sceneCenterDistanceFromOrigin: center.length(),
    rootTranslationMagnitude: root.position.length(),
    modelDimensions: size.toArray(),
    estimatedFloat32Spacing: estimateFloat32Spacing(Math.max(maxAbs, center.length())),
    recenterRecommended: center.length() > Math.max(10000, size.length() * 100)
  };
}

export function coordinateIssues(analysis: CoordinateAnalysis, thresholds: WarningThresholds): InspectorIssue[] {
  const issues: InspectorIssue[] = [];
  if (analysis.maximumAbsoluteVertexCoordinate > thresholds.largeCoordinate) {
    issues.push({
      id: 'coord-large-vertex',
      severity: 'warning',
      code: 'LARGE_VERTEX_COORDINATE',
      message: `Maximum absolute vertex coordinate ${analysis.maximumAbsoluteVertexCoordinate.toPrecision(6)} exceeds threshold ${thresholds.largeCoordinate}.`
    });
  }
  const dimension = Math.max(...analysis.modelDimensions, 1);
  if (analysis.rootTranslationMagnitude / dimension > thresholds.translationToSizeRatio) {
    issues.push({
      id: 'coord-large-root-translation',
      severity: 'warning',
      code: 'LARGE_ROOT_TRANSLATION',
      message: `Root translation is large relative to model dimensions. Ratio ${(analysis.rootTranslationMagnitude / dimension).toPrecision(6)} exceeds ${thresholds.translationToSizeRatio}.`
    });
  }
  if (analysis.recenterRecommended) {
    issues.push({
      id: 'coord-recenter-recommended',
      severity: 'info',
      code: 'DISPLAY_RECENTER_RECOMMENDED',
      message: 'Scene center is far from origin relative to model dimensions. Display Recenter is recommended.'
    });
  }
  return issues;
}
