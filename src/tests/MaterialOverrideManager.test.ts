import { Mesh, MeshBasicMaterial, MeshStandardMaterial, ShaderMaterial, Texture, BoxGeometry } from 'three';
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

it('applies normal map adjusted world and eye normal modes', () => {
  const original = new MeshStandardMaterial({ normalMap: new Texture() });
  const mesh = new Mesh(new BoxGeometry(), original);
  const manager = new MaterialOverrideManager();

  manager.apply(mesh, 'world-normal-map');
  expect(Array.isArray(mesh.material)).toBe(false);
  if (!Array.isArray(mesh.material)) {
    expect(mesh.material.name).toBe('WorldNormalMapDebugMaterial');
  }

  manager.apply(mesh, 'eye-normal-map');
  expect(Array.isArray(mesh.material)).toBe(false);
  if (!Array.isArray(mesh.material)) {
    expect(mesh.material.name).toBe('EyeNormalMapDebugMaterial');
  }

  manager.restore();
  expect(mesh.material).toBe(original);
});

it('preserves alpha mask inputs for normal texture debug modes', () => {
  const original = new MeshStandardMaterial({
    map: new Texture(),
    normalMap: new Texture(),
    opacity: 0.4,
    transparent: true,
    alphaTest: 0.5
  });
  const mesh = new Mesh(new BoxGeometry(), original);
  const manager = new MaterialOverrideManager();

  manager.apply(mesh, 'normal-texture');
  expect(Array.isArray(mesh.material)).toBe(false);
  if (!Array.isArray(mesh.material)) {
    expect(mesh.material.name).toBe('NormalTextureDebugMaterial');
    expect(mesh.material.transparent).toBe(true);
    expect(mesh.material.alphaTest).toBe(0.5);
    expect(mesh.material).toBeInstanceOf(ShaderMaterial);
    const debugMaterial = mesh.material as unknown as ShaderMaterial;
    expect(debugMaterial.uniforms.opacity.value).toBe(0.4);
    expect(debugMaterial.uniforms.hasBaseColorMap.value).toBe(true);
  }

  manager.apply(mesh, 'world-normal-map');
  expect(Array.isArray(mesh.material)).toBe(false);
  if (!Array.isArray(mesh.material)) {
    expect(mesh.material.name).toBe('WorldNormalMapDebugMaterial');
    expect(mesh.material.transparent).toBe(true);
    expect(mesh.material.alphaTest).toBe(0.5);
    expect(mesh.material).toBeInstanceOf(ShaderMaterial);
    const debugMaterial = mesh.material as unknown as ShaderMaterial;
    expect(debugMaterial.uniforms.hasBaseColorMap.value).toBe(true);
  }

  manager.restore();
  expect(mesh.material).toBe(original);
});
