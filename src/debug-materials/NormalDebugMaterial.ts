import { ShaderMaterial } from 'three';

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
