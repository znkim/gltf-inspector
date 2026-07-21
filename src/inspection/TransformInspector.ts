import { Euler, Matrix4, Quaternion, Vector3, type Object3D } from 'three';
import type { GltfNodeDef } from '../types/gltf';

export interface TransformInspection {
  source: {
    matrix: number[] | null;
    translation: number[] | null;
    rotation: number[] | null;
    scale: number[] | null;
    recompositionError: number | null;
    shearSuspected: boolean;
  };
  runtime: {
    localPosition: number[];
    localQuaternion: number[];
    localEuler: number[];
    localScale: number[];
    localMatrix: number[];
    matrixWorld: number[];
    worldPosition: number[];
    worldQuaternion: number[];
    worldScale: number[];
    determinant: number;
    invertible: boolean;
    negativeScale: boolean;
    zeroScale: boolean;
  };
}

export function inspectTransform(nodeDef: GltfNodeDef | undefined, object: Object3D): TransformInspection {
  object.updateMatrixWorld(true);
  const worldPosition = new Vector3();
  const worldQuaternion = new Quaternion();
  const worldScale = new Vector3();
  object.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);
  const determinant = object.matrixWorld.determinant();
  const recomposition = nodeDef ? sourceRecompositionError(nodeDef) : null;
  return {
    source: {
      matrix: nodeDef?.matrix ?? null,
      translation: nodeDef?.translation ?? null,
      rotation: nodeDef?.rotation ?? null,
      scale: nodeDef?.scale ?? null,
      recompositionError: recomposition,
      shearSuspected: recomposition !== null && recomposition > 1e-5
    },
    runtime: {
      localPosition: object.position.toArray(),
      localQuaternion: object.quaternion.toArray(),
      localEuler: new Euler().setFromQuaternion(object.quaternion).toArray().slice(0, 3) as number[],
      localScale: object.scale.toArray(),
      localMatrix: object.matrix.elements.slice(),
      matrixWorld: object.matrixWorld.elements.slice(),
      worldPosition: worldPosition.toArray(),
      worldQuaternion: worldQuaternion.toArray(),
      worldScale: worldScale.toArray(),
      determinant,
      invertible: Math.abs(determinant) > Number.EPSILON,
      negativeScale: determinant < 0,
      zeroScale: object.scale.toArray().some((value) => Math.abs(value) <= Number.EPSILON)
    }
  };
}

export function sourceRecompositionError(node: GltfNodeDef): number | null {
  if (!node.matrix) {
    return 0;
  }
  const matrix = new Matrix4().fromArray(node.matrix);
  const t = new Vector3();
  const r = new Quaternion();
  const s = new Vector3();
  matrix.decompose(t, r, s);
  const recomposed = new Matrix4().compose(t, r, s);
  return maxMatrixDelta(matrix, recomposed);
}

export function maxMatrixDelta(a: Matrix4, b: Matrix4): number {
  return a.elements.reduce((max, value, index) => Math.max(max, Math.abs(value - b.elements[index])), 0);
}
