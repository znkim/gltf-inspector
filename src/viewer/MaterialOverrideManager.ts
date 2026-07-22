import { Color, DoubleSide, Mesh, MeshBasicMaterial, type BufferGeometry, type Material, type Object3D } from 'three';
import type { RenderMode } from '../types/gltf';
import { createLinearDepthMaterial } from '../debug-materials/DepthDebugMaterial';
import { createEyeNormalMaterial, createWorldNormalMaterial } from '../debug-materials/NormalDebugMaterial';
import { createUvCheckerMaterial } from '../debug-materials/UvDebugMaterial';
import { createVertexColorMaterial } from '../debug-materials/VertexColorDebugMaterial';
import { createIdMaterial } from '../debug-materials/IdDebugMaterial';
import type { InspectionIndex } from '../inspection/InspectionIndex';
import { createBaseColorMaterial } from '../debug-materials/BaseColorDebugMaterial';
import { createTriangleColorGeometry, createTriangleColorMaterial } from '../debug-materials/TriangleColorDebugMaterial';
import {
  createFaceOrientationMaterial,
  createNormalTextureMaterial,
  createUnlitMaterial,
  createUvColorMaterial
} from '../debug-materials/SurfaceDebugMaterial';

type MeshTarget = Object3D & { isMesh?: boolean; material: Material | Material[]; geometry?: BufferGeometry };

export class MaterialOverrideManager {
  private readonly original = new Map<Object3D, Material | Material[]>();
  private readonly originalGeometry = new Map<Object3D, BufferGeometry>();
  private readonly overlays: Object3D[] = [];
  private readonly owned: Material[] = [];
  private readonly ownedGeometries: BufferGeometry[] = [];

  apply(root: Object3D, mode: RenderMode, index?: InspectionIndex) {
    this.restore();
    if (mode === 'pbr') {
      return;
    }
    const override = this.createOverride(mode);
    if (!override && !['base-color', 'unlit', 'normal-texture', 'wireframe-white', 'wireframe-overlay', 'triangle-color'].includes(mode)) {
      return;
    }
    if (override) {
      this.owned.push(override);
    }
    const meshes: MeshTarget[] = [];
    root.traverse((object) => {
      const target = object as Object3D & { isMesh?: boolean; material?: Material | Material[]; geometry?: BufferGeometry };
      if (target.isMesh && target.material && !target.userData.inspectorSharedGeometry) {
        meshes.push(target as MeshTarget);
      }
    });
    for (const target of meshes) {
      this.original.set(target, target.material);
      if (mode === 'wireframe-white') {
        const wire = createWhiteWireframeMaterial(target.material);
        if (Array.isArray(wire)) {
          wire.forEach((entry) => this.owned.push(entry));
        } else {
          this.owned.push(wire);
        }
        target.material = wire;
      } else if (mode === 'wireframe-overlay' && target.geometry) {
        const overlayMaterial = createWireframeOverlayMaterial();
        const overlay = new Mesh(target.geometry, overlayMaterial);
        overlay.name = 'InspectorWireframeOverlay';
        overlay.renderOrder = 20;
        overlay.userData.inspectorSharedGeometry = true;
        this.owned.push(overlayMaterial);
        this.overlays.push(overlay);
        target.add(overlay);
      } else if (mode === 'world-normal' && !target.geometry?.attributes?.normal) {
        const noNormal = new MeshBasicMaterial({ color: 0x8a4f4f });
        this.owned.push(noNormal);
        target.material = noNormal;
      } else if (mode === 'eye-normal' && !target.geometry?.attributes?.normal) {
        const noNormal = new MeshBasicMaterial({ color: 0x8a4f4f });
        this.owned.push(noNormal);
        target.material = noNormal;
      } else if ((mode === 'uv-checker' || mode === 'uv-color') && !target.geometry?.attributes?.uv) {
        const noUv = new MeshBasicMaterial({ color: 0x4f5f8a });
        this.owned.push(noUv);
        target.material = noUv;
      } else if (mode === 'vertex-color' && !target.geometry?.attributes?.color) {
        const noColor = new MeshBasicMaterial({ color: 0x6b6f76 });
        this.owned.push(noColor);
        target.material = noColor;
      } else if (mode === 'base-color') {
        const material = createBaseColorMaterial(target.material);
        if (Array.isArray(material)) {
          material.forEach((entry) => this.owned.push(entry));
        } else {
          this.owned.push(material);
        }
        target.material = material;
      } else if (mode === 'unlit') {
        const material = createUnlitMaterial(target.material);
        if (Array.isArray(material)) {
          material.forEach((entry) => this.owned.push(entry));
        } else {
          this.owned.push(material);
        }
        target.material = material;
      } else if (mode === 'normal-texture') {
        const material = createNormalTextureMaterial(target.material);
        if (Array.isArray(material)) {
          material.forEach((entry) => this.owned.push(entry));
        } else {
          this.owned.push(material);
        }
        target.material = material;
      } else if (mode === 'triangle-color' && target.geometry) {
        this.originalGeometry.set(target, target.geometry);
        const geometry = createTriangleColorGeometry(target.geometry);
        const material = createTriangleColorMaterial();
        this.ownedGeometries.push(geometry);
        this.owned.push(material);
        target.geometry = geometry;
        target.material = material;
      } else if (mode === 'material-id') {
        const materialIndex = index?.objectAssociations.get(target)?.index ?? target.id;
        const material = createIdMaterial(materialIndex);
        this.owned.push(material);
        target.material = material;
      } else if (mode === 'node-id') {
        const nodeIndex = index?.getNodeIndex(target) ?? target.id;
        const material = createIdMaterial(nodeIndex);
        this.owned.push(material);
        target.material = material;
      } else {
        target.material = override ?? target.material;
      }
    }
  }

  restore() {
    for (const [object, material] of this.original.entries()) {
      const target = object as Object3D & { material?: Material | Material[]; geometry?: BufferGeometry };
      target.material = material;
      const geometry = this.originalGeometry.get(object);
      if (geometry) {
        target.geometry = geometry;
      }
    }
    this.original.clear();
    this.originalGeometry.clear();
    for (const overlay of this.overlays) {
      overlay.removeFromParent();
    }
    this.overlays.length = 0;
    for (const material of this.owned) {
      material.dispose();
    }
    this.owned.length = 0;
    for (const geometry of this.ownedGeometries) {
      geometry.dispose();
    }
    this.ownedGeometries.length = 0;
  }

  dispose() {
    this.restore();
  }

  private createOverride(mode: RenderMode): Material | null {
    if (mode === 'world-normal') {
      return createWorldNormalMaterial();
    }
    if (mode === 'eye-normal') {
      return createEyeNormalMaterial();
    }
    if (mode === 'linear-depth') {
      return createLinearDepthMaterial();
    }
    if (mode === 'uv-checker') {
      return createUvCheckerMaterial();
    }
    if (mode === 'vertex-color') {
      return createVertexColorMaterial();
    }
    if (mode === 'face-orientation') {
      return createFaceOrientationMaterial();
    }
    if (mode === 'uv-color') {
      return createUvColorMaterial();
    }
    return null;
  }
}

function createWhiteWireframeMaterial(source: Material | Material[]): MeshBasicMaterial | MeshBasicMaterial[] {
  if (Array.isArray(source)) {
    return source.map((material) => createSingleWhiteWireframeMaterial(material));
  }
  return createSingleWhiteWireframeMaterial(source);
}

function createSingleWhiteWireframeMaterial(source: Material): MeshBasicMaterial {
  const materialLike = source as Material & {
    opacity?: number;
    transparent?: boolean;
    side?: number;
  };
  return new MeshBasicMaterial({
    name: 'WireframeWhiteDebugMaterial',
    color: new Color(0xffffff),
    opacity: materialLike.opacity ?? 1,
    side: materialLike.side,
    transparent: materialLike.transparent ?? false,
    wireframe: true
  });
}

function createWireframeOverlayMaterial(): MeshBasicMaterial {
  return new MeshBasicMaterial({
    name: 'WireframeOverlayDebugMaterial',
    color: 0xffffff,
    depthTest: true,
    depthWrite: false,
    opacity: 0.72,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    side: DoubleSide,
    transparent: true,
    wireframe: true
  });
}
