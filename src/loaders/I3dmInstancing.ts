import { Matrix4, Quaternion, Vector3 } from 'three';
import type { GltfJsonObject, GltfJsonValue } from '../types/gltf';
import { binaryOffset, readGlobalVec3 } from './TileFormatParser';
import type { TileContentInfo, TileTableInfo } from './TileFormatParser';

const INSTANCING_EXTENSION = 'EXT_mesh_gpu_instancing';
const FLOAT = 5126;
const WGS84_RADII_SQUARED = new Vector3(6378137.0 ** 2, 6378137.0 ** 2, 6356752.3142451793 ** 2);
// Instances farther than this from the origin are treated as planetary (ECEF) coordinates and recentered.
const RECENTER_THRESHOLD = 1e5;

export type I3dmOrientation = 'identity' | 'normal' | 'oct-encoded' | 'east-north-up';

export interface I3dmInstanceSet {
  count: number;
  orientation: I3dmOrientation;
  hasScale: boolean;
  recenterOffset: [number, number, number] | null;
  /** Instance transforms in the glTF (y-up) frame. */
  matrices: Matrix4[];
}

// glTF content is y-up; 3D Tiles instance transforms are authored in a z-up frame.
const Y_UP_TO_Z_UP = new Matrix4().makeRotationX(Math.PI / 2);
const Z_UP_TO_Y_UP = new Matrix4().makeRotationX(-Math.PI / 2);

export function decodeI3dmInstances(content: TileContentInfo): I3dmInstanceSet {
  const table = content.featureTable;
  const count = content.instanceCount ?? 0;
  const positions = readPositions(table, count);
  const rtc = content.rtcCenter ?? [0, 0, 0];
  const normalUp = readVec3Property(table, 'NORMAL_UP', count) ?? readOctProperty(table, 'NORMAL_UP_OCT32P', count);
  const normalRight = readVec3Property(table, 'NORMAL_RIGHT', count) ?? readOctProperty(table, 'NORMAL_RIGHT_OCT32P', count);
  const eastNorthUp = table.json.EAST_NORTH_UP === true;
  const uniformScale = readFloatProperty(table, 'SCALE', count, 1);
  const nonUniformScale = readFloatProperty(table, 'SCALE_NON_UNIFORM', count, 3);
  const orientation: I3dmOrientation = normalUp && normalRight
    ? table.json.NORMAL_UP !== undefined ? 'normal' : 'oct-encoded'
    : eastNorthUp ? 'east-north-up' : 'identity';

  const center = new Vector3();
  for (let index = 0; index < count; index++) {
    center.x += positions[index * 3];
    center.y += positions[index * 3 + 1];
    center.z += positions[index * 3 + 2];
  }
  if (count > 0) {
    center.divideScalar(count);
  }
  const recenter = center.length() > RECENTER_THRESHOLD;

  const matrices: Matrix4[] = [];
  const position = new Vector3();
  const absolute = new Vector3();
  const right = new Vector3();
  const up = new Vector3();
  const forward = new Vector3();
  const scale = new Vector3();
  const rotation = new Matrix4();
  for (let index = 0; index < count; index++) {
    position.fromArray(positions, index * 3);
    rotation.identity();
    if (orientation === 'normal' || orientation === 'oct-encoded') {
      up.fromArray(normalUp as Float32Array, index * 3).normalize();
      right.fromArray(normalRight as Float32Array, index * 3).normalize();
      forward.crossVectors(right, up).normalize();
      rotation.makeBasis(right, up, forward);
    } else if (orientation === 'east-north-up') {
      absolute.set(position.x + rtc[0], position.y + rtc[1], position.z + rtc[2]);
      eastNorthUpBasis(absolute, rotation);
    }
    if (nonUniformScale) {
      scale.fromArray(nonUniformScale, index * 3);
    } else {
      scale.setScalar(1);
    }
    if (uniformScale) {
      scale.multiplyScalar(uniformScale[index]);
    }
    if (recenter) {
      position.sub(center);
    }
    const tileTransform = new Matrix4().makeTranslation(position.x, position.y, position.z)
      .multiply(rotation)
      .multiply(new Matrix4().makeScale(scale.x, scale.y, scale.z));
    matrices.push(new Matrix4().multiplyMatrices(Z_UP_TO_Y_UP, tileTransform).multiply(Y_UP_TO_Z_UP));
  }
  return {
    count,
    orientation,
    hasScale: Boolean(uniformScale || nonUniformScale),
    recenterOffset: recenter ? [center.x, center.y, center.z] : null,
    matrices
  };
}

/**
 * Adds EXT_mesh_gpu_instancing to every mesh node of the default scene so that the whole model is
 * repeated once per i3dm instance. Instance data is appended as a data-URI buffer.
 */
export function applyInstancesToGltf(json: GltfJsonObject, instances: I3dmInstanceSet): { applied: number; skippedSkinned: number } {
  const nodes = arrayValue(json.nodes);
  const scenes = arrayValue(json.scenes);
  const sceneIndex = typeof json.scene === 'number' ? json.scene : 0;
  const scene = objectValue(scenes[sceneIndex]);
  if (instances.count === 0 || !scene) {
    return { applied: 0, skippedSkinned: 0 };
  }
  const worldMatrices = new Map<number, Matrix4>();
  const visit = (nodeIndex: number, parent: Matrix4) => {
    const node = objectValue(nodes[nodeIndex]);
    if (!node || worldMatrices.has(nodeIndex)) {
      return;
    }
    const world = new Matrix4().multiplyMatrices(parent, localMatrix(node));
    worldMatrices.set(nodeIndex, world);
    for (const child of arrayValue(node.children)) {
      if (typeof child === 'number') {
        visit(child, world);
      }
    }
  };
  for (const root of arrayValue(scene.nodes)) {
    if (typeof root === 'number') {
      visit(root, new Matrix4());
    }
  }

  const targets: Array<{ node: GltfJsonObject; world: Matrix4 }> = [];
  let skippedSkinned = 0;
  for (const [nodeIndex, world] of worldMatrices) {
    const node = objectValue(nodes[nodeIndex]);
    if (!node || typeof node.mesh !== 'number' || objectValue(node.extensions)?.[INSTANCING_EXTENSION]) {
      continue;
    }
    if (typeof node.skin === 'number' || Math.abs(world.determinant()) < 1e-12) {
      skippedSkinned++;
      continue;
    }
    targets.push({ node, world });
  }
  if (targets.length === 0) {
    return { applied: 0, skippedSkinned };
  }

  const count = instances.count;
  const stride = count * 4 * (3 + 4 + 3);
  const data = new Float32Array((stride / 4) * targets.length);
  const buffers = arrayValue(json.buffers);
  const bufferViews = arrayValue(json.bufferViews);
  const accessors = arrayValue(json.accessors);
  const bufferIndex = buffers.length;
  const local = new Matrix4();
  const inverseWorld = new Matrix4();
  const translation = new Vector3();
  const quaternion = new Quaternion();
  const scale = new Vector3();

  targets.forEach(({ node, world }, targetIndex) => {
    inverseWorld.copy(world).invert();
    const base = (stride / 4) * targetIndex;
    const translationOffset = base;
    const rotationOffset = base + count * 3;
    const scaleOffset = base + count * 7;
    for (let index = 0; index < count; index++) {
      // world * local = instance * world  =>  local = world^-1 * instance * world
      local.multiplyMatrices(inverseWorld, instances.matrices[index]).multiply(world);
      local.decompose(translation, quaternion, scale);
      translation.toArray(data, translationOffset + index * 3);
      quaternion.normalize().toArray(data, rotationOffset + index * 4);
      scale.toArray(data, scaleOffset + index * 3);
    }
    const attributes: GltfJsonObject = {};
    const parts: Array<[string, number, number, string]> = [
      ['TRANSLATION', translationOffset, 3, 'VEC3'],
      ['ROTATION', rotationOffset, 4, 'VEC4'],
      ['SCALE', scaleOffset, 3, 'VEC3']
    ];
    for (const [name, floatOffset, components, type] of parts) {
      bufferViews.push({ buffer: bufferIndex, byteOffset: floatOffset * 4, byteLength: count * components * 4 });
      accessors.push({ bufferView: bufferViews.length - 1, componentType: FLOAT, count, type });
      attributes[name] = accessors.length - 1;
    }
    const extensions = objectValue(node.extensions) ?? {};
    extensions[INSTANCING_EXTENSION] = { attributes };
    node.extensions = extensions;
  });

  buffers.push({ byteLength: data.byteLength, uri: `data:application/octet-stream;base64,${toBase64(new Uint8Array(data.buffer))}` });
  json.buffers = buffers;
  json.bufferViews = bufferViews;
  json.accessors = accessors;
  const used = arrayValue(json.extensionsUsed);
  if (!used.includes(INSTANCING_EXTENSION)) {
    used.push(INSTANCING_EXTENSION);
  }
  json.extensionsUsed = used;
  return { applied: targets.length, skippedSkinned };
}

function readPositions(table: TileTableInfo, count: number): Float32Array {
  const direct = readFloatProperty(table, 'POSITION', count, 3);
  if (direct) {
    return direct;
  }
  const quantizedOffset = binaryOffset(table.json.POSITION_QUANTIZED);
  const volumeOffset = readGlobalVec3(table, 'QUANTIZED_VOLUME_OFFSET');
  const volumeScale = readGlobalVec3(table, 'QUANTIZED_VOLUME_SCALE');
  if (quantizedOffset === null || !volumeOffset || !volumeScale) {
    throw new Error('i3dm feature table requires POSITION or POSITION_QUANTIZED with QUANTIZED_VOLUME_OFFSET/SCALE.');
  }
  const quantized = readUint16Array(table, quantizedOffset, count * 3, 'POSITION_QUANTIZED');
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count * 3; index++) {
    const axis = index % 3;
    positions[index] = (quantized[index] / 65535) * volumeScale[axis] + volumeOffset[axis];
  }
  return positions;
}

function readVec3Property(table: TileTableInfo, name: string, count: number): Float32Array | null {
  return readFloatProperty(table, name, count, 3);
}

function readFloatProperty(table: TileTableInfo, name: string, count: number, components: number): Float32Array | null {
  const offset = binaryOffset(table.json[name]);
  if (offset === null) {
    return null;
  }
  const length = count * components;
  if (offset + length * 4 > table.binary.byteLength) {
    throw new Error(`i3dm feature table property ${name} exceeds the binary body.`);
  }
  const view = new DataView(table.binary.buffer, table.binary.byteOffset + offset, length * 4);
  const values = new Float32Array(length);
  for (let index = 0; index < length; index++) {
    values[index] = view.getFloat32(index * 4, true);
  }
  return values;
}

function readOctProperty(table: TileTableInfo, name: string, count: number): Float32Array | null {
  const offset = binaryOffset(table.json[name]);
  if (offset === null) {
    return null;
  }
  const encoded = readUint16Array(table, offset, count * 2, name);
  const output = new Float32Array(count * 3);
  const vector = new Vector3();
  for (let index = 0; index < count; index++) {
    octDecode(encoded[index * 2], encoded[index * 2 + 1], vector).toArray(output, index * 3);
  }
  return output;
}

function readUint16Array(table: TileTableInfo, offset: number, length: number, name: string): Uint16Array {
  if (offset + length * 2 > table.binary.byteLength) {
    throw new Error(`i3dm feature table property ${name} exceeds the binary body.`);
  }
  const view = new DataView(table.binary.buffer, table.binary.byteOffset + offset, length * 2);
  const values = new Uint16Array(length);
  for (let index = 0; index < length; index++) {
    values[index] = view.getUint16(index * 2, true);
  }
  return values;
}

export function octDecode(encodedX: number, encodedY: number, target: Vector3): Vector3 {
  let x = (encodedX / 65535) * 2 - 1;
  let y = (encodedY / 65535) * 2 - 1;
  const z = 1 - (Math.abs(x) + Math.abs(y));
  if (z < 0) {
    const oldX = x;
    x = (1 - Math.abs(y)) * signNotZero(oldX);
    y = (1 - Math.abs(oldX)) * signNotZero(y);
  }
  return target.set(x, y, z).normalize();
}

function signNotZero(value: number): number {
  return value < 0 ? -1 : 1;
}

function eastNorthUpBasis(position: Vector3, target: Matrix4): Matrix4 {
  const up = new Vector3(
    position.x / WGS84_RADII_SQUARED.x,
    position.y / WGS84_RADII_SQUARED.y,
    position.z / WGS84_RADII_SQUARED.z
  ).normalize();
  const east = new Vector3(-position.y, position.x, 0);
  if (east.lengthSq() === 0) {
    east.set(0, 1, 0);
  }
  east.normalize();
  const north = new Vector3().crossVectors(up, east);
  return target.makeBasis(east, north, up);
}

function localMatrix(node: GltfJsonObject): Matrix4 {
  const matrix = arrayValue(node.matrix);
  if (matrix.length === 16 && matrix.every((value) => typeof value === 'number')) {
    return new Matrix4().fromArray(matrix);
  }
  const t = arrayValue(node.translation);
  const r = arrayValue(node.rotation);
  const s = arrayValue(node.scale);
  return new Matrix4().compose(
    t.length === 3 ? new Vector3().fromArray(t as number[]) : new Vector3(),
    r.length === 4 ? new Quaternion().fromArray(r as number[]) : new Quaternion(),
    s.length === 3 ? new Vector3().fromArray(s as number[]) : new Vector3(1, 1, 1)
  );
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.byteLength; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return btoa(binary);
}

function arrayValue(value: GltfJsonValue | undefined): GltfJsonValue[] {
  return Array.isArray(value) ? value : [];
}

function objectValue(value: GltfJsonValue | undefined): GltfJsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
}
