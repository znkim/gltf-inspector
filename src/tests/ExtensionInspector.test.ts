import { expect, it } from 'vitest';
import { classifyExtension } from '../inspection/ExtensionInspector';

it('classifies supported extension handling status', () => {
  expect(classifyExtension('KHR_draco_mesh_compression')).toBe('decoder');
  expect(classifyExtension('KHR_materials_unlit')).toBe('native');
  expect(classifyExtension('KHR_materials_pbrSpecularGlossiness')).toBe('fallback');
  expect(classifyExtension('VENDOR_unknown')).toBe('unsupported');
});
