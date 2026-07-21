import type { GltfJsonObject } from '../types/gltf';

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK_TYPE = 0x4e4f534a;
const BIN_CHUNK_TYPE = 0x004e4942;

export interface GlbParseResult {
  json: GltfJsonObject;
  binaryChunk: Uint8Array | null;
  version: number;
  length: number;
}

export function parseGlbJsonChunk(buffer: ArrayBuffer): GlbParseResult {
  const view = new DataView(buffer);
  if (view.byteLength < 20) {
    throw new Error('GLB is too small to contain a valid header and JSON chunk.');
  }
  const magic = view.getUint32(0, true);
  if (magic !== GLB_MAGIC) {
    throw new Error('Invalid GLB magic.');
  }
  const version = view.getUint32(4, true);
  const length = view.getUint32(8, true);
  const chunkLength = view.getUint32(12, true);
  const chunkType = view.getUint32(16, true);
  if (chunkType !== JSON_CHUNK_TYPE) {
    throw new Error('First GLB chunk is not JSON.');
  }
  const jsonBytes = new Uint8Array(buffer, 20, chunkLength);
  const jsonText = new TextDecoder().decode(jsonBytes).trim();
  let offset = 20 + chunkLength;
  let binaryChunk: Uint8Array | null = null;
  while (offset + 8 <= view.byteLength) {
    const nextChunkLength = view.getUint32(offset, true);
    const nextChunkType = view.getUint32(offset + 4, true);
    const nextChunkStart = offset + 8;
    if (nextChunkType === BIN_CHUNK_TYPE) {
      binaryChunk = new Uint8Array(buffer, nextChunkStart, nextChunkLength);
      break;
    }
    offset = nextChunkStart + nextChunkLength;
  }
  return { json: JSON.parse(jsonText) as GltfJsonObject, binaryChunk, version, length };
}

export async function parseSourceJson(file: File): Promise<GltfJsonObject> {
  if (file.name.toLowerCase().endsWith('.glb')) {
    return parseGlbJsonChunk(await file.arrayBuffer()).json;
  }
  return JSON.parse(await file.text()) as GltfJsonObject;
}
