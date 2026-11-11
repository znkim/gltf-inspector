import { PointsMaterial, type Object3D, type Points } from 'three';

export function applyPointSize(root: Object3D, size: number) {
  root.traverse((object) => {
    const points = object as Points;
    if (!points.isPoints || points.userData.inspectorRepresentation) {
      return;
    }
    const materials = Array.isArray(points.material) ? points.material : [points.material];
    for (const material of materials) {
      if (material instanceof PointsMaterial) {
        material.size = size;
        material.sizeAttenuation = false;
      }
    }
  });
}
