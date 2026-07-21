import { Box3, Matrix4, Vector3, type BufferGeometry, type Object3D } from 'three';

export interface BoxSummary {
  min: number[];
  max: number[];
  center: number[];
  size: number[];
  diagonal: number;
  volume: number;
  centerDistanceFromOrigin: number;
}

export function summarizeBox(box: Box3): BoxSummary | null {
  if (box.isEmpty()) {
    return null;
  }
  const center = new Vector3();
  const size = new Vector3();
  box.getCenter(center);
  box.getSize(size);
  return {
    min: box.min.toArray(),
    max: box.max.toArray(),
    center: center.toArray(),
    size: size.toArray(),
    diagonal: size.length(),
    volume: size.x * size.y * size.z,
    centerDistanceFromOrigin: center.length()
  };
}

export function geometryLocalBox(geometry: BufferGeometry): Box3 | null {
  geometry.computeBoundingBox();
  return geometry.boundingBox ? geometry.boundingBox.clone() : null;
}

export function worldAabb(object: Object3D): Box3 {
  object.updateWorldMatrix(true, true);
  return new Box3().setFromObject(object);
}

export function nodeOwnBox(object: Object3D): Box3 {
  const box = new Box3();
  object.updateWorldMatrix(true, true);
  const ownGeometry = (object as Object3D & { geometry?: BufferGeometry }).geometry;
  if (ownGeometry) {
    const local = geometryLocalBox(ownGeometry);
    if (local) {
      box.union(local.applyMatrix4(object.matrixWorld));
    }
  }
  for (const child of object.children) {
    const childGeometry = (child as Object3D & { geometry?: BufferGeometry }).geometry;
    if (childGeometry) {
      const local = geometryLocalBox(childGeometry);
      if (local) {
        box.union(local.applyMatrix4(child.matrixWorld));
      }
    }
  }
  return box;
}

export function nodeSubtreeBoxRelative(selected: Object3D): Box3 {
  selected.updateWorldMatrix(true, true);
  const inverse = selected.matrixWorld.clone().invert();
  const box = new Box3();
  selected.traverse((descendant) => {
    const maybeGeometry = (descendant as Object3D & { geometry?: BufferGeometry }).geometry;
    if (!maybeGeometry) {
      return;
    }
    const local = geometryLocalBox(maybeGeometry);
    if (!local) {
      return;
    }
    const relative = new Matrix4().multiplyMatrices(inverse, descendant.matrixWorld);
    box.union(local.applyMatrix4(relative));
  });
  return box;
}

export function transformedLocalBoxCorners(box: Box3, matrixWorld: Matrix4): Vector3[] {
  const { min, max } = box;
  return [
    new Vector3(min.x, min.y, min.z),
    new Vector3(max.x, min.y, min.z),
    new Vector3(max.x, max.y, min.z),
    new Vector3(min.x, max.y, min.z),
    new Vector3(min.x, min.y, max.z),
    new Vector3(max.x, min.y, max.z),
    new Vector3(max.x, max.y, max.z),
    new Vector3(min.x, max.y, max.z)
  ].map((corner) => corner.applyMatrix4(matrixWorld));
}
