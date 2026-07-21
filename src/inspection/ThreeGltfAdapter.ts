import type { Object3D } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { InspectionIndex, type GltfAssociation } from './InspectionIndex';

interface LoaderAssociation {
  type?: string;
  index?: number;
  nodes?: number;
  meshes?: number;
  materials?: number;
  textures?: number;
  accessors?: number;
  primitive?: number;
  primitives?: number;
}

interface ParserWithAssociations {
  associations?: Map<object, LoaderAssociation>;
}

export function buildInspectionIndex(gltf: GLTF): InspectionIndex {
  const index = new InspectionIndex();
  const parser = (gltf.parser ?? {}) as ParserWithAssociations;
  const associations = parser.associations;
  if (!associations) {
    return index;
  }

  for (const [target, assoc] of associations.entries()) {
    if (!isObject3D(target)) {
      continue;
    }

    const nodeIndex = assoc.nodes ?? (assoc.type === 'nodes' ? assoc.index : undefined);
    if (nodeIndex !== undefined) {
      index.setNode(target, nodeIndex);
    }

    const meshIndex = assoc.meshes ?? (assoc.type === 'meshes' ? assoc.index : undefined);
    const primitiveIndex = assoc.primitives ?? assoc.primitive;
    if (meshIndex !== undefined && primitiveIndex !== undefined) {
      index.setMeshPrimitive(target, meshIndex, primitiveIndex);
      continue;
    }

    const normalized = normalizeLoaderAssociation(assoc);
    if (normalized) {
      index.objectAssociations.set(target, {
        type: normalized.type,
        index: normalized.index,
        primitive: primitiveIndex
      });
    }
  }
  return index;
}

function isObject3D(value: object): value is Object3D {
  return 'isObject3D' in value;
}

function normalizeType(type: string): GltfAssociation['type'] {
  if (type === 'nodes' || type === 'meshes' || type === 'materials' || type === 'textures' || type === 'accessors') {
    return type;
  }
  return 'unknown';
}

function normalizeLoaderAssociation(assoc: LoaderAssociation): GltfAssociation | null {
  if (assoc.type && assoc.index !== undefined) {
    return { type: normalizeType(assoc.type), index: assoc.index, primitive: assoc.primitive ?? assoc.primitives };
  }
  if (assoc.meshes !== undefined) {
    return { type: 'meshes', index: assoc.meshes, primitive: assoc.primitives };
  }
  if (assoc.materials !== undefined) {
    return { type: 'materials', index: assoc.materials };
  }
  if (assoc.textures !== undefined) {
    return { type: 'textures', index: assoc.textures };
  }
  if (assoc.accessors !== undefined) {
    return { type: 'accessors', index: assoc.accessors };
  }
  return null;
}
