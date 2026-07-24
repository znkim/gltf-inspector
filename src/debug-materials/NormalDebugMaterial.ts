import { ShaderMaterial, Vector2, type Material, type Texture } from 'three';

type MaterialLike = Material & {
  alphaMap?: Texture | null;
  alphaTest?: number;
  map?: Texture | null;
  normalMap?: Texture | null;
  normalScale?: Vector2;
  opacity?: number;
  side?: number;
  transparent?: boolean;
};

const derivativeExtension = { derivatives: true } as unknown as ShaderMaterial['extensions'];

export function createWorldNormalMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    name: 'WorldNormalDebugMaterial',
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      void main() {
        gl_FragColor = vec4(normalize(vNormal) * 0.5 + 0.5, 1.0);
      }
    `
  });
}

export function createEyeNormalMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    name: 'EyeNormalDebugMaterial',
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      void main() {
        gl_FragColor = vec4(normalize(vNormal) * 0.5 + 0.5, 1.0);
      }
    `
  });
}

export function createWorldNormalMapMaterial(source: Material | Material[]): Material | Material[] {
  if (Array.isArray(source)) {
    return source.map((material) => createSingleNormalMapMaterial(material, 'world'));
  }
  return createSingleNormalMapMaterial(source, 'world');
}

export function createEyeNormalMapMaterial(source: Material | Material[]): Material | Material[] {
  if (Array.isArray(source)) {
    return source.map((material) => createSingleNormalMapMaterial(material, 'eye'));
  }
  return createSingleNormalMapMaterial(source, 'eye');
}

function createSingleNormalMapMaterial(source: Material, space: 'world' | 'eye'): ShaderMaterial {
  const materialLike = source as MaterialLike;
  return new ShaderMaterial({
    name: space === 'world' ? 'WorldNormalMapDebugMaterial' : 'EyeNormalMapDebugMaterial',
    alphaTest: materialLike.alphaTest ?? 0,
    side: materialLike.side,
    toneMapped: false,
    transparent: materialLike.transparent ?? false,
    extensions: derivativeExtension,
    uniforms: {
      normalMap: { value: materialLike.normalMap ?? null },
      baseColorMap: { value: materialLike.map ?? null },
      alphaMap: { value: materialLike.alphaMap ?? null },
      normalScale: { value: materialLike.normalScale?.clone() ?? new Vector2(1, 1) },
      opacity: { value: materialLike.opacity ?? 1 },
      alphaCutoff: { value: materialLike.alphaTest ?? 0 },
      hasNormalMap: { value: Boolean(materialLike.normalMap) },
      hasBaseColorMap: { value: Boolean(materialLike.map) },
      hasAlphaMap: { value: Boolean(materialLike.alphaMap) },
      useAlphaBlend: { value: Boolean(materialLike.transparent) }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vViewPosition;
      varying vec3 vWorldNormal;
      varying vec3 vEyeNormal;
      void main() {
        vUv = uv;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vViewPosition = viewPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vEyeNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D normalMap;
      uniform sampler2D baseColorMap;
      uniform sampler2D alphaMap;
      uniform vec2 normalScale;
      uniform float opacity;
      uniform float alphaCutoff;
      uniform bool hasNormalMap;
      uniform bool hasBaseColorMap;
      uniform bool hasAlphaMap;
      uniform bool useAlphaBlend;
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vViewPosition;
      varying vec3 vWorldNormal;
      varying vec3 vEyeNormal;

      mat3 cotangentFrame(vec3 normal, vec3 position, vec2 uv) {
        vec3 dp1 = dFdx(position);
        vec3 dp2 = dFdy(position);
        vec2 duv1 = dFdx(uv);
        vec2 duv2 = dFdy(uv);
        vec3 dp2perp = cross(dp2, normal);
        vec3 dp1perp = cross(normal, dp1);
        vec3 tangent = dp2perp * duv1.x + dp1perp * duv2.x;
        vec3 bitangent = dp2perp * duv1.y + dp1perp * duv2.y;
        float inverseMax = inversesqrt(max(dot(tangent, tangent), dot(bitangent, bitangent)));
        return mat3(tangent * inverseMax, bitangent * inverseMax, normal);
      }

      vec3 applyNormalMap(vec3 normal, vec3 position) {
        normal = normalize(gl_FrontFacing ? normal : -normal);
        if (!hasNormalMap) {
          return normal;
        }
        vec3 mapNormal = texture2D(normalMap, vUv).xyz * 2.0 - 1.0;
        mapNormal.xy *= normalScale;
        return normalize(cotangentFrame(normal, position, vUv) * mapNormal);
      }

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
        vec3 normal = ${space === 'world' ? 'applyNormalMap(vWorldNormal, vWorldPosition)' : 'applyNormalMap(vEyeNormal, vViewPosition)'};
        gl_FragColor = vec4(normal * 0.5 + 0.5, useAlphaBlend ? alpha : 1.0);
      }
    `
  });
}
