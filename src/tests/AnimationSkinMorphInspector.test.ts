import { expect, it } from 'vitest';
import { inspectAnimations, inspectMorphTargets, inspectSkins } from '../inspection/AnimationSkinMorphInspector';
import type { SourceGltfDocument } from '../types/gltf';

const source: SourceGltfDocument = {
  json: {},
  scenes: [],
  nodes: [],
  meshes: [],
  primitives: [{
    meshIndex: 0,
    primitiveIndex: 0,
    primitive: {
      targets: [{ POSITION: 1, NORMAL: 2 }]
    }
  }],
  accessors: [],
  bufferViews: [],
  buffers: [],
  materials: [],
  textures: [],
  images: [],
  samplers: [],
  animations: [{
    name: 'Move',
    channels: [{ target: { node: 3, path: 'translation' } }],
    samplers: [{}]
  }],
  skins: [{
    name: 'Armature',
    joints: [1, 2],
    skeleton: 1,
    inverseBindMatrices: 4
  }],
  extensionsUsed: [],
  extensionsRequired: []
};

it('summarizes animations, skins, and morph targets', () => {
  expect(inspectAnimations(source)[0]).toMatchObject({ name: 'Move', channelCount: 1, samplerCount: 1 });
  expect(inspectSkins(source)[0]).toMatchObject({ name: 'Armature', jointCount: 2 });
  expect(inspectMorphTargets(source, null)[0]).toMatchObject({ targetCount: 1, targetAttributes: ['POSITION', 'NORMAL'] });
});
