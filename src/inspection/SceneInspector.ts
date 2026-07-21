import type { Object3D } from 'three';
import type { SourceGltfDocument, GltfJsonObject, GltfJsonValue, GltfMeshDef, GltfNodeDef, GltfAccessorDef, GltfMaterialDef } from '../types/gltf';

export function buildSourceDocument(json: GltfJsonObject): SourceGltfDocument {
  const meshes = readArray<GltfMeshDef>(json.meshes);
  const primitives = meshes.flatMap((mesh, meshIndex) =>
    (mesh.primitives ?? []).map((primitive, primitiveIndex) => ({ meshIndex, primitiveIndex, primitive }))
  );
  return {
    json,
    scenes: readArray(json.scenes),
    nodes: readArray<GltfNodeDef>(json.nodes),
    meshes,
    primitives,
    accessors: readArray<GltfAccessorDef>(json.accessors),
    bufferViews: readArray(json.bufferViews),
    buffers: readArray(json.buffers),
    materials: readArray<GltfMaterialDef>(json.materials),
    textures: readArray(json.textures),
    images: readArray(json.images),
    samplers: readArray(json.samplers),
    animations: readArray(json.animations),
    skins: readArray(json.skins),
    extensionsUsed: readStringArray(json.extensionsUsed),
    extensionsRequired: readStringArray(json.extensionsRequired)
  };
}

export function countObjects(root: Object3D): number {
  let count = 0;
  root.traverse(() => {
    count += 1;
  });
  return count;
}

function readArray<T>(value: GltfJsonValue | undefined): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function readStringArray(value: GltfJsonValue | undefined): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}
