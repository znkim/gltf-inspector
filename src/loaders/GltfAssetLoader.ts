import { LoadingManager } from 'three';
import type { BufferGeometry, Material, Texture } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { WebGLRenderer } from 'three';
import type { AssetBundle } from './AssetBundle';
import { parseSourceJson } from './GlbParser';
import { buildSourceDocument, countObjects } from '../inspection/SceneInspector';
import { buildInspectionIndex } from '../inspection/ThreeGltfAdapter';
import { classifyExtension } from '../inspection/ExtensionInspector';
import { inspectPrimitive } from '../inspection/GeometryInspector';
import { worldAabb } from '../inspection/BoundingBoxInspector';
import type { InspectorIssue, LoadedAsset, PerformanceMetrics, RuntimeGltfScene } from '../types/gltf';
import { analyzeCoordinates } from '../inspection/CoordinateAnalyzer';
import { validateBundle } from '../validation/ValidationService';

export async function loadGltfAsset(bundle: AssetBundle, renderer: WebGLRenderer): Promise<LoadedAsset> {
  const startedAt = performance.now();
  const primary = bundle.findPrimary();
  if (!primary) {
    throw new Error('No .glb or .gltf file was found in the dropped files.');
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

  const manager = new LoadingManager();
  manager.setURLModifier((url) => bundle.resolveObjectUrl(url));
  const loader = new GLTFLoader(manager);
  const baseUrl = import.meta.env.BASE_URL;
  const draco = new DRACOLoader(manager).setDecoderPath(`${baseUrl}decoders/draco/`);
  const ktx2 = new KTX2Loader(manager).setTranscoderPath(`${baseUrl}decoders/basis/`).detectSupport(renderer);
  loader.setDRACOLoader(draco);
  loader.setKTX2Loader(ktx2);
  loader.setMeshoptDecoder(MeshoptDecoder);

  const parseStartedAt = performance.now();
  const gltf = await parseWithLoader(loader, primary.file);
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

function parseWithLoader(loader: GLTFLoader, file: File): Promise<GLTF> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    loader.load(
      url,
      (gltf) => {
        URL.revokeObjectURL(url);
        resolve(gltf);
      },
      undefined,
      (error) => {
        URL.revokeObjectURL(url);
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
    drawCalls: source.primitives.length,
    materialCount: source.materials.length,
    textureCount: source.textures.length,
    estimatedGeometryMemory
  };
}
