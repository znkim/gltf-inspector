import { ShaderMaterial } from 'three';

export function createLinearDepthMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    name: 'LinearDepthDebugMaterial',
    uniforms: {
      near: { value: 0.1 },
      far: { value: 1000 }
    },
    vertexShader: `
      varying float vDepth;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vDepth = -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float near;
      uniform float far;
      varying float vDepth;
      void main() {
        float d = clamp((vDepth - near) / max(far - near, 0.0001), 0.0, 1.0);
        gl_FragColor = vec4(vec3(d), 1.0);
      }
    `
  });
}
