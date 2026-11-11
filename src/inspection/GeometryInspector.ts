import type { BufferGeometry } from 'three';
import type { GltfPrimitiveDef, SourceGltfDocument } from '../types/gltf';

export interface PrimitiveStats {
  mode: number;
  indexed: boolean;
  vertexCount: number;
  indexCount: number;
  triangleCount: number;
  materialIndex: number | null;
  draco: boolean;
  meshopt: boolean;
  quantized: boolean;
  representation: 'mesh' | 'points' | 'gaussian-splat' | 'voxel';
  splatCount: number;
  voxelCount: number;
}

export function inspectPrimitive(source: SourceGltfDocument, primitive: GltfPrimitiveDef, geometry?: BufferGeometry): PrimitiveStats {
  const mode = primitive.mode ?? 4;
  const positionAccessor = primitive.attributes?.POSITION;
  // Use source counts consistently with asset totals, even if runtime topology was converted.
  const vertexCount = (positionAccessor !== undefined ? source.accessors[positionAccessor]?.count : undefined)
    ?? geometry?.attributes.position?.count ?? 0;
  const indexed = primitive.indices !== undefined;
  const indexCount = primitive.indices !== undefined
    ? source.accessors[primitive.indices]?.count ?? geometry?.index?.count ?? 0
    : 0;
  const gaussian = Boolean(primitive.extensions?.KHR_gaussian_splatting);
  const voxel = primitive.extensions?.EXT_primitive_voxels;
  const dimensions = objectValue(voxel)?.dimensions;
  const voxelCount = Array.isArray(dimensions) && dimensions.length === 3 &&
    dimensions.every((value) => typeof value === 'number' && value > 0)
    ? dimensions.reduce<number>((product, value) => product * Number(value), 1)
    : 0;
  const representation = voxel ? 'voxel' : gaussian ? 'gaussian-splat' : mode === 0 ? 'points' : 'mesh';
  return {
    mode,
    indexed,
    vertexCount,
    indexCount,
    triangleCount: triangleCount(mode, indexed ? indexCount : vertexCount),
    materialIndex: primitive.material ?? null,
    draco: Boolean(primitive.extensions?.KHR_draco_mesh_compression),
    meshopt: Boolean(primitive.extensions?.EXT_meshopt_compression ?? primitive.extensions?.KHR_meshopt_compression),
    quantized: source.extensionsUsed.includes('KHR_mesh_quantization'),
    representation,
    splatCount: gaussian ? vertexCount : 0,
    voxelCount
  };
}

export function triangleCount(mode: number, elementCount: number): number {
  switch (mode) {
    case 4:
      return Math.floor(elementCount / 3);
    case 5:
    case 6:
      return Math.max(0, elementCount - 2);
    default:
      return 0;
  }
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
