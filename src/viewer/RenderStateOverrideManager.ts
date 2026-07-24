import { DoubleSide, FrontSide, type Material, type Object3D } from 'three';
import type { RenderStateOverrides } from '../types/gltf';

type MeshTarget = Object3D & { isMesh?: boolean; material?: Material | Material[] };

interface OriginalRenderState {
  side: Material['side'];
  depthTest: boolean;
  depthWrite: boolean;
}

export class RenderStateOverrideManager {
  private readonly original = new Map<Material, OriginalRenderState>();

  apply(root: Object3D, overrides: RenderStateOverrides) {
    this.restore();
    if (overrides.doubleSided === 'default' && overrides.depthTest === 'default' && overrides.depthWrite === 'default') {
      return;
    }
    root.traverse((object) => {
      const target = object as MeshTarget;
      if (!target.isMesh || !target.material) {
        return;
      }
      const materials = Array.isArray(target.material) ? target.material : [target.material];
      for (const material of materials) {
        this.remember(material);
        if (overrides.doubleSided === 'enabled') {
          material.side = DoubleSide;
        } else if (overrides.doubleSided === 'disabled') {
          material.side = FrontSide;
        }
        if (overrides.depthTest !== 'default') {
          material.depthTest = overrides.depthTest === 'enabled';
        }
        if (overrides.depthWrite !== 'default') {
          material.depthWrite = overrides.depthWrite === 'enabled';
        }
        material.needsUpdate = true;
      }
    });
  }

  restore() {
    for (const [material, state] of this.original.entries()) {
      material.side = state.side;
      material.depthTest = state.depthTest;
      material.depthWrite = state.depthWrite;
      material.needsUpdate = true;
    }
    this.original.clear();
  }

  dispose() {
    this.restore();
  }

  private remember(material: Material) {
    if (this.original.has(material)) {
      return;
    }
    this.original.set(material, {
      side: material.side,
      depthTest: material.depthTest,
      depthWrite: material.depthWrite
    });
  }
}
