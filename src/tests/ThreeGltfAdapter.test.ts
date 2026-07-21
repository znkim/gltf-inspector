import { describe, expect, it } from 'vitest';
import { Mesh, Object3D, BoxGeometry, MeshBasicMaterial } from 'three';
import { buildInspectionIndex } from '../inspection/ThreeGltfAdapter';

describe('ThreeGltfAdapter', () => {
  it('reads key-based GLTFLoader object associations', () => {
    const node = new Object3D();
    const primitive = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    node.add(primitive);
    const gltf = {
      parser: {
        associations: new Map<object, object>([
          [node, { nodes: 3 }],
          [primitive, { meshes: 4, primitives: 1 }]
        ])
      }
    };

    const index = buildInspectionIndex(gltf as never);

    expect(index.getNodeIndex(primitive)).toBe(3);
    expect(index.getPrimitiveAssociation(primitive)).toEqual({ meshIndex: 4, primitiveIndex: 1 });
    expect(index.getPickSelection(primitive)).toEqual({ nodeIndex: 3, meshIndex: 4, primitiveIndex: 1 });
  });
});
