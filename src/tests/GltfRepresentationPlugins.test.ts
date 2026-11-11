import { expect, it } from 'vitest';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { registerRepresentationPlugins } from '../loaders/GltfRepresentationPlugins';

it('returns null synchronously for regular meshes so GLTFLoader falls back to its own mesh loader', () => {
  const factories: Array<(parser: unknown) => { loadMesh?: (index: number) => unknown }> = [];
  const loader = { register: (factory: (parser: unknown) => { loadMesh?: (index: number) => unknown }) => factories.push(factory) };
  registerRepresentationPlugins(loader as unknown as GLTFLoader);
  const parser = { json: { meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }] }, associations: new Map() };
  const plugins = factories.map((factory) => factory(parser)).filter((plugin) => plugin.loadMesh);
  expect(plugins.length).toBeGreaterThan(0);
  for (const plugin of plugins) {
    expect(plugin.loadMesh?.(0)).toBeNull();
  }
});
