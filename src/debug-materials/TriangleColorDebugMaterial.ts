import { BufferAttribute, MeshBasicMaterial, type BufferGeometry } from 'three';

export function createTriangleColorMaterial(): MeshBasicMaterial {
  return new MeshBasicMaterial({
    name: 'TriangleColorDebugMaterial',
    vertexColors: true
  });
}

export function createTriangleColorGeometry(source: BufferGeometry): BufferGeometry {
  const geometry = source.index ? source.toNonIndexed() : source.clone();
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  for (let vertex = 0; vertex < position.count; vertex += 3) {
    const triangle = vertex / 3;
    const color = randomTriangleColor(triangle);
    for (let offset = 0; offset < 3 && vertex + offset < position.count; offset += 1) {
      colors[(vertex + offset) * 3] = color[0];
      colors[(vertex + offset) * 3 + 1] = color[1];
      colors[(vertex + offset) * 3 + 2] = color[2];
    }
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  return geometry;
}

function randomTriangleColor(index: number): [number, number, number] {
  const hue = fract(Math.sin((index + 1) * 12.9898) * 43758.5453);
  return hslToRgb(hue, 0.68, 0.56);
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hueToRgb(p, q, h + 1 / 3), hueToRgb(p, q, h), hueToRgb(p, q, h - 1 / 3)];
}

function hueToRgb(p: number, q: number, t: number): number {
  let value = t;
  if (value < 0) value += 1;
  if (value > 1) value -= 1;
  if (value < 1 / 6) return p + (q - p) * 6 * value;
  if (value < 1 / 2) return q;
  if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
  return p;
}

function fract(value: number): number {
  return value - Math.floor(value);
}
