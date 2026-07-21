import { Raycaster, Vector2, type Camera, type Object3D } from 'three';
import type { InspectionIndex, PickSelection } from '../inspection/InspectionIndex';

export interface PickPointer {
  clientX: number;
  clientY: number;
}

export class PickingManager {
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();

  pick(event: PickPointer, canvas: HTMLCanvasElement, camera: Camera, root: Object3D, index: InspectionIndex): PickSelection | null {
    const rect = canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    camera.updateMatrixWorld();
    root.updateWorldMatrix(true, true);
    this.raycaster.setFromCamera(this.pointer, camera);
    const hit = this.raycaster.intersectObject(root, true).find((entry) => isVisibleInTree(entry.object));
    return index.getPickSelection(hit?.object ?? null);
  }
}

function isVisibleInTree(object: Object3D): boolean {
  let cursor: Object3D | null = object;
  while (cursor) {
    if (!cursor.visible) {
      return false;
    }
    cursor = cursor.parent;
  }
  return true;
}
