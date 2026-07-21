import type { BufferAttribute, BufferGeometry, Object3D } from 'three';
import type { GltfJsonObject, GltfJsonValue, GltfMaterialDef, GltfPrimitiveDef, LoadedAsset } from '../types/gltf';
import type { PrimitiveSelection } from '../state/selectionStore';

export interface UvPoint {
  u: number;
  v: number;
}

export interface UvTriangle {
  points: [UvPoint, UvPoint, UvPoint];
}

export interface UvBounds {
  min: UvPoint;
  max: UvPoint;
}

export interface TextureSlotMapping {
  slot: string;
  textureIndex: number;
  texCoord: number;
  uvAttributeName: string;
  uvCount: number;
  bounds: UvBounds;
  triangles: UvTriangle[];
  truncated: boolean;
}

export const UV_TRIANGLE_PREVIEW_LIMIT = 1024;

export function inspectSelectedPrimitiveUvMapping(asset: LoadedAsset, selection: PrimitiveSelection | null): TextureSlotMapping[] {
  if (!selection) {
    return [];
  }
  const primitive = asset.source.meshes[selection.meshIndex]?.primitives?.[selection.primitiveIndex];
  if (!primitive) {
    return [];
  }
  const material = primitive.material !== undefined ? asset.source.materials[primitive.material] : undefined;
  if (!material) {
    return [];
  }
  const object = asset.inspection.getPrimitiveObject(selection.nodeIndex, selection.meshIndex, selection.primitiveIndex);
  const geometry = getGeometry(object);
  if (!geometry) {
    return [];
  }
  return inspectPrimitiveUvMapping(geometry, primitive, material);
}

export function inspectPrimitiveUvMapping(
  geometry: BufferGeometry,
  primitive: GltfPrimitiveDef,
  material: GltfMaterialDef
): TextureSlotMapping[] {
  return collectTextureSlots(material).flatMap((slot) => {
    const uvAttributeName = getUvAttributeName(slot.texCoord);
    const uvAttribute = geometry.getAttribute(uvAttributeName) as BufferAttribute | undefined;
    if (!uvAttribute) {
      return [];
    }
    const triangles = buildUvTriangles(geometry, uvAttribute, primitive.mode ?? 4);
    const bounds = computeUvBounds(uvAttribute);
    return [{
      slot: slot.slot,
      textureIndex: slot.textureIndex,
      texCoord: slot.texCoord,
      uvAttributeName,
      uvCount: uvAttribute.count,
      bounds,
      triangles,
      truncated: triangles.length > UV_TRIANGLE_PREVIEW_LIMIT
    }];
  });
}

export function collectTextureSlots(material: GltfMaterialDef): Array<{ slot: string; textureIndex: number; texCoord: number }> {
  const slots: Array<{ slot: string; textureIndex: number; texCoord: number }> = [];
  const pbr = objectValue(material.pbrMetallicRoughness);
  addTextureSlot(slots, 'baseColorTexture', objectValue(pbr?.baseColorTexture));
  addTextureSlot(slots, 'metallicRoughnessTexture', objectValue(pbr?.metallicRoughnessTexture));
  addTextureSlot(slots, 'normalTexture', objectValue(material.normalTexture));
  addTextureSlot(slots, 'occlusionTexture', objectValue(material.occlusionTexture));
  addTextureSlot(slots, 'emissiveTexture', objectValue(material.emissiveTexture));
  return slots;
}

export function getUvAttributeName(texCoord: number): string {
  return texCoord === 0 ? 'uv' : `uv${texCoord}`;
}

function addTextureSlot(slots: Array<{ slot: string; textureIndex: number; texCoord: number }>, slot: string, textureInfo: GltfJsonObject | null) {
  const textureIndex = numberValue(textureInfo?.index);
  if (textureIndex === null) {
    return;
  }
  slots.push({
    slot,
    textureIndex,
    texCoord: numberValue(textureInfo?.texCoord) ?? 0
  });
}

function buildUvTriangles(geometry: BufferGeometry, uvAttribute: BufferAttribute, mode: number): UvTriangle[] {
  if (mode !== 4) {
    return [];
  }
  const index = geometry.index;
  const elementCount = index?.count ?? uvAttribute.count;
  const triangles: UvTriangle[] = [];
  for (let elementIndex = 0; elementIndex + 2 < elementCount; elementIndex += 3) {
    const a = index?.getX(elementIndex) ?? elementIndex;
    const b = index?.getX(elementIndex + 1) ?? elementIndex + 1;
    const c = index?.getX(elementIndex + 2) ?? elementIndex + 2;
    triangles.push({
      points: [readUv(uvAttribute, a), readUv(uvAttribute, b), readUv(uvAttribute, c)]
    });
  }
  return triangles;
}

function computeUvBounds(uvAttribute: BufferAttribute): UvBounds {
  const min = { u: Number.POSITIVE_INFINITY, v: Number.POSITIVE_INFINITY };
  const max = { u: Number.NEGATIVE_INFINITY, v: Number.NEGATIVE_INFINITY };
  for (let index = 0; index < uvAttribute.count; index += 1) {
    const u = uvAttribute.getX(index);
    const v = uvAttribute.getY(index);
    min.u = Math.min(min.u, u);
    min.v = Math.min(min.v, v);
    max.u = Math.max(max.u, u);
    max.v = Math.max(max.v, v);
  }
  return { min, max };
}

function readUv(attribute: BufferAttribute, index: number): UvPoint {
  return { u: attribute.getX(index), v: attribute.getY(index) };
}

function getGeometry(object: Object3D | null): BufferGeometry | null {
  return ((object as Object3D & { geometry?: BufferGeometry } | null)?.geometry) ?? null;
}

function objectValue(value: GltfJsonValue | undefined): GltfJsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function numberValue(value: GltfJsonValue | undefined): number | null {
  return typeof value === 'number' ? value : null;
}
