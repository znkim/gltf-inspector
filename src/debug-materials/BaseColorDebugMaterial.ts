import { Color, MeshBasicMaterial, type Material } from 'three';

export function createBaseColorMaterial(source: Material | Material[]): MeshBasicMaterial | MeshBasicMaterial[] {
  if (Array.isArray(source)) {
    return source.map((material) => createSingleBaseColorMaterial(material));
  }
  return createSingleBaseColorMaterial(source);
}

function createSingleBaseColorMaterial(source: Material): MeshBasicMaterial {
  const materialLike = source as Material & {
    color?: Color;
    alphaTest?: number;
    transparent?: boolean;
    opacity?: number;
    vertexColors?: boolean;
    side?: number;
  };
  return new MeshBasicMaterial({
    name: 'BaseColorDebugMaterial',
    color: materialLike.color?.clone() ?? new Color(0xffffff),
    alphaTest: materialLike.alphaTest ?? 0,
    transparent: materialLike.transparent ?? false,
    opacity: materialLike.opacity ?? 1,
    vertexColors: materialLike.vertexColors ?? false,
    side: materialLike.side
  });
}
