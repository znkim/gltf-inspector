import { summarizeBox, worldAabb } from './BoundingBoxInspector';
import { analyzeCoordinates } from './CoordinateAnalyzer';
import { classifyExtension } from './ExtensionInspector';
import { inspectTransform } from './TransformInspector';
import type { LoadedAsset } from '../types/gltf';

export function buildInspectionReport(asset: LoadedAsset) {
  const modelBox = summarizeBox(worldAabb(asset.originalModel));
  return {
    metadata: {
      fileSize: asset.performance.fileSize,
      totalResourceSize: asset.performance.totalResourceSize,
      nodes: asset.source.nodes.length,
      meshes: asset.source.meshes.length,
      materials: asset.source.materials.length,
      textures: asset.source.textures.length
    },
    tile: asset.tile ? {
      key: asset.tile.key,
      containerFormat: asset.tile.info.container.format,
      contentFormat: asset.tile.info.content.format,
      contentIndex: asset.tile.info.contentIndex,
      version: asset.tile.info.content.version,
      byteLength: asset.tile.info.content.byteLength,
      batchLength: asset.tile.info.content.batchLength,
      rtcCenter: asset.tile.info.content.rtcCenter,
      gltfFormat: asset.tile.info.content.gltfFormat,
      gltfUri: asset.tile.info.content.gltfUri,
      featureTable: asset.tile.info.content.featureTable.json,
      batchTableProperties: Object.keys(asset.tile.info.content.batchTable.json),
      instances: asset.tile.instances
    } : null,
    extensions: {
      used: asset.source.extensionsUsed.map((extension) => ({ extension, status: classifyExtension(extension) })),
      required: asset.source.extensionsRequired.map((extension) => ({ extension, status: classifyExtension(extension) }))
    },
    sceneStatistics: {
      objectCount: asset.performance.sceneObjectCount,
      meshCount: asset.performance.meshCount,
      primitiveCount: asset.performance.primitiveCount,
      triangleCount: asset.performance.triangleCount,
      vertexCount: asset.performance.vertexCount
    },
    coordinateAnalysis: analyzeCoordinates(asset.originalModel),
    nodeTransforms: asset.source.nodes.map((node, index) => {
      const object = asset.inspection.nodeToObject.get(index);
      return {
        index,
        name: node.name ?? `Node ${index}`,
        source: {
          matrix: node.matrix ?? null,
          translation: node.translation ?? null,
          rotation: node.rotation ?? null,
          scale: node.scale ?? null
        },
        runtime: object ? inspectTransform(node, object).runtime : null
      };
    }),
    modelBBox: modelBox,
    materialSummary: asset.source.materials.map((material, index) => ({ index, name: material.name ?? null })),
    textureSummary: asset.source.textures.map((texture, index) => ({ index, source: texture })),
    validationSummary: asset.validation,
    performanceSummary: asset.performance,
    warnings: asset.issues.filter((issue) => issue.severity === 'warning' || issue.severity === 'error')
  };
}

export function downloadInspectionReport(asset: LoadedAsset) {
  const report = buildInspectionReport(asset);
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'gltf-inspection-report.json';
  link.click();
  URL.revokeObjectURL(url);
}
