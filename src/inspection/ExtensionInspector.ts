export type ExtensionStatus = 'native' | 'decoder' | 'plugin' | 'metadata-only' | 'fallback' | 'unsupported';

const STATUS: Record<string, ExtensionStatus> = {
  KHR_draco_mesh_compression: 'decoder',
  KHR_texture_basisu: 'decoder',
  EXT_meshopt_compression: 'decoder',
  KHR_meshopt_compression: 'decoder',
  KHR_mesh_quantization: 'native',
  EXT_mesh_gpu_instancing: 'plugin',
  KHR_texture_transform: 'plugin',
  KHR_lights_punctual: 'plugin',
  KHR_materials_unlit: 'native',
  KHR_materials_clearcoat: 'native',
  KHR_materials_transmission: 'native',
  KHR_materials_volume: 'native',
  KHR_materials_ior: 'native',
  KHR_materials_specular: 'native',
  KHR_materials_sheen: 'native',
  KHR_materials_iridescence: 'native',
  KHR_materials_anisotropy: 'native',
  KHR_materials_emissive_strength: 'native'
};

export function classifyExtension(extension: string): ExtensionStatus {
  return STATUS[extension] ?? 'unsupported';
}
