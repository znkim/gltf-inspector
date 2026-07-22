import { Mesh, MeshBasicMaterial, BoxGeometry } from 'three';
import { expect, it } from 'vitest';
import { MaterialOverrideManager } from '../viewer/MaterialOverrideManager';

it('applies and restores wireframe mode', () => {
  const original = new MeshBasicMaterial({ color: 0xff0000 });
  const mesh = new Mesh(new BoxGeometry(), original);
  const manager = new MaterialOverrideManager();
  manager.apply(mesh, 'wireframe-white');
  expect(Array.isArray(mesh.material)).toBe(false);
  if (!Array.isArray(mesh.material)) {
    expect(mesh.material.wireframe).toBe(true);
    expect(mesh.material.color.getHex()).toBe(0xffffff);
  }
  manager.restore();
  expect(mesh.material).toBe(original);
});

it('applies and removes wireframe overlay mode without replacing the material', () => {
  const original = new MeshBasicMaterial({ color: 0xff0000 });
  const mesh = new Mesh(new BoxGeometry(), original);
  const manager = new MaterialOverrideManager();
  manager.apply(mesh, 'wireframe-overlay');
  expect(mesh.material).toBe(original);
  expect(mesh.children.some((child) => child.name === 'InspectorWireframeOverlay')).toBe(true);
  manager.restore();
  expect(mesh.material).toBe(original);
  expect(mesh.children.some((child) => child.name === 'InspectorWireframeOverlay')).toBe(false);
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

it('applies unlit mode while preserving base texture material properties', () => {
  const original = new MeshBasicMaterial({ color: 0x44aaee, transparent: true, opacity: 0.5 });
  const mesh = new Mesh(new BoxGeometry(), original);
  const manager = new MaterialOverrideManager();
  manager.apply(mesh, 'unlit');
  expect(mesh.material).not.toBe(original);
  expect(Array.isArray(mesh.material)).toBe(false);
  if (!Array.isArray(mesh.material)) {
    expect(mesh.material.name).toBe('UnlitDebugMaterial');
    expect(mesh.material.color.getHex()).toBe(0x44aaee);
    expect(mesh.material.opacity).toBe(0.5);
  }
  manager.restore();
  expect(mesh.material).toBe(original);
});

it('applies face orientation and uv color shader modes', () => {
  const original = new MeshBasicMaterial({ color: 0xff0000 });
  const mesh = new Mesh(new BoxGeometry(), original);
  const manager = new MaterialOverrideManager();

  manager.apply(mesh, 'face-orientation');
  expect(Array.isArray(mesh.material)).toBe(false);
  if (!Array.isArray(mesh.material)) {
    expect(mesh.material.name).toBe('FaceOrientationDebugMaterial');
  }

  manager.apply(mesh, 'uv-color');
  expect(Array.isArray(mesh.material)).toBe(false);
  if (!Array.isArray(mesh.material)) {
    expect(mesh.material.name).toBe('UvColorDebugMaterial');
  }

  manager.restore();
  expect(mesh.material).toBe(original);
});
