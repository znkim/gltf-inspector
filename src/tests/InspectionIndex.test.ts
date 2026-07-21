import { describe, expect, it } from 'vitest';
import { Mesh, Object3D, BoxGeometry, MeshBasicMaterial } from 'three';
import { InspectionIndex } from '../inspection/InspectionIndex';

describe('InspectionIndex', () => {
  it('resolves primitive objects within the selected node instance', () => {
    const index = new InspectionIndex();
    const firstNode = new Object3D();
    const secondNode = new Object3D();
    const firstPrimitive = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    const secondPrimitive = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    firstNode.add(firstPrimitive);
    secondNode.add(secondPrimitive);
    index.setNode(firstNode, 0);
    index.setNode(secondNode, 1);
    index.setMeshPrimitive(firstPrimitive, 2, 0);
    index.setMeshPrimitive(secondPrimitive, 2, 0);

    expect(index.getPrimitiveObject(0, 2, 0)).toBe(firstPrimitive);
    expect(index.getPrimitiveObject(1, 2, 0)).toBe(secondPrimitive);
    expect(index.getMeshPrimitiveObjects(0, 2)).toEqual([firstPrimitive]);
    expect(index.getMeshPrimitiveObjects(1, 2)).toEqual([secondPrimitive]);
  });
});
