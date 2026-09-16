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
  return {
    mode,
    indexed,
    vertexCount,
    indexCount,
    triangleCount: triangleCount(mode, indexed ? indexCount : vertexCount),
    materialIndex: primitive.material ?? null,
    draco: Boolean(primitive.extensions?.KHR_draco_mesh_compression),
    meshopt: Boolean(primitive.extensions?.EXT_meshopt_compression ?? primitive.extensions?.KHR_meshopt_compression),
    quantized: source.extensionsUsed.includes('KHR_mesh_quantization')
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
