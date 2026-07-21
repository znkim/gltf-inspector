import { MeshBasicMaterial } from 'three';

export function createVertexColorMaterial(): MeshBasicMaterial {
  return new MeshBasicMaterial({
    name: 'VertexColorDebugMaterial',
    color: 0xffffff,
    vertexColors: true
  });
}
