import type { Object3D } from 'three';

export type AssociationType = 'nodes' | 'meshes' | 'materials' | 'textures' | 'accessors' | 'unknown';

export interface PrimitiveAssociation {
  meshIndex: number;
  primitiveIndex: number;
}

export interface PickSelection {
  nodeIndex: number;
  meshIndex?: number;
  primitiveIndex?: number;
}

export interface GltfAssociation {
  type: AssociationType;
  index: number;
  primitive?: number;
}

export class InspectionIndex {
  readonly objectToNode = new Map<Object3D, number>();
  readonly nodeToObject = new Map<number, Object3D>();
  readonly objectAssociations = new Map<Object3D, GltfAssociation>();
  readonly objectToPrimitive = new Map<Object3D, PrimitiveAssociation>();
  readonly primitiveToObject = new Map<string, Object3D>();

  setNode(object: Object3D, nodeIndex: number) {
    this.objectToNode.set(object, nodeIndex);
    this.nodeToObject.set(nodeIndex, object);
    this.objectAssociations.set(object, { type: 'nodes', index: nodeIndex });
  }

  setMeshPrimitive(object: Object3D, meshIndex: number, primitiveIndex: number) {
    const primitive = { meshIndex, primitiveIndex };
    this.objectToPrimitive.set(object, primitive);
    this.primitiveToObject.set(primitiveKey(meshIndex, primitiveIndex), object);
    this.objectAssociations.set(object, { type: 'meshes', index: meshIndex, primitive: primitiveIndex });
  }

  getNodeIndex(object: Object3D | null): number | null {
    if (!object) {
      return null;
    }
    let cursor: Object3D | null = object;
    while (cursor) {
      const nodeIndex = this.objectToNode.get(cursor);
      if (nodeIndex !== undefined) {
        return nodeIndex;
      }
      cursor = cursor.parent;
    }
    return null;
  }

  getPrimitiveAssociation(object: Object3D | null): PrimitiveAssociation | null {
    if (!object) {
      return null;
    }
    let cursor: Object3D | null = object;
    while (cursor) {
      const primitive = this.objectToPrimitive.get(cursor);
      if (primitive) {
        return primitive;
      }
      cursor = cursor.parent;
    }
    return null;
  }

  getPrimitiveObject(nodeIndex: number, meshIndex: number, primitiveIndex: number): Object3D | null {
    const node = this.nodeToObject.get(nodeIndex);
    if (!node) {
      return null;
    }
    let match: Object3D | null = null;
    node.traverse((object) => {
      if (match) {
        return;
      }
      const primitive = this.objectToPrimitive.get(object);
      if (primitive?.meshIndex === meshIndex && primitive.primitiveIndex === primitiveIndex) {
        match = object;
      }
    });
    return match ?? this.primitiveToObject.get(primitiveKey(meshIndex, primitiveIndex)) ?? null;
  }

  getMeshPrimitiveObjects(nodeIndex: number, meshIndex: number): Object3D[] {
    const node = this.nodeToObject.get(nodeIndex);
    if (!node) {
      return [];
    }
    const matches: Object3D[] = [];
    node.traverse((object) => {
      const primitive = this.objectToPrimitive.get(object);
      if (primitive?.meshIndex === meshIndex) {
        matches.push(object);
      }
    });
    return matches;
  }

  getPickSelection(object: Object3D | null): PickSelection | null {
    const nodeIndex = this.getNodeIndex(object);
    if (nodeIndex === null) {
      return null;
    }
    const primitive = this.getPrimitiveAssociation(object);
    return primitive ? { nodeIndex, ...primitive } : { nodeIndex };
  }
}

function primitiveKey(meshIndex: number, primitiveIndex: number): string {
  return `${meshIndex}:${primitiveIndex}`;
}
