import { Color, MeshBasicMaterial, Texture } from 'three';
import { expect, it } from 'vitest';
import { createBaseColorMaterial } from '../debug-materials/BaseColorDebugMaterial';
import { createVertexColorMaterial } from '../debug-materials/VertexColorDebugMaterial';

it('creates an unlit material that preserves diffuse/base color without textures', () => {
  const texture = new Texture();
  const source = new MeshBasicMaterial({
    color: new Color(0x336699),
    map: texture,
    transparent: true,
    opacity: 0.5,
    vertexColors: true
  });
  const debug = createBaseColorMaterial(source);
  expect(Array.isArray(debug)).toBe(false);
  if (!Array.isArray(debug)) {
    expect(debug.color.getHex()).toBe(0x336699);
    expect(debug.map).toBeNull();
    expect(debug.transparent).toBe(true);
    expect(debug.opacity).toBe(0.5);
    expect(debug.vertexColors).toBe(true);
  }
});

it('uses MeshBasicMaterial for stable vertex color visualization', () => {
  const material = createVertexColorMaterial();
  expect(material.vertexColors).toBe(true);
  expect(material.color.getHex()).toBe(0xffffff);
});
