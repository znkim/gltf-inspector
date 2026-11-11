import { describe, expect, it } from 'vitest';
import { Matrix4, Vector3 } from 'three';
import { isTileContainerKey, parseTileContainer } from '../loaders/TileFormatParser';
import { applyInstancesToGltf, decodeI3dmInstances, octDecode } from '../loaders/I3dmInstancing';
import { AssetBundle } from '../loaders/AssetBundle';
import { parseGlbJsonChunk } from '../loaders/GlbParser';
import type { GltfJsonObject } from '../types/gltf';

function buildGlb(json: object): Uint8Array {
  const text = JSON.stringify(json);
  const encoded = new TextEncoder().encode(text.padEnd(Math.ceil(text.length / 4) * 4, ' '));
  const bytes = new Uint8Array(20 + encoded.byteLength);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, bytes.byteLength, true);
  view.setUint32(12, encoded.byteLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  bytes.set(encoded, 20);
  return bytes;
}

function paddedJson(value: object | null, align = 8, offset = 0): Uint8Array {
  if (!value) {
    return new Uint8Array(0);
  }
  const text = JSON.stringify(value);
  const length = Math.ceil((offset + text.length) / align) * align - offset;
  return new TextEncoder().encode(text.padEnd(length, ' '));
}

function concat(parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

function buildTile(magic: 'b3dm' | 'i3dm', options: {
  featureJson?: object;
  featureBinary?: Uint8Array;
  batchJson?: object;
  payload: Uint8Array;
  gltfFormat?: number;
}): Uint8Array {
  const headerLength = magic === 'i3dm' ? 32 : 28;
  const featureJson = paddedJson(options.featureJson ?? null, 8, headerLength);
  const featureBinary = options.featureBinary ?? new Uint8Array(0);
  const batchJson = paddedJson(options.batchJson ?? null);
  const header = new Uint8Array(headerLength);
  const view = new DataView(header.buffer);
  header.set(new TextEncoder().encode(magic), 0);
  view.setUint32(4, 1, true);
  const total = headerLength + featureJson.byteLength + featureBinary.byteLength + batchJson.byteLength + options.payload.byteLength;
  view.setUint32(8, total, true);
  view.setUint32(12, featureJson.byteLength, true);
  view.setUint32(16, featureBinary.byteLength, true);
  view.setUint32(20, batchJson.byteLength, true);
  view.setUint32(24, 0, true);
  if (magic === 'i3dm') {
    view.setUint32(28, options.gltfFormat ?? 1, true);
  }
  return concat([header, featureJson, featureBinary, batchJson, options.payload]);
}

function buildCmpt(tiles: Uint8Array[]): Uint8Array {
  const header = new Uint8Array(16);
  const view = new DataView(header.buffer);
  header.set(new TextEncoder().encode('cmpt'), 0);
  view.setUint32(4, 1, true);
  view.setUint32(8, 16 + tiles.reduce((sum, tile) => sum + tile.byteLength, 0), true);
  view.setUint32(12, tiles.length, true);
  return concat([header, ...tiles]);
}

function float32Bytes(values: number[]): Uint8Array {
  return new Uint8Array(new Float32Array(values).buffer);
}

const gltf = { asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, translation: [0, 1, 0] }], meshes: [{ primitives: [] }] };

describe('3D Tiles container parsing', () => {
  it('detects tile container file keys', () => {
    expect(isTileContainerKey('tiles/0/0.B3DM')).toBe(true);
    expect(isTileContainerKey('trees.i3dm')).toBe(true);
    expect(isTileContainerKey('model.glb')).toBe(false);
  });

  it('extracts the GLB and tables from b3dm', () => {
    const glb = buildGlb(gltf);
    const tile = buildTile('b3dm', {
      featureJson: { BATCH_LENGTH: 3, RTC_CENTER: [1, 2, 3] },
      batchJson: { name: ['a', 'b', 'c'] },
      payload: glb
    });
    const parsed = parseTileContainer(tile.buffer);
    expect(parsed.format).toBe('b3dm');
    const content = parsed.contents[0];
    expect(content.batchLength).toBe(3);
    expect(content.rtcCenter).toEqual([1, 2, 3]);
    expect(Object.keys(content.batchTable.json)).toEqual(['name']);
    expect(Array.from(content.gltfBytes ?? [])).toEqual(Array.from(glb));
  });

  it('handles the legacy b3dm header with batchLength', () => {
    const glb = buildGlb(gltf);
    const batchJson = paddedJson({ id: [1, 2] }, 4);
    const header = new Uint8Array(20);
    const view = new DataView(header.buffer);
    header.set(new TextEncoder().encode('b3dm'), 0);
    view.setUint32(4, 1, true);
    view.setUint32(8, 20 + batchJson.byteLength + glb.byteLength, true);
    view.setUint32(12, 2, true);
    view.setUint32(16, batchJson.byteLength, true);
    const content = parseTileContainer(concat([header, batchJson, glb]).buffer).contents[0];
    expect(content.legacyHeader).toBe(true);
    expect(content.batchLength).toBe(2);
    expect(content.batchTable.json.id).toEqual([1, 2]);
  });

  it('reads i3dm with an external glTF uri', () => {
    const tile = buildTile('i3dm', {
      featureJson: { INSTANCES_LENGTH: 1, POSITION: { byteOffset: 0 } },
      featureBinary: float32Bytes([0, 0, 0]),
      payload: new TextEncoder().encode('tree.glb'),
      gltfFormat: 0
    });
    const content = parseTileContainer(tile.buffer).contents[0];
    expect(content.gltfFormat).toBe('uri');
    expect(content.gltfUri).toBe('tree.glb');
    expect(content.instanceCount).toBe(1);
  });

  it('flattens composite tiles', () => {
    const glb = buildGlb(gltf);
    const cmpt = buildCmpt([buildTile('b3dm', { payload: glb }), buildTile('b3dm', { payload: glb })]);
    const parsed = parseTileContainer(cmpt.buffer);
    expect(parsed.format).toBe('cmpt');
    expect(parsed.contents).toHaveLength(2);
  });

  it('rejects embedded glTF 1.0 binaries', () => {
    const glb = buildGlb(gltf);
    new DataView(glb.buffer).setUint32(4, 1, true);
    expect(() => parseTileContainer(buildTile('b3dm', { payload: glb }).buffer)).toThrow(/glTF 1\.0/);
  });
});

describe('i3dm instancing', () => {
  it('decodes positions and converts them into the glTF y-up frame', () => {
    const tile = buildTile('i3dm', {
      featureJson: { INSTANCES_LENGTH: 2, POSITION: { byteOffset: 0 }, SCALE: { byteOffset: 24 } },
      featureBinary: float32Bytes([1, 2, 3, 4, 5, 6, 2, 3]),
      payload: buildGlb(gltf)
    });
    const instances = decodeI3dmInstances(parseTileContainer(tile.buffer).contents[0]);
    expect(instances.count).toBe(2);
    expect(instances.orientation).toBe('identity');
    const position = new Vector3().setFromMatrixPosition(instances.matrices[0]);
    // z-up (1, 2, 3) => y-up (1, 3, -2)
    expect(position.x).toBeCloseTo(1);
    expect(position.y).toBeCloseTo(3);
    expect(position.z).toBeCloseTo(-2);
    expect(new Vector3().setFromMatrixScale(instances.matrices[1]).x).toBeCloseTo(3);
  });

  it('decodes oct-encoded normals', () => {
    const up = octDecode(32767.5, 65535, new Vector3());
    expect(up.y).toBeCloseTo(1, 3);
  });

  it('recenters planetary instance positions', () => {
    const tile = buildTile('i3dm', {
      featureJson: { INSTANCES_LENGTH: 1, POSITION: { byteOffset: 0 }, EAST_NORTH_UP: true },
      featureBinary: float32Bytes([6378137, 0, 0]),
      payload: buildGlb(gltf)
    });
    const instances = decodeI3dmInstances(parseTileContainer(tile.buffer).contents[0]);
    expect(instances.orientation).toBe('east-north-up');
    expect(instances.recenterOffset?.[0]).toBeCloseTo(6378137);
    expect(new Vector3().setFromMatrixPosition(instances.matrices[0]).length()).toBeCloseTo(0);
  });

  it('adds EXT_mesh_gpu_instancing so instance transforms apply around the scene root', () => {
    const json = structuredClone(gltf) as GltfJsonObject;
    const instance = new Matrix4().makeTranslation(10, 0, 0);
    const result = applyInstancesToGltf(json, { count: 1, orientation: 'identity', hasScale: false, recenterOffset: null, matrices: [instance] });
    expect(result.applied).toBe(1);
    expect(json.extensionsUsed).toContain('EXT_mesh_gpu_instancing');
    const node = (json.nodes as GltfJsonObject[])[0];
    const attributes = ((node.extensions as GltfJsonObject).EXT_mesh_gpu_instancing as GltfJsonObject).attributes as Record<string, number>;
    expect(Object.keys(attributes)).toEqual(['TRANSLATION', 'ROTATION', 'SCALE']);
    const buffer = (json.buffers as GltfJsonObject[])[0];
    const base64 = (buffer.uri as string).split(',')[1];
    const floats = new Float32Array(Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)).buffer);
    expect(Array.from(floats.slice(0, 3))).toEqual([10, 0, 0]);
  });
});

describe('AssetBundle tile unwrapping', () => {
  // jsdom's Blob does not implement arrayBuffer().
  if (!('arrayBuffer' in Blob.prototype)) {
    Object.defineProperty(Blob.prototype, 'arrayBuffer', {
      configurable: true,
      value(this: Blob) {
        return new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = () => reject(reader.error);
          reader.readAsArrayBuffer(this);
        });
      }
    });
  }

  it('uses the embedded GLB of a dropped b3dm as the primary asset', async () => {
    const tileBytes = buildTile('b3dm', { featureJson: { BATCH_LENGTH: 0 }, payload: buildGlb(gltf) });
    const bundle = await AssetBundle.fromFileList([new File([tileBytes], 'tile.b3dm')]);
    const primary = bundle.findPrimary();
    expect(primary?.key).toBe('tile.b3dm');
    expect(primary?.size).toBe(tileBytes.byteLength);
    expect(primary?.file.name).toBe('tile.b3dm.glb');
    expect(primary?.tile?.content.format).toBe('b3dm');
    const parsed = parseGlbJsonChunk(await primary!.file.arrayBuffer());
    expect(parsed.json.asset).toEqual({ version: '2.0' });
  });

  it('resolves the external glTF referenced by an i3dm', async () => {
    const tileBytes = buildTile('i3dm', {
      featureJson: { INSTANCES_LENGTH: 1, POSITION: { byteOffset: 0 } },
      featureBinary: float32Bytes([0, 0, 0]),
      payload: new TextEncoder().encode('tree.glb'),
      gltfFormat: 0
    });
    const glbFile = new File([buildGlb(gltf)], 'tree.glb');
    const bundle = await AssetBundle.fromFileList([glbFile, new File([tileBytes], 'trees.i3dm')]);
    const primary = bundle.findPrimary();
    expect(primary?.key).toBe('trees.i3dm');
    expect(primary?.file).toBe(glbFile);
  });
});
