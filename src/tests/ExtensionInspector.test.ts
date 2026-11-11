import { expect, it } from 'vitest';
import { classifyExtension } from '../inspection/ExtensionInspector';

it('classifies supported extension handling status', () => {
  expect(classifyExtension('KHR_draco_mesh_compression')).toBe('decoder');
  expect(classifyExtension('KHR_materials_unlit')).toBe('native');
  expect(classifyExtension('KHR_materials_pbrSpecularGlossiness')).toBe('fallback');
  expect(classifyExtension('VENDOR_unknown')).toBe('unsupported');
  expect(classifyExtension('KHR_gaussian_splatting')).toBe('plugin');
  expect(classifyExtension('EXT_primitive_voxels')).toBe('plugin');
  expect(classifyExtension('KHR_gaussian_splatting_compression_spz_2')).toBe('decoder');
  expect(classifyExtension('KHR_implicit_shapes')).toBe('metadata-only');
});
