import { expect, it } from 'vitest';
import { prepareRuntimeGltfData } from '../loaders/GltfRuntimeCompatibility';
import type { GltfJsonObject } from '../types/gltf';

it('converts pbrSpecularGlossiness materials to runtime metallic-roughness fallback', async () => {
  const source = {
    asset: { version: '2.0' },
    extensionsUsed: ['KHR_materials_pbrSpecularGlossiness'],
    extensionsRequired: ['KHR_materials_pbrSpecularGlossiness'],
    materials: [{
      extensions: {
        KHR_materials_pbrSpecularGlossiness: {
          diffuseFactor: [0.2, 0.4, 0.6, 0.8],
          diffuseTexture: { index: 1 },
          glossinessFactor: 0.25
        }
      }
    }]
  };
  const bytes = new TextEncoder().encode(JSON.stringify(source));
  const file = {
    name: 'asset.gltf',
    arrayBuffer: () => Promise.resolve(bytes.buffer)
  } as File;
  const result = await prepareRuntimeGltfData(file);
  expect(result.warnings[0]).toContain('KHR_materials_pbrSpecularGlossiness');
  const json = JSON.parse(typeof result.data === 'string' ? result.data : new TextDecoder().decode(result.data)) as GltfJsonObject;
  expect(Array.isArray(json.materials)).toBe(true);
  const materials = json.materials as GltfJsonObject[];
  const material = materials[0];
  const pbr = material.pbrMetallicRoughness as GltfJsonObject;
  expect(json.extensionsRequired).toBeUndefined();
  expect(json.extensionsUsed).toBeUndefined();
  expect(material.extensions).toBeUndefined();
  expect(pbr.baseColorFactor).toEqual([0.2, 0.4, 0.6, 0.8]);
  expect(pbr.baseColorTexture).toEqual({ index: 1 });
  expect(pbr.metallicFactor).toBe(0);
  expect(pbr.roughnessFactor).toBe(0.75);
});
