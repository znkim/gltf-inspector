import { Color, MeshBasicMaterial, type BufferGeometry, type Material, type Object3D } from 'three';
import type { RenderMode } from '../types/gltf';
import { createLinearDepthMaterial } from '../debug-materials/DepthDebugMaterial';
import { createEyeNormalMaterial, createWorldNormalMaterial } from '../debug-materials/NormalDebugMaterial';
import { createUvCheckerMaterial } from '../debug-materials/UvDebugMaterial';
import { createVertexColorMaterial } from '../debug-materials/VertexColorDebugMaterial';
import { createIdMaterial } from '../debug-materials/IdDebugMaterial';
import type { InspectionIndex } from '../inspection/InspectionIndex';
import { createBaseColorMaterial } from '../debug-materials/BaseColorDebugMaterial';
import { createTriangleColorGeometry, createTriangleColorMaterial } from '../debug-materials/TriangleColorDebugMaterial';

export class MaterialOverrideManager {
  private readonly original = new Map<Object3D, Material | Material[]>();
  private readonly originalGeometry = new Map<Object3D, BufferGeometry>();
  private readonly owned: Material[] = [];
  private readonly ownedGeometries: BufferGeometry[] = [];

  apply(root: Object3D, mode: RenderMode, index?: InspectionIndex) {
    this.restore();
    if (mode === 'pbr') {
      return;
    }
    const override = this.createOverride(mode);
    if (!override && mode !== 'base-color' && mode !== 'wireframe' && mode !== 'triangle-color') {
      return;
    }
    if (override) {
      this.owned.push(override);
    }
    root.traverse((object) => {
      const target = object as Object3D & { isMesh?: boolean; material?: Material | Material[]; geometry?: BufferGeometry };
      if (!target.isMesh || !target.material) {
        return;
      }
      this.original.set(object, target.material);
      if (mode === 'wireframe') {
        const wire = createWireframeMaterial(target.material);
        if (Array.isArray(wire)) {
          wire.forEach((entry) => this.owned.push(entry));
        } else {
          this.owned.push(wire);
        }
        target.material = wire;
      } else if (mode === 'world-normal' && !target.geometry?.attributes?.normal) {
        const noNormal = new MeshBasicMaterial({ color: 0x8a4f4f });
        this.owned.push(noNormal);
        target.material = noNormal;
      } else if (mode === 'eye-normal' && !target.geometry?.attributes?.normal) {
        const noNormal = new MeshBasicMaterial({ color: 0x8a4f4f });
        this.owned.push(noNormal);
        target.material = noNormal;
      } else if (mode === 'uv-checker' && !target.geometry?.attributes?.uv) {
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
      } else if (mode === 'triangle-color' && target.geometry) {
        this.originalGeometry.set(object, target.geometry);
        const geometry = createTriangleColorGeometry(target.geometry);
        const material = createTriangleColorMaterial();
        this.ownedGeometries.push(geometry);
        this.owned.push(material);
        target.geometry = geometry;
        target.material = material;
      } else if (mode === 'material-id') {
        const materialIndex = index?.objectAssociations.get(object)?.index ?? object.id;
        const material = createIdMaterial(materialIndex);
        this.owned.push(material);
        target.material = material;
      } else if (mode === 'node-id') {
        const nodeIndex = index?.getNodeIndex(object) ?? object.id;
        const material = createIdMaterial(nodeIndex);
        this.owned.push(material);
        target.material = material;
      } else {
        target.material = override ?? target.material;
      }
    });
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
    return null;
  }
}

function createWireframeMaterial(source: Material | Material[]): MeshBasicMaterial | MeshBasicMaterial[] {
  if (Array.isArray(source)) {
    return source.map((material) => createSingleWireframeMaterial(material));
  }
  return createSingleWireframeMaterial(source);
}

function createSingleWireframeMaterial(source: Material): MeshBasicMaterial {
  const materialLike = source as Material & {
    color?: Color;
    opacity?: number;
    transparent?: boolean;
    side?: number;
  };
  return new MeshBasicMaterial({
    name: 'WireframeColorDebugMaterial',
    color: materialLike.color?.clone() ?? new Color(0xd7dde3),
    opacity: materialLike.opacity ?? 1,
    side: materialLike.side,
    transparent: materialLike.transparent ?? false,
    wireframe: true
  });
}
