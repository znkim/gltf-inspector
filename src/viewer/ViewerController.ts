import { Box3, Vector3, type Object3D } from 'three';
import type { EnvironmentMode, LightingMode, LoadedAsset, RenderMode } from '../types/gltf';
import type { PickSelection } from '../inspection/InspectionIndex';
import { CameraController } from './CameraController';
import { HelperManager } from './HelperManager';
import { MaterialOverrideManager } from './MaterialOverrideManager';
import { PickingManager, type PickPointer } from './PickingManager';
import { RendererManager } from './RendererManager';
import { useViewerStore } from '../state/viewerStore';

export class ViewerController {
  readonly rendererManager: RendererManager;
  readonly cameraController: CameraController;
  readonly helpers: HelperManager;
  readonly materialOverrides = new MaterialOverrideManager();
  readonly picking = new PickingManager();
  private animationFrame = 0;
  private asset: LoadedAsset | null = null;
  private fpsFrames = 0;
  private fpsLastTime = performance.now();

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.rendererManager = new RendererManager(canvas);
    this.cameraController = new CameraController(canvas);
    this.helpers = new HelperManager(this.rendererManager.scene);
    useViewerStore.getState().setRuntimeInfo(readRuntimeInfo(this.rendererManager.renderer.getContext()));
    this.animationFrame = requestAnimationFrame(this.animate);
  }

  get renderer() {
    return this.rendererManager.renderer;
  }

  setAsset(asset: LoadedAsset | null) {
    this.materialOverrides.restore();
    if (this.asset) {
      this.rendererManager.displayRoot.remove(this.asset.originalModel);
      disposeRuntime(this.asset.originalModel);
    }
    this.asset = asset;
    if (asset) {
      this.rendererManager.displayRoot.add(asset.originalModel);
      this.cameraController.focus(asset.originalModel);
    }
  }

  setRenderMode(mode: RenderMode) {
    if (this.asset) {
      this.materialOverrides.apply(this.asset.originalModel, mode, this.asset.inspection);
    }
  }

  setBackgroundColor(color: string) {
    this.rendererManager.setBackgroundColor(color);
  }

  setLightingMode(mode: LightingMode) {
    this.rendererManager.setLightingMode(mode);
  }

  setEnvironmentMode(mode: EnvironmentMode) {
    this.rendererManager.setEnvironmentMode(mode);
  }

  setDisplayTransform(recenter: boolean, upAxis: 'Y' | 'Z'): number[] {
    const displayRoot = this.rendererManager.displayRoot;
    displayRoot.position.set(0, 0, 0);
    displayRoot.rotation.set(upAxis === 'Z' ? -Math.PI / 2 : 0, 0, 0);
    displayRoot.updateWorldMatrix(true, true);
    if (!recenter || !this.asset) {
      return [0, 0, 0];
    }
    const box = new Box3().setFromObject(this.asset.originalModel);
    const center = new Vector3();
    box.getCenter(center);
    displayRoot.position.copy(center.multiplyScalar(-1));
    displayRoot.updateWorldMatrix(true, true);
    return displayRoot.position.toArray();
  }

  resize(width: number, height: number) {
    this.rendererManager.resize(width, height);
    this.cameraController.resize(width, height);
  }

  focusSelected(object: Object3D | null) {
    if (object) {
      this.cameraController.focus(object);
    }
  }

  focusScene() {
    if (this.asset) {
      this.cameraController.focus(this.asset.originalModel);
    }
  }

  updateHelpers(
    object: Object3D | null,
    highlightObjects: Object3D[],
    showGrid: boolean,
    showAxes: boolean,
    showGeometryLocalBox: boolean,
    showWorldAabb: boolean
  ) {
    this.helpers.setBaseVisibility(showGrid, showAxes);
    this.helpers.updateSelection(object, highlightObjects, showGeometryLocalBox, showWorldAabb, this.asset?.originalModel ?? null);
  }

  pick(event: PickPointer): PickSelection | null {
    if (!this.asset) {
      return null;
    }
    return this.picking.pick(event, this.canvas, this.cameraController.active, this.asset.originalModel, this.asset.inspection);
  }

  canPick(event: PickPointer): boolean {
    return this.pick(event) !== null;
  }

  screenshot() {
    const link = document.createElement('a');
    link.download = 'gltf-inspector.png';
    link.href = this.canvas.toDataURL('image/png');
    link.click();
  }

  dispose() {
    cancelAnimationFrame(this.animationFrame);
    this.setAsset(null);
    this.helpers.dispose();
    this.cameraController.dispose();
    this.materialOverrides.dispose();
    this.rendererManager.dispose();
  }

  private readonly animate = () => {
    this.animationFrame = requestAnimationFrame(this.animate);
    this.cameraController.update();
    this.rendererManager.renderer.render(this.rendererManager.scene, this.cameraController.active);
    this.updateFps();
  };

  private updateFps() {
    this.fpsFrames += 1;
    const now = performance.now();
    const elapsed = now - this.fpsLastTime;
    if (elapsed < 500) {
      return;
    }
    useViewerStore.getState().setFps((this.fpsFrames * 1000) / elapsed);
    this.fpsFrames = 0;
    this.fpsLastTime = now;
  }
}

function readRuntimeInfo(gl: WebGLRenderingContext | WebGL2RenderingContext) {
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  const nav = window.navigator as Navigator & { deviceMemory?: number };
  return {
    webglVersion: gl.getParameter(gl.VERSION) as string,
    glslVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION) as string,
    vendor: debugInfo ? (gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) as string) : (gl.getParameter(gl.VENDOR) as string),
    renderer: debugInfo ? (gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) as string) : (gl.getParameter(gl.RENDERER) as string),
    userAgent: nav.userAgent,
    platform: nav.platform || '-',
    deviceMemory: nav.deviceMemory ? `${nav.deviceMemory} GiB` : '-',
    hardwareConcurrency: nav.hardwareConcurrency ? `${nav.hardwareConcurrency}` : '-'
  };
}

function disposeRuntime(root: Object3D) {
  const geometries = new Set<{ dispose: () => void }>();
  const materials = new Set<{ dispose: () => void }>();
  root.traverse((object) => {
    const target = object as Object3D & {
      geometry?: { dispose: () => void };
      material?: { dispose: () => void } | Array<{ dispose: () => void }>;
    };
    if (target.geometry) {
      geometries.add(target.geometry);
    }
    if (Array.isArray(target.material)) {
      target.material.forEach((material) => materials.add(material));
    } else if (target.material) {
      materials.add(target.material);
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}
