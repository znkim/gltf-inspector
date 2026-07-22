export type ExtensionStatus = 'native' | 'decoder' | 'plugin' | 'metadata-only' | 'fallback' | 'unsupported';

export interface SupportedExtensionInfo {
  name: string;
  status: ExtensionStatus;
  description: string;
}

export const SUPPORTED_EXTENSIONS: SupportedExtensionInfo[] = [
  { name: 'KHR_draco_mesh_compression', status: 'decoder', description: 'Decoded with DracoLoader.' },
  { name: 'KHR_texture_basisu', status: 'decoder', description: 'Decoded with KTX2Loader / BasisU transcoder.' },
  { name: 'EXT_meshopt_compression', status: 'decoder', description: 'Decoded with meshoptimizer.' },
  { name: 'KHR_meshopt_compression', status: 'decoder', description: 'Decoded with meshoptimizer compatibility handling.' },
  { name: 'KHR_mesh_quantization', status: 'native', description: 'Handled by Three.js GLTFLoader.' },
  { name: 'EXT_mesh_gpu_instancing', status: 'plugin', description: 'Handled by Three.js GLTFLoader plugin.' },
  { name: 'KHR_texture_transform', status: 'plugin', description: 'Handled by Three.js GLTFLoader plugin.' },
  { name: 'KHR_lights_punctual', status: 'plugin', description: 'Handled by Three.js GLTFLoader plugin.' },
  { name: 'KHR_materials_unlit', status: 'native', description: 'Handled by Three.js GLTFLoader.' },
  { name: 'KHR_materials_pbrSpecularGlossiness', status: 'fallback', description: 'Approximated to metallic-roughness for runtime viewing.' },
  { name: 'KHR_materials_clearcoat', status: 'native', description: 'Handled by Three.js GLTFLoader.' },
  { name: 'KHR_materials_transmission', status: 'native', description: 'Handled by Three.js GLTFLoader.' },
  { name: 'KHR_materials_volume', status: 'native', description: 'Handled by Three.js GLTFLoader.' },
  { name: 'KHR_materials_ior', status: 'native', description: 'Handled by Three.js GLTFLoader.' },
  { name: 'KHR_materials_specular', status: 'native', description: 'Handled by Three.js GLTFLoader.' },
  { name: 'KHR_materials_sheen', status: 'native', description: 'Handled by Three.js GLTFLoader.' },
  { name: 'KHR_materials_iridescence', status: 'native', description: 'Handled by Three.js GLTFLoader.' },
  { name: 'KHR_materials_anisotropy', status: 'native', description: 'Handled by Three.js GLTFLoader.' },
  { name: 'KHR_materials_emissive_strength', status: 'native', description: 'Handled by Three.js GLTFLoader.' }
];

const STATUS: Record<string, ExtensionStatus> = Object.fromEntries(SUPPORTED_EXTENSIONS.map((extension) => [extension.name, extension.status]));

export function classifyExtension(extension: string): ExtensionStatus {
  return STATUS[extension] ?? 'unsupported';
}
