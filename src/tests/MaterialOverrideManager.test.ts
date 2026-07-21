import { Mesh, MeshBasicMaterial, BoxGeometry } from 'three';
import { expect, it } from 'vitest';
import { MaterialOverrideManager } from '../viewer/MaterialOverrideManager';

it('applies and restores wireframe mode', () => {
  const original = new MeshBasicMaterial({ color: 0xff0000 });
  const mesh = new Mesh(new BoxGeometry(), original);
  const manager = new MaterialOverrideManager();
  manager.apply(mesh, 'wireframe');
  expect(Array.isArray(mesh.material)).toBe(false);
  if (!Array.isArray(mesh.material)) {
    expect(mesh.material.wireframe).toBe(true);
    expect(mesh.material.color.getHex()).toBe(0xff0000);
  }
  manager.restore();
  expect(mesh.material).toBe(original);
});

it('applies triangle colors with temporary geometry and restores original geometry', () => {
  const original = new MeshBasicMaterial({ color: 0xff0000 });
  const geometry = new BoxGeometry();
  const mesh = new Mesh(geometry, original);
  const manager = new MaterialOverrideManager();
  manager.apply(mesh, 'triangle-color');
  expect(mesh.geometry).not.toBe(geometry);
  expect(mesh.geometry.getAttribute('color')).toBeDefined();
  expect(Array.isArray(mesh.material)).toBe(false);
  if (!Array.isArray(mesh.material)) {
    expect(mesh.material.vertexColors).toBe(true);
  }
  manager.restore();
  expect(mesh.geometry).toBe(geometry);
  expect(mesh.material).toBe(original);
});
