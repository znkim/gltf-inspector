import { Color, DoubleSide, MeshBasicMaterial, ShaderMaterial, type Material, type Texture } from 'three';

type MaterialLike = Material & {
  alphaMap?: Texture | null;
  alphaTest?: number;
  color?: Color;
  map?: Texture | null;
  normalMap?: Texture | null;
  opacity?: number;
  side?: number;
  transparent?: boolean;
  vertexColors?: boolean;
};

export function createUnlitMaterial(source: Material | Material[]): MeshBasicMaterial | MeshBasicMaterial[] {
  if (Array.isArray(source)) {
    return source.map((material) => createSingleUnlitMaterial(material));
  }
  return createSingleUnlitMaterial(source);
}

export function createNormalTextureMaterial(source: Material | Material[]): Material | Material[] {
  if (Array.isArray(source)) {
    return source.map((material) => createSingleNormalTextureMaterial(material));
  }
  return createSingleNormalTextureMaterial(source);
}

export function createFaceOrientationMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    name: 'FaceOrientationDebugMaterial',
    side: DoubleSide,
    toneMapped: false,
    vertexShader: `
      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      void main() {
        vec3 front = vec3(0.18, 0.72, 0.35);
        vec3 back = vec3(0.88, 0.18, 0.16);
        gl_FragColor = vec4(gl_FrontFacing ? front : back, 1.0);
      }
    `
  });
}

export function createUvColorMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    name: 'UvColorDebugMaterial',
    toneMapped: false,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      void main() {
        gl_FragColor = vec4(fract(vUv.x), fract(vUv.y), 0.0, 1.0);
      }
    `
  });
}

function createSingleUnlitMaterial(source: Material): MeshBasicMaterial {
  const materialLike = source as MaterialLike;
  return new MeshBasicMaterial({
    name: 'UnlitDebugMaterial',
    alphaTest: materialLike.alphaTest ?? 0,
    color: materialLike.color?.clone() ?? new Color(0xffffff),
    map: materialLike.map ?? null,
    opacity: materialLike.opacity ?? 1,
    side: materialLike.side,
    toneMapped: false,
    transparent: materialLike.transparent ?? false,
    vertexColors: materialLike.vertexColors ?? false
  });
}

function createSingleNormalTextureMaterial(source: Material): Material {
  const materialLike = source as MaterialLike;
  if (!materialLike.normalMap) {
    return new MeshBasicMaterial({
      name: 'NormalTextureDebugMaterial',
      alphaMap: materialLike.alphaMap ?? null,
      alphaTest: materialLike.alphaTest ?? 0,
      color: 0x4f5f8a,
      map: materialLike.map ?? null,
      opacity: materialLike.opacity ?? 1,
      side: materialLike.side,
      toneMapped: false,
      transparent: materialLike.transparent ?? false
    });
  }
  return new ShaderMaterial({
    name: 'NormalTextureDebugMaterial',
    alphaTest: materialLike.alphaTest ?? 0,
    side: materialLike.side,
    toneMapped: false,
    transparent: materialLike.transparent ?? false,
    uniforms: {
      normalMap: { value: materialLike.normalMap },
      baseColorMap: { value: materialLike.map ?? null },
      alphaMap: { value: materialLike.alphaMap ?? null },
      opacity: { value: materialLike.opacity ?? 1 },
      alphaCutoff: { value: materialLike.alphaTest ?? 0 },
      hasBaseColorMap: { value: Boolean(materialLike.map) },
      hasAlphaMap: { value: Boolean(materialLike.alphaMap) },
      useAlphaBlend: { value: Boolean(materialLike.transparent) }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D normalMap;
      uniform sampler2D baseColorMap;
      uniform sampler2D alphaMap;
      uniform float opacity;
      uniform float alphaCutoff;
      uniform bool hasBaseColorMap;
      uniform bool hasAlphaMap;
      uniform bool useAlphaBlend;
      varying vec2 vUv;
      void main() {
        float alpha = opacity;
        if (hasBaseColorMap) {
          alpha *= texture2D(baseColorMap, vUv).a;
        }
        if (hasAlphaMap) {
          alpha *= texture2D(alphaMap, vUv).r;
        }
        if (alpha <= alphaCutoff) {
          discard;
        }
        vec3 normalTexel = texture2D(normalMap, vUv).rgb;
        gl_FragColor = vec4(normalTexel, useAlphaBlend ? alpha : 1.0);
      }
    `
  });
}
