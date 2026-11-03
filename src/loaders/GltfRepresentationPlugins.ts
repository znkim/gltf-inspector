import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Points,
  PointsMaterial,
  ShaderMaterial,
  Vector2,
  type WebGLRenderer
} from 'three';
import type { GltfJsonObject, GltfJsonValue } from '../types/gltf';
import { loadSpz } from 'spz-js';

export const GAUSSIAN_SPLATTING_EXTENSION = 'KHR_gaussian_splatting';
export const VOXEL_EXTENSION = 'EXT_primitive_voxels';
export const VOXEL_PRIMITIVE_MODE = 0x7fffffff;
export const GAUSSIAN_SPZ_EXTENSION = 'KHR_gaussian_splatting_compression_spz_2';

interface LoaderAssociation {
  meshes?: number;
  primitives?: number;
  primitive?: number;
  type?: string;
  index?: number;
}

interface GltfParserLike {
  json: GltfJsonObject;
  associations: Map<object, LoaderAssociation>;
  getDependency(type: 'accessor', index: number): Promise<BufferAttribute>;
  getDependency(type: 'bufferView', index: number): Promise<ArrayBuffer>;
}

interface PrimitiveDef extends GltfJsonObject {
  mode?: number;
  attributes?: Record<string, number>;
  extensions?: GltfJsonObject;
}

interface MeshDef extends GltfJsonObject {
  name?: string;
  primitives?: PrimitiveDef[];
}

const SH_C0 = 0.282095;
const MAX_VOXEL_PREVIEW_POINTS = 250_000;

export function registerRepresentationPlugins(loader: { register(callback: (parser: unknown) => unknown): unknown }) {
  loader.register((parser) => new GaussianSplattingPlugin(parser as GltfParserLike));
  loader.register(() => ({ name: GAUSSIAN_SPZ_EXTENSION }));
  loader.register((parser) => new VoxelPrimitivePlugin(parser as GltfParserLike));
}

class GaussianSplattingPlugin {
  readonly name = GAUSSIAN_SPLATTING_EXTENSION;

  constructor(private readonly parser: GltfParserLike) {}

  async loadMesh(meshIndex: number): Promise<Group | Points | null> {
    const mesh = readArray<MeshDef>(this.parser.json.meshes)[meshIndex];
    const primitives = mesh?.primitives ?? [];
    if (!primitives.some(isGaussianPrimitive)) return null;
    if (!primitives.every(isGaussianPrimitive)) {
      throw new Error('Mixed Gaussian splat and regular primitives in one mesh are not supported.');
    }
    const objects = await Promise.all(primitives.map(async (primitive, primitiveIndex) => {
      const points = await this.createPrimitive(primitive);
      points.name = mesh?.name ?? `Gaussian splat primitive ${primitiveIndex}`;
      this.parser.associations.set(points, { meshes: meshIndex, primitives: primitiveIndex });
      return points;
    }));
    if (objects.length === 1) return objects[0];
    const group = new Group();
    group.name = mesh?.name ?? `Gaussian splat mesh ${meshIndex}`;
    objects.forEach((object) => group.add(object));
    this.parser.associations.set(group, { meshes: meshIndex });
    return group;
  }

  private async createPrimitive(primitive: PrimitiveDef): Promise<Points> {
    const attributes = primitive.attributes ?? {};
    const gaussian = objectValue(primitive.extensions?.[GAUSSIAN_SPLATTING_EXTENSION]) ?? {};
    const compression = objectValue(objectValue(gaussian.extensions)?.KHR_gaussian_splatting_compression_spz_2);
    let position: BufferAttribute | null;
    let scale: BufferAttribute | null;
    let opacity: BufferAttribute | null;
    let sh0: BufferAttribute | null;

    if (typeof compression?.bufferView === 'number') {
      const bytes = await this.parser.getDependency('bufferView', compression.bufferView);
      const cloud = await loadSpz(new Uint8Array(bytes));
      position = new BufferAttribute(cloud.positions, 3);
      scale = new BufferAttribute(cloud.scales.map((value) => Math.exp(value)), 3);
      opacity = new BufferAttribute(cloud.alphas.map(sigmoid), 1);
      sh0 = new BufferAttribute(cloud.colors, 3);
    } else {
      position = await loadAttribute(this.parser, attributes.POSITION);
      scale = await loadAttribute(this.parser, attributes[`${GAUSSIAN_SPLATTING_EXTENSION}:SCALE`]);
      opacity = await loadAttribute(this.parser, attributes[`${GAUSSIAN_SPLATTING_EXTENSION}:OPACITY`]);
      sh0 = await loadAttribute(this.parser, attributes[`${GAUSSIAN_SPLATTING_EXTENSION}:SH_DEGREE_0_COEF_0`]);
    }
    if (!position || !scale || !opacity || !sh0) {
      throw new Error('KHR_gaussian_splatting is missing decoded POSITION, SCALE, OPACITY, or SH degree-0 data.');
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', position);
    geometry.setAttribute('splatScale', scale);
    geometry.setAttribute('splatOpacity', opacity);
    geometry.setAttribute('splatColor', sh0);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const material = createGaussianMaterial();
    const points = new Points(geometry, material);
    points.frustumCulled = false;
    points.userData.inspectorRepresentation = compression ? 'gaussian-splat-spz' : 'gaussian-splat';
    points.onBeforeRender = (renderer: WebGLRenderer) => {
      renderer.getDrawingBufferSize(material.uniforms.viewport.value as Vector2);
    };
    return points;
  }
}

class VoxelPrimitivePlugin {
  readonly name = VOXEL_EXTENSION;

  constructor(private readonly parser: GltfParserLike) {}

  async loadMesh(meshIndex: number): Promise<Group | null> {
    const mesh = readArray<MeshDef>(this.parser.json.meshes)[meshIndex];
    const primitives = mesh?.primitives ?? [];
    if (primitives.length === 0 || !primitives.every(isVoxelPrimitive)) {
      return null;
    }

    const group = new Group();
    group.name = mesh?.name ?? `Voxel mesh ${meshIndex}`;
    await Promise.all(primitives.map(async (primitive, primitiveIndex) => {
      const points = await this.createPrimitive(primitive);
      points.name = `Voxel primitive ${primitiveIndex}`;
      group.add(points);
      this.parser.associations.set(points, { meshes: meshIndex, primitives: primitiveIndex });
    }));
    return group;
  }

  private async createPrimitive(primitive: PrimitiveDef): Promise<Points> {
    const extension = objectValue(primitive.extensions?.[VOXEL_EXTENSION]) ?? {};
    const dimensions = numberTuple(extension.dimensions, [1, 1, 1])
      .map((value) => Math.max(1, Math.floor(value))) as [number, number, number];
    const padding = objectValue(extension.padding);
    const before = numberTuple(padding?.before, [0, 0, 0]);
    const after = numberTuple(padding?.after, [0, 0, 0]);
    const padded = dimensions.map((value, axis) => value + before[axis] + after[axis]) as [number, number, number];
    const total = padded[0] * padded[1] * padded[2];
    const firstAttribute = Object.entries(primitive.attributes ?? {})[0];
    const values = firstAttribute ? await loadAttribute(this.parser, firstAttribute[1]) : null;
    const count = Math.min(total, values?.count ?? total);
    const stride = Math.max(1, Math.ceil(count / MAX_VOXEL_PREVIEW_POINTS));
    const renderedCount = Math.ceil(count / stride);
    const positions = new Float32Array(renderedCount * 3);
    const colors = new Float32Array(renderedCount * 3);
    const range = attributeRange(values, count, stride);

    let output = 0;
    for (let index = 0; index < count; index += stride) {
      const x = index % padded[0];
      const y = Math.floor(index / padded[0]) % padded[1];
      const z = Math.floor(index / (padded[0] * padded[1]));
      positions[output * 3] = (x - before[0] + 0.5) / dimensions[0] - 0.5;
      positions[output * 3 + 1] = (y - before[1] + 0.5) / dimensions[1] - 0.5;
      positions[output * 3 + 2] = (z - before[2] + 0.5) / dimensions[2] - 0.5;
      const value = values ? values.getX(index) : index;
      const t = range.max > range.min ? (value - range.min) / (range.max - range.min) : 0.5;
      const color = voxelColor(t);
      colors.set([color.r, color.g, color.b], output * 3);
      output += 1;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const material = new PointsMaterial({
      size: Math.min(0.04, 0.75 / Math.max(...dimensions)),
      vertexColors: true,
      sizeAttenuation: true
    });
    const points = new Points(geometry, material);
    points.userData.inspectorRepresentation = 'voxel-points';
    points.userData.voxelDimensions = dimensions;
    points.userData.voxelAttribute = firstAttribute?.[0] ?? null;
    points.userData.voxelSampleStride = stride;
    return points;
  }
}

function createGaussianMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { viewport: { value: new Vector2(1, 1) } },
    transparent: true,
    depthWrite: false,
    vertexShader: `
      attribute vec3 splatScale;
      attribute float splatOpacity;
      attribute vec3 splatColor;
      uniform vec2 viewport;
      varying vec3 vColor;
      varying float vOpacity;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float radius = max(max(splatScale.x, splatScale.y), splatScale.z) * 3.0;
        gl_PointSize = clamp(radius * viewport.y / max(0.001, -mvPosition.z), 1.0, 512.0);
        gl_Position = projectionMatrix * mvPosition;
        vColor = max(vec3(0.0), splatColor * ${SH_C0.toFixed(6)} + 0.5);
        vOpacity = clamp(splatOpacity, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vOpacity;
      void main() {
        vec2 centered = gl_PointCoord * 2.0 - 1.0;
        float radius2 = dot(centered, centered);
        if (radius2 > 1.0) discard;
        float alpha = exp(-4.5 * radius2) * vOpacity;
        if (alpha < 0.003) discard;
        gl_FragColor = vec4(vColor * alpha, alpha);
      }
    `
  });
}

function isGaussianPrimitive(primitive: PrimitiveDef): boolean {
  return primitive.mode === 0 && Boolean(objectValue(primitive.extensions?.[GAUSSIAN_SPLATTING_EXTENSION]));
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

function isVoxelPrimitive(primitive: PrimitiveDef): boolean {
  return primitive.mode === VOXEL_PRIMITIVE_MODE && Boolean(objectValue(primitive.extensions?.[VOXEL_EXTENSION]));
}

async function loadAttribute(parser: GltfParserLike, index: number | undefined): Promise<BufferAttribute | null> {
  return index === undefined ? null : parser.getDependency('accessor', index);
}

function attributeRange(attribute: BufferAttribute | null, count: number, stride: number) {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  if (!attribute) {
    return { min: 0, max: Math.max(1, count - 1) };
  }
  for (let index = 0; index < count; index += stride) {
    const value = attribute.getX(index);
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  return { min, max };
}

function voxelColor(value: number): Color {
  return new Color().setHSL((1 - Math.min(1, Math.max(0, value))) * 0.68, 0.85, 0.55);
}

function objectValue(value: GltfJsonValue | undefined): GltfJsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function readArray<T>(value: GltfJsonValue | undefined): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function numberTuple(value: GltfJsonValue | undefined, fallback: [number, number, number]): [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3 ||
      !value.every((entry) => typeof entry === 'number' && Number.isFinite(entry))) {
    return [...fallback];
  }
  return [value[0] as number, value[1] as number, value[2] as number];
}
