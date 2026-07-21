import { describe, expect, it } from 'vitest';
import { Box3, BoxGeometry, Mesh, MeshBasicMaterial, Object3D, Vector3 } from 'three';
import { nodeOwnBox, nodeSubtreeBoxRelative, transformedLocalBoxCorners, worldAabb } from '../inspection/BoundingBoxInspector';

describe('bounding boxes', () => {
  it('computes subtree bbox relative to selected node', () => {
    const root = new Object3D();
    root.position.set(10, 0, 0);
    const child = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial());
    child.position.set(5, 0, 0);
    root.add(child);
    root.updateMatrixWorld(true);
    const box = nodeSubtreeBoxRelative(root);
    expect(box.min.x).toBeCloseTo(4);
    expect(box.max.x).toBeCloseTo(6);
  });

  it('transforms all eight local box corners', () => {
    const corners = transformedLocalBoxCorners(new Box3(new Vector3(0, 0, 0), new Vector3(1, 1, 1)), new Object3D().matrixWorld);
    expect(corners).toHaveLength(8);
    expect(corners[6]?.toArray()).toEqual([1, 1, 1]);
  });

  it('includes own mesh geometry in selected node own bbox', () => {
    const mesh = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial());
    mesh.position.set(3, 0, 0);
    mesh.updateMatrixWorld(true);
    const box = nodeOwnBox(mesh);
    expect(box.min.x).toBeCloseTo(2);
    expect(box.max.x).toBeCloseTo(4);
  });

  it('updates parent transforms before computing world bbox', () => {
    const root = new Object3D();
    const mesh = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial());
    root.add(mesh);
    root.updateMatrixWorld(true);
    root.position.set(10, 0, 0);
    const box = worldAabb(mesh);
    expect(box.min.x).toBeCloseTo(9);
    expect(box.max.x).toBeCloseTo(11);
  });
});
