import { expect, it } from 'vitest';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { inspectPrimitive, triangleCount } from '../inspection/GeometryInspector';
import { buildSourceDocument } from '../inspection/SceneInspector';

it('counts triangles by primitive mode', () => {
  expect(triangleCount(4, 9)).toBe(3);
  expect(triangleCount(5, 5)).toBe(3);
  expect(triangleCount(6, 5)).toBe(3);
  expect(triangleCount(1, 10)).toBe(0);
});

it('counts each primitive from its accessors even when passed another primitive geometry', () => {
  const source = buildSourceDocument({
    accessors: [
      { componentType: 5126, type: 'VEC3', count: 97 },
      { componentType: 5123, type: 'SCALAR', count: 210 },
      { componentType: 5126, type: 'VEC3', count: 1116 },
      { componentType: 5123, type: 'SCALAR', count: 1674 }
    ],
    meshes: [{ primitives: [
      { attributes: { POSITION: 0 }, indices: 1 },
      { attributes: { POSITION: 2 }, indices: 3 }
    ] }]
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(97 * 3), 3));
  geometry.setIndex(Array(210).fill(0));
  const stats = source.primitives.map(({ primitive }) => inspectPrimitive(source, primitive, geometry));
  expect(stats.map(({ vertexCount, indexCount, triangleCount }) => ({ vertexCount, indexCount, triangleCount })))
    .toEqual([
      { vertexCount: 97, indexCount: 210, triangleCount: 70 },
      { vertexCount: 1116, indexCount: 1674, triangleCount: 558 }
    ]);
  expect(stats.reduce((sum, stat) => sum + stat.vertexCount, 0)).toBe(1213);
  expect(stats.reduce((sum, stat) => sum + stat.triangleCount, 0)).toBe(628);
});

it('does not count converted runtime indices for a non-indexed triangle strip', () => {
  const source = buildSourceDocument({ accessors: [{ componentType: 5126, type: 'VEC3', count: 5 }] });
  const geometry = new BufferGeometry();
  geometry.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4]);
  expect(inspectPrimitive(source, { attributes: { POSITION: 0 }, mode: 5 }, geometry))
    .toMatchObject({ indexed: false, vertexCount: 5, indexCount: 0, triangleCount: 3 });
});

it('counts an empty indexed primitive as zero triangles', () => {
  const source = buildSourceDocument({ accessors: [
    { componentType: 5126, type: 'VEC3', count: 9 },
    { componentType: 5123, type: 'SCALAR', count: 0 }
  ] });
  expect(inspectPrimitive(source, { attributes: { POSITION: 0 }, indices: 1 }))
    .toMatchObject({ indexed: true, vertexCount: 9, indexCount: 0, triangleCount: 0 });
});
