import { Color, DoubleSide, MeshBasicMaterial, ShaderMaterial, type Material, type Texture } from 'three';

type MaterialLike = Material & {
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
      color: 0x4f5f8a,
      side: materialLike.side,
      toneMapped: false
    });
  }
  return new ShaderMaterial({
    name: 'NormalTextureDebugMaterial',
    side: materialLike.side,
    toneMapped: false,
    uniforms: {
      normalMap: { value: materialLike.normalMap }
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
      varying vec2 vUv;
      void main() {
        vec3 normalTexel = texture2D(normalMap, vUv).rgb;
        gl_FragColor = vec4(normalTexel, 1.0);
      }
    `
  });
}
