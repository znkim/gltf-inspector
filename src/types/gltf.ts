import type { AnimationClip, BufferGeometry, Camera, Material, Object3D, Texture } from 'three';
import type { AssetBundle } from '../loaders/AssetBundle';
import type { InspectionIndex } from '../inspection/InspectionIndex';
import type { CoordinateAnalysis } from '../inspection/CoordinateAnalyzer';

export type GltfJsonValue = null | boolean | number | string | GltfJsonValue[] | GltfJsonObject;
export type GltfJsonObject = { [key: string]: GltfJsonValue | undefined };

export interface GltfNodeDef extends GltfJsonObject {
  name?: string;
  children?: number[];
  mesh?: number;
  skin?: number;
  matrix?: number[];
  translation?: number[];
  rotation?: number[];
  scale?: number[];
}

export interface GltfAccessorDef extends GltfJsonObject {
  bufferView?: number;
  byteOffset?: number;
  componentType: number;
  normalized?: boolean;
  count: number;
  type: string;
  max?: number[];
  min?: number[];
}

export interface GltfPrimitiveDef extends GltfJsonObject {
  attributes?: Record<string, number>;
  indices?: number;
  material?: number;
  mode?: number;
  extensions?: GltfJsonObject;
}

export interface GltfMeshDef extends GltfJsonObject {
  name?: string;
  primitives?: GltfPrimitiveDef[];
}

export interface GltfMaterialDef extends GltfJsonObject {
  name?: string;
}

export interface SourceGltfDocument {
  json: GltfJsonObject;
  scenes: GltfJsonValue[];
  nodes: GltfNodeDef[];
  meshes: GltfMeshDef[];
  primitives: Array<{ meshIndex: number; primitiveIndex: number; primitive: GltfPrimitiveDef }>;
  accessors: GltfAccessorDef[];
  bufferViews: GltfJsonValue[];
  buffers: GltfJsonValue[];
  materials: GltfMaterialDef[];
  textures: GltfJsonValue[];
  images: GltfJsonValue[];
  samplers: GltfJsonValue[];
  animations: GltfJsonValue[];
  skins: GltfJsonValue[];
  extensionsUsed: string[];
  extensionsRequired: string[];
}

export interface RuntimeGltfScene {
  scene: Object3D;
  scenes: Object3D[];
  animations: AnimationClip[];
  cameras: Camera[];
  decodedGeometries: BufferGeometry[];
  decodedMaterials: Material[];
  decodedTextures: Texture[];
}

export type IssueSeverity = 'error' | 'warning' | 'info' | 'hint';

export interface InspectorIssue {
  id: string;
  severity: IssueSeverity;
  code: string;
  message: string;
  pointer?: string;
  resource?: string;
}

export interface PerformanceMetrics {
  fileSize: number;
  totalResourceSize: number;
  parseTimeMs: number;
  totalLoadTimeMs: number;
  sceneObjectCount: number;
  meshCount: number;
  primitiveCount: number;
  triangleCount: number;
  vertexCount: number;
  drawCalls: number;
  materialCount: number;
  textureCount: number;
  estimatedGeometryMemory: number;
  rendererInfo?: {
    calls: number;
    triangles: number;
    points: number;
    lines: number;
  };
}

export interface ValidationReport {
  errors: number;
  warnings: number;
  infos: number;
  hints: number;
  issues: InspectorIssue[];
}

export interface LoadedAsset {
  bundle: AssetBundle;
  source: SourceGltfDocument;
  runtime: RuntimeGltfScene;
  inspection: InspectionIndex;
  validation: ValidationReport | null;
  coordinateAnalysis: CoordinateAnalysis;
  issues: InspectorIssue[];
  performance: PerformanceMetrics;
  originalModel: Object3D;
}

export type RenderMode =
  | 'pbr'
  | 'vertex-color'
  | 'base-color'
  | 'wireframe'
  | 'triangle-color'
  | 'world-normal'
  | 'eye-normal'
  | 'linear-depth'
  | 'uv-checker'
  | 'material-id'
  | 'node-id';
