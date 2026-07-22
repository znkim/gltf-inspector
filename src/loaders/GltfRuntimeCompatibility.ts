import type { GltfJsonObject, GltfJsonValue } from '../types/gltf';
import { parseGlbJsonChunk } from './GlbParser';

const SPEC_GLOSS_EXTENSION = 'KHR_materials_pbrSpecularGlossiness';
const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const JSON_CHUNK_TYPE = 0x4e4f534a;
const BIN_CHUNK_TYPE = 0x004e4942;

export interface RuntimeCompatibilityResult {
  data: ArrayBuffer | string;
  warnings: string[];
}

export async function prepareRuntimeGltfData(file: File): Promise<RuntimeCompatibilityResult> {
  const buffer = await file.arrayBuffer();
  if (file.name.toLowerCase().endsWith('.glb')) {
    const parsed = parseGlbJsonChunk(buffer);
    const converted = convertSpecGlossToMetallicRoughness(parsed.json);
    if (!converted.changed) {
      return { data: buffer, warnings: [] };
    }
    return {
      data: buildGlb(parsed.json, parsed.binaryChunk),
      warnings: converted.warnings
    };
  }

  const json = JSON.parse(new TextDecoder().decode(buffer)) as GltfJsonObject;
  const converted = convertSpecGlossToMetallicRoughness(json);
  return {
    data: converted.changed ? JSON.stringify(json) : buffer,
    warnings: converted.warnings
  };
}

function convertSpecGlossToMetallicRoughness(json: GltfJsonObject): { changed: boolean; warnings: string[] } {
  const materials = Array.isArray(json.materials) ? json.materials : [];
  let changed = false;
  for (const materialValue of materials) {
    const material = objectValue(materialValue);
    const extensions = objectValue(material?.extensions);
    const specGloss = objectValue(extensions?.[SPEC_GLOSS_EXTENSION]);
    if (!material || !extensions || !specGloss) {
      continue;
    }
    const pbr = objectValue(material.pbrMetallicRoughness) ?? {};
    if (!material.pbrMetallicRoughness) {
      material.pbrMetallicRoughness = pbr;
    }
    if (pbr.baseColorFactor === undefined && Array.isArray(specGloss.diffuseFactor)) {
      pbr.baseColorFactor = specGloss.diffuseFactor;
    }
    if (pbr.baseColorTexture === undefined && specGloss.diffuseTexture !== undefined) {
      pbr.baseColorTexture = specGloss.diffuseTexture;
    }
    if (pbr.metallicFactor === undefined) {
      pbr.metallicFactor = 0;
    }
    if (pbr.roughnessFactor === undefined && typeof specGloss.glossinessFactor === 'number') {
      pbr.roughnessFactor = clamp01(1 - specGloss.glossinessFactor);
    }
    delete extensions[SPEC_GLOSS_EXTENSION];
    if (Object.keys(extensions).length === 0) {
      delete material.extensions;
    }
    changed = true;
  }
  if (!changed) {
    return { changed: false, warnings: [] };
  }
  removeExtensionName(json, 'extensionsRequired', SPEC_GLOSS_EXTENSION);
  removeExtensionName(json, 'extensionsUsed', SPEC_GLOSS_EXTENSION);
  return {
    changed: true,
    warnings: [`${SPEC_GLOSS_EXTENSION} was approximated to metallic-roughness for runtime viewing.`]
  };
}

function removeExtensionName(json: GltfJsonObject, property: string, extension: string) {
  const values = json[property];
  if (!Array.isArray(values)) {
    return;
  }
  const filtered = values.filter((value) => value !== extension);
  if (filtered.length > 0) {
    json[property] = filtered;
  } else {
    delete json[property];
  }
}

function buildGlb(json: GltfJsonObject, binaryChunk: Uint8Array | null): ArrayBuffer {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const paddedJsonLength = align4(jsonBytes.byteLength);
  const paddedBinLength = binaryChunk ? align4(binaryChunk.byteLength) : 0;
  const totalLength = 12 + 8 + paddedJsonLength + (binaryChunk ? 8 + paddedBinLength : 0);
  const output = new ArrayBuffer(totalLength);
  const view = new DataView(output);
  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, GLB_VERSION, true);
  view.setUint32(8, totalLength, true);
  view.setUint32(12, paddedJsonLength, true);
  view.setUint32(16, JSON_CHUNK_TYPE, true);
  const bytes = new Uint8Array(output);
  bytes.fill(0x20, 20, 20 + paddedJsonLength);
  bytes.set(jsonBytes, 20);
  if (binaryChunk) {
    const binHeader = 20 + paddedJsonLength;
    view.setUint32(binHeader, paddedBinLength, true);
    view.setUint32(binHeader + 4, BIN_CHUNK_TYPE, true);
    bytes.set(binaryChunk, binHeader + 8);
  }
  return output;
}

function align4(value: number): number {
  return (value + 3) & ~3;
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function objectValue(value: GltfJsonValue | undefined): GltfJsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
}
