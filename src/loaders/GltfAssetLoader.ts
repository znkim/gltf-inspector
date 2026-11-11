import { LoadingManager } from 'three';
import type { BufferGeometry, Material, Texture } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { WebGLRenderer } from 'three';
import type { AssetBundle } from './AssetBundle';
import type { BundleFile } from './AssetBundle';
import { dirname } from './UriResolver';
import { parseSourceJson } from './GlbParser';
import { prepareRuntimeGltfData } from './GltfRuntimeCompatibility';
import { buildSourceDocument, countObjects } from '../inspection/SceneInspector';
import { buildInspectionIndex } from '../inspection/ThreeGltfAdapter';
import { classifyExtension } from '../inspection/ExtensionInspector';
import { inspectPrimitive } from '../inspection/GeometryInspector';
import { worldAabb } from '../inspection/BoundingBoxInspector';
import type { InspectorIssue, LoadedAsset, PerformanceMetrics, RuntimeGltfScene, TileSummary } from '../types/gltf';
import { analyzeCoordinates } from '../inspection/CoordinateAnalyzer';
import { validateBundle } from '../validation/ValidationService';
import { registerRepresentationPlugins } from './GltfRepresentationPlugins';
import { decodeI3dmInstances } from './I3dmInstancing';
import type { I3dmInstanceSet } from './I3dmInstancing';

export async function loadGltfAsset(bundle: AssetBundle, renderer: WebGLRenderer): Promise<LoadedAsset> {
  const startedAt = performance.now();
  const primary = bundle.findPrimary();
  if (!primary) {
    throw new Error('No .glb, .gltf, .b3dm, .i3dm or .cmpt file was found in the dropped files.');
  }

  const sourceJson = await parseSourceJson(primary.file);
  const source = buildSourceDocument(sourceJson);
  const issues: InspectorIssue[] = [...bundle.issues];
  for (const extension of source.extensionsRequired) {
    if (classifyExtension(extension) === 'unsupported') {
      issues.push({
        id: `required-${extension}`,
        severity: 'error',
        code: 'UNSUPPORTED_REQUIRED_EXTENSION',
        message: `Required extension is not supported: ${extension}`
      });
    }
  }
  if (source.extensionsUsed.includes('KHR_gaussian_splatting')) {
    issues.push({
      id: 'gaussian-splat-baseline',
      severity: 'info',
      code: 'GAUSSIAN_SPLATTING_BASELINE_RENDERER',
      message: 'Gaussian splats use degree-0 color and screen-space Gaussian falloff; anisotropic rotation, higher-order SH, and camera sorting are not yet applied.'
    });
  }
  if (source.extensionsUsed.includes('EXT_primitive_voxels')) {
    issues.push({
      id: 'voxel-preview-baseline',
      severity: 'info',
      code: 'VOXEL_POINT_PREVIEW',
      message: 'Draft voxel primitives are shown as a sampled Cartesian point preview; implicit cylinder and ellipsoid shapes are retained as metadata only.'
    });
  }
  const { tile, instances } = inspectTile(primary, issues);

  const manager = new LoadingManager();
  manager.setURLModifier((url) => bundle.resolveObjectUrl(url));
  const loader = new GLTFLoader(manager);
  registerRepresentationPlugins(loader);
  const baseUrl = import.meta.env.BASE_URL;
  const draco = new DRACOLoader(manager).setDecoderPath(`${baseUrl}decoders/draco/`);
  const ktx2 = new KTX2Loader(manager).setTranscoderPath(`${baseUrl}decoders/basis/`).detectSupport(renderer);
  loader.setDRACOLoader(draco);
  loader.setKTX2Loader(ktx2);
  loader.setMeshoptDecoder(MeshoptDecoder);

  const parseStartedAt = performance.now();
  const runtimeData = await prepareRuntimeGltfData(primary.file, instances);
  for (const warning of runtimeData.warnings) {
    issues.push({
      id: `runtime-compat-${warning}`,
      severity: 'warning',
      code: 'RUNTIME_EXTENSION_FALLBACK',
      message: warning
    });
  }
  const gltf = await parseWithLoader(loader, primary, runtimeData.data);
  const parseTimeMs = performance.now() - parseStartedAt;
  draco.dispose();
  ktx2.dispose();

  const runtime = buildRuntime(gltf);
  const inspection = buildInspectionIndex(gltf);
  const performanceMetrics = buildPerformanceMetrics(source, runtime, parseTimeMs, performance.now() - startedAt, bundle);
  const coordinateAnalysis = analyzeCoordinates(runtime.scene);
  let validation = null;
  try {
    validation = await validateBundle(bundle);
    issues.push(...validation.issues);
  } catch (error) {
    issues.push({
      id: 'validation-service-failed',
      severity: 'warning',
      code: 'VALIDATION_SERVICE_FAILED',
      message: error instanceof Error ? error.message : String(error)
    });
  }
  const modelBox = worldAabb(runtime.scene);
  if (modelBox.isEmpty()) {
    issues.push({
      id: 'empty-bounds',
      severity: 'warning',
      code: 'EMPTY_WORLD_BOUNDS',
      message: 'Runtime scene produced an empty world bounding box.'
    });
  }

  return {
    bundle,
    tile,
    source,
    runtime,
    inspection,
    validation,
    coordinateAnalysis,
    issues,
    performance: performanceMetrics,
    originalModel: runtime.scene
  };
}

function inspectTile(primary: BundleFile, issues: InspectorIssue[]): { tile: TileSummary | null; instances: I3dmInstanceSet | null } {
  const info = primary.tile;
  if (!info) {
    return { tile: null, instances: null };
  }
  const { content } = info;
  if (content.legacyHeader) {
    issues.push({
      id: 'tile-legacy-header',
      severity: 'warning',
      code: 'TILE_LEGACY_B3DM_HEADER',
      message: 'b3dm uses a deprecated legacy header layout.',
      resource: primary.key
    });
  }
  if (content.rtcCenter) {
    issues.push({
      id: 'tile-rtc-center',
      severity: 'info',
      code: 'TILE_RTC_CENTER',
      message: `Feature table RTC_CENTER (${content.rtcCenter.join(', ')}) is not applied; geometry is shown relative to it.`,
      resource: primary.key
    });
  }
  issues.push({
    id: 'tile-up-axis',
    severity: 'info',
    code: 'TILE_GLTF_Y_UP',
    message: 'Tile glTF is shown in its native y-up frame; the 3D Tiles y-up to z-up rotation and tileset transforms are not applied.',
    resource: primary.key
  });
  let instances: I3dmInstanceSet | null = null;
  if (content.format === 'i3dm') {
    try {
      instances = decodeI3dmInstances(content);
      if (instances.recenterOffset) {
        issues.push({
          id: 'tile-i3dm-recentered',
          severity: 'info',
          code: 'TILE_I3DM_RECENTERED',
          message: `i3dm instance positions were recentered by (${instances.recenterOffset.map((value) => value.toFixed(3)).join(', ')}) for display precision.`,
          resource: primary.key
        });
      }
    } catch (error) {
      issues.push({
        id: 'tile-i3dm-instances-failed',
        severity: 'error',
        code: 'TILE_I3DM_INSTANCES_FAILED',
        message: error instanceof Error ? error.message : String(error),
        resource: primary.key
      });
    }
  }
  const tile: TileSummary = {
    key: primary.key,
    info,
    instances: instances && {
      count: instances.count,
      orientation: instances.orientation,
      hasScale: instances.hasScale,
      recenterOffset: instances.recenterOffset
    }
  };
  return { tile, instances };
}

function parseWithLoader(loader: GLTFLoader, primary: BundleFile, data: ArrayBuffer | string): Promise<GLTF> {
  return new Promise((resolve, reject) => {
    loader.parse(
      data,
      dirname(primary.key),
    (gltf) => {
      resolve(gltf);
    },
    (error) => {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
    );
  });
}

function buildRuntime(gltf: GLTF): RuntimeGltfScene {
  const decodedGeometries = new Set<BufferGeometry>();
  const decodedMaterials = new Set<Material>();
  const decodedTextures = new Set<Texture>();
  gltf.scene.traverse((object) => {
    const geometry = (object as { geometry?: BufferGeometry }).geometry;
    const material = (object as { material?: Material | Material[] }).material;
    if (geometry) {
      decodedGeometries.add(geometry);
    }
    if (Array.isArray(material)) {
      material.forEach((entry) => decodedMaterials.add(entry));
    } else if (material) {
      decodedMaterials.add(material);
    }
  });
  decodedMaterials.forEach((material) => {
    for (const value of Object.values(material)) {
      if (isTexture(value)) {
        decodedTextures.add(value);
      }
    }
  });
  return {
    scene: gltf.scene,
    scenes: gltf.scenes,
    animations: gltf.animations,
    cameras: gltf.cameras,
    decodedGeometries: Array.from(decodedGeometries),
    decodedMaterials: Array.from(decodedMaterials),
    decodedTextures: Array.from(decodedTextures)
  };
}

function isTexture(value: unknown): value is Texture {
  return Boolean(value && typeof value === 'object' && 'isTexture' in value);
}

function buildPerformanceMetrics(
  source: LoadedAsset['source'],
  runtime: RuntimeGltfScene,
  parseTimeMs: number,
  totalLoadTimeMs: number,
  bundle: AssetBundle
): PerformanceMetrics {
  const primitiveStats = source.primitives.map(({ primitive }) => inspectPrimitive(source, primitive));
  const triangleCount = primitiveStats.reduce((sum, stat) => sum + stat.triangleCount, 0);
  const vertexCount = primitiveStats.reduce((sum, stat) => sum + stat.vertexCount, 0);
  const gaussianSplatCount = primitiveStats.reduce((sum, stat) => sum + stat.splatCount, 0);
  const voxelCellCount = primitiveStats.reduce((sum, stat) => sum + stat.voxelCount, 0);
  const estimatedGeometryMemory = runtime.decodedGeometries.reduce((sum, geometry) => {
    let bytes = geometry.index?.array.byteLength ?? 0;
    for (const attribute of Object.values(geometry.attributes)) {
      bytes += attribute.array.byteLength;
    }
    return sum + bytes;
  }, 0);
  return {
    fileSize: bundle.findPrimary()?.size ?? 0,
    totalResourceSize: bundle.totalSize(),
    parseTimeMs,
    totalLoadTimeMs,
    sceneObjectCount: countObjects(runtime.scene),
    meshCount: source.meshes.length,
    primitiveCount: source.primitives.length,
    triangleCount,
    vertexCount,
    gaussianSplatCount,
    voxelCellCount,
    drawCalls: source.primitives.length,
    materialCount: source.materials.length,
    textureCount: source.textures.length,
    estimatedGeometryMemory
  };
}
