import type { GltfJsonObject, GltfJsonValue } from '../types/gltf';

export type TileContentFormat = 'b3dm' | 'i3dm';
export type TileContainerFormat = TileContentFormat | 'cmpt';

const TILE_EXTENSIONS = ['.b3dm', '.i3dm', '.cmpt'];
const GLB_MAGIC = 0x46546c67;
// Legacy b3dm headers place the glTF magic where the newer header stores table lengths.
const LEGACY_HEADER_THRESHOLD = 570425344;

export interface TileTableInfo {
  json: GltfJsonObject;
  binary: Uint8Array;
}

export interface TileContentInfo {
  format: TileContentFormat;
  version: number;
  byteLength: number;
  legacyHeader: boolean;
  featureTable: TileTableInfo;
  batchTable: TileTableInfo;
  batchLength: number | null;
  rtcCenter: [number, number, number] | null;
  gltfFormat: 'embedded' | 'uri';
  gltfUri: string | null;
  gltfBytes: Uint8Array | null;
  instanceCount: number | null;
}

export interface TileContainerInfo {
  format: TileContainerFormat;
  version: number;
  byteLength: number;
  contents: TileContentInfo[];
  skippedInnerTiles: string[];
}

export function isTileContainerKey(key: string): boolean {
  const lower = key.toLowerCase();
  return TILE_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

export function parseTileContainer(buffer: ArrayBuffer): TileContainerInfo {
  const bytes = new Uint8Array(buffer);
  const magic = readMagic(bytes, 0);
  const view = new DataView(buffer);
  if (bytes.byteLength < 12) {
    throw new Error('3D Tiles content is too small to contain a header.');
  }
  const version = view.getUint32(4, true);
  const byteLength = view.getUint32(8, true);
  const skippedInnerTiles: string[] = [];
  const contents: TileContentInfo[] = [];
  if (magic === 'b3dm' || magic === 'i3dm' || magic === 'cmpt') {
    collectContents(bytes, contents, skippedInnerTiles);
  } else {
    throw new Error(`Unsupported 3D Tiles magic: ${JSON.stringify(magic)}`);
  }
  return { format: magic, version, byteLength, contents, skippedInnerTiles };
}

function collectContents(bytes: Uint8Array, contents: TileContentInfo[], skipped: string[]) {
  const magic = readMagic(bytes, 0);
  if (magic === 'b3dm') {
    contents.push(parseB3dm(bytes));
  } else if (magic === 'i3dm') {
    contents.push(parseI3dm(bytes));
  } else if (magic === 'cmpt') {
    const view = viewOf(bytes);
    if (bytes.byteLength < 16) {
      throw new Error('cmpt header is truncated.');
    }
    const tilesLength = view.getUint32(12, true);
    let offset = 16;
    for (let index = 0; index < tilesLength; index++) {
      if (offset + 12 > bytes.byteLength) {
        throw new Error(`cmpt inner tile ${index} is truncated.`);
      }
      const innerLength = view.getUint32(offset + 8, true);
      if (innerLength < 12 || offset + innerLength > bytes.byteLength) {
        throw new Error(`cmpt inner tile ${index} has an invalid byteLength (${innerLength}).`);
      }
      collectContents(bytes.subarray(offset, offset + innerLength), contents, skipped);
      offset += innerLength;
    }
  } else {
    skipped.push(magic);
  }
}

function parseB3dm(bytes: Uint8Array): TileContentInfo {
  const view = viewOf(bytes);
  if (bytes.byteLength < 28) {
    throw new Error('b3dm header is truncated.');
  }
  const version = view.getUint32(4, true);
  const byteLength = view.getUint32(8, true);
  let featureTableJsonLength = view.getUint32(12, true);
  let featureTableBinaryLength = view.getUint32(16, true);
  let batchTableJsonLength = view.getUint32(20, true);
  let batchTableBinaryLength = view.getUint32(24, true);
  let offset = 28;
  let legacyBatchLength: number | null = null;
  let legacyHeader = false;
  if (batchTableJsonLength >= LEGACY_HEADER_THRESHOLD) {
    // [batchLength, batchTableByteLength]
    offset = 20;
    legacyBatchLength = featureTableJsonLength;
    batchTableJsonLength = featureTableBinaryLength;
    batchTableBinaryLength = 0;
    featureTableJsonLength = 0;
    featureTableBinaryLength = 0;
    legacyHeader = true;
  } else if (batchTableBinaryLength >= LEGACY_HEADER_THRESHOLD) {
    // [batchLength, batchTableJsonByteLength, batchTableBinaryByteLength]
    offset = 24;
    legacyBatchLength = batchTableJsonLength;
    batchTableJsonLength = featureTableJsonLength;
    batchTableBinaryLength = featureTableBinaryLength;
    featureTableJsonLength = 0;
    featureTableBinaryLength = 0;
    legacyHeader = true;
  }
  const tables = readTables(bytes, offset, featureTableJsonLength, featureTableBinaryLength, batchTableJsonLength, batchTableBinaryLength);
  const gltfBytes = bytes.subarray(tables.end, Math.min(byteLength, bytes.byteLength));
  assertGlb(gltfBytes, 'b3dm');
  const batchLength = legacyBatchLength ?? numberValue(tables.featureTable.json.BATCH_LENGTH);
  return {
    format: 'b3dm',
    version,
    byteLength,
    legacyHeader,
    featureTable: tables.featureTable,
    batchTable: tables.batchTable,
    batchLength,
    rtcCenter: readGlobalVec3(tables.featureTable, 'RTC_CENTER'),
    gltfFormat: 'embedded',
    gltfUri: null,
    gltfBytes,
    instanceCount: null
  };
}

function parseI3dm(bytes: Uint8Array): TileContentInfo {
  const view = viewOf(bytes);
  if (bytes.byteLength < 32) {
    throw new Error('i3dm header is truncated.');
  }
  const version = view.getUint32(4, true);
  const byteLength = view.getUint32(8, true);
  const tables = readTables(
    bytes,
    32,
    view.getUint32(12, true),
    view.getUint32(16, true),
    view.getUint32(20, true),
    view.getUint32(24, true)
  );
  const gltfFormatValue = view.getUint32(28, true);
  const payload = bytes.subarray(tables.end, Math.min(byteLength, bytes.byteLength));
  const instanceCount = numberValue(tables.featureTable.json.INSTANCES_LENGTH);
  const base = {
    format: 'i3dm' as const,
    version,
    byteLength,
    legacyHeader: false,
    featureTable: tables.featureTable,
    batchTable: tables.batchTable,
    batchLength: instanceCount,
    rtcCenter: readGlobalVec3(tables.featureTable, 'RTC_CENTER'),
    instanceCount
  };
  if (gltfFormatValue === 0) {
    const uri = new TextDecoder().decode(payload).replace(/\0+$/, '').trim();
    return { ...base, gltfFormat: 'uri', gltfUri: uri, gltfBytes: null };
  }
  if (gltfFormatValue !== 1) {
    throw new Error(`i3dm gltfFormat must be 0 (uri) or 1 (embedded), got ${gltfFormatValue}.`);
  }
  assertGlb(payload, 'i3dm');
  return { ...base, gltfFormat: 'embedded', gltfUri: null, gltfBytes: payload };
}

function readTables(
  bytes: Uint8Array,
  start: number,
  featureJsonLength: number,
  featureBinaryLength: number,
  batchJsonLength: number,
  batchBinaryLength: number
) {
  let offset = start;
  const take = (length: number, label: string) => {
    if (offset + length > bytes.byteLength) {
      throw new Error(`${label} exceeds the tile byte length.`);
    }
    const slice = bytes.subarray(offset, offset + length);
    offset += length;
    return slice;
  };
  const featureJson = parseTableJson(take(featureJsonLength, 'Feature table JSON'), 'Feature table');
  const featureBinary = take(featureBinaryLength, 'Feature table binary');
  const batchJson = parseTableJson(take(batchJsonLength, 'Batch table JSON'), 'Batch table');
  const batchBinary = take(batchBinaryLength, 'Batch table binary');
  return {
    featureTable: { json: featureJson, binary: featureBinary },
    batchTable: { json: batchJson, binary: batchBinary },
    end: offset
  };
}

function parseTableJson(bytes: Uint8Array, label: string): GltfJsonObject {
  if (bytes.byteLength === 0) {
    return {};
  }
  const text = new TextDecoder().decode(bytes).replace(/\0+$/, '').trim();
  if (text.length === 0) {
    return {};
  }
  try {
    const parsed = JSON.parse(text) as GltfJsonValue;
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    throw new Error(`${label} JSON could not be parsed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assertGlb(bytes: Uint8Array, label: string) {
  if (bytes.byteLength < 12 || viewOf(bytes).getUint32(0, true) !== GLB_MAGIC) {
    throw new Error(`${label} does not contain an embedded GLB payload.`);
  }
  const version = viewOf(bytes).getUint32(4, true);
  if (version !== 2) {
    throw new Error(`${label} embeds glTF ${version}.0 binary; only glTF 2.0 is supported.`);
  }
}

export function readGlobalVec3(table: TileTableInfo, name: string): [number, number, number] | null {
  const value = table.json[name];
  if (Array.isArray(value) && value.length >= 3 && value.every((entry) => typeof entry === 'number')) {
    return [value[0], value[1], value[2]];
  }
  const offset = binaryOffset(value);
  if (offset === null || offset + 12 > table.binary.byteLength) {
    return null;
  }
  const view = viewOf(table.binary);
  return [view.getFloat32(offset, true), view.getFloat32(offset + 4, true), view.getFloat32(offset + 8, true)];
}

export function binaryOffset(value: GltfJsonValue | undefined): number | null {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return numberValue(value.byteOffset) ?? 0;
  }
  return null;
}

function readMagic(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + 4));
}

function viewOf(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function numberValue(value: GltfJsonValue | undefined): number | null {
  return typeof value === 'number' ? value : null;
}
