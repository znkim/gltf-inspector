import { create } from 'zustand';
import type { EnvironmentMode, LightingMode, RenderMode, RenderStateOverrideMode, RenderStateOverrides } from '../types/gltf';

export interface RuntimeInfo {
  webglVersion: string;
  glslVersion: string;
  vendor: string;
  renderer: string;
  userAgent: string;
  platform: string;
  deviceMemory: string;
  hardwareConcurrency: string;
}

interface ViewerState {
  renderMode: RenderMode;
  lightingMode: LightingMode;
  environmentMode: EnvironmentMode;
  backgroundColor: string;
  cameraMode: 'perspective' | 'orthographic';
  upAxis: 'Y' | 'Z';
  autoOrbit: boolean;
  displayRecenter: boolean;
  renderStateOverrides: RenderStateOverrides;
  displayOffset: number[];
  fps: number;
  runtimeInfo: RuntimeInfo | null;
  setRenderMode: (mode: RenderMode) => void;
  setLightingMode: (mode: LightingMode) => void;
  setEnvironmentMode: (mode: EnvironmentMode) => void;
  setBackgroundColor: (color: string) => void;
  setCameraMode: (mode: 'perspective' | 'orthographic') => void;
  setUpAxis: (axis: 'Y' | 'Z') => void;
  setAutoOrbit: (value: boolean) => void;
  setDisplayRecenter: (value: boolean) => void;
  setRenderStateOverride: (key: keyof RenderStateOverrides, value: RenderStateOverrideMode) => void;
  setDisplayOffset: (offset: number[]) => void;
  setFps: (fps: number) => void;
  setRuntimeInfo: (info: RuntimeInfo) => void;
}

export const useViewerStore = create<ViewerState>((set) => ({
  renderMode: 'pbr',
  lightingMode: 'studio',
  environmentMode: 'studio',
  backgroundColor: '#1e2125',
  cameraMode: 'perspective',
  upAxis: 'Y',
  autoOrbit: false,
  displayRecenter: false,
  renderStateOverrides: {
    doubleSided: 'default',
    depthTest: 'default',
    depthWrite: 'default'
  },
  displayOffset: [0, 0, 0],
  fps: 0,
  runtimeInfo: null,
  setRenderMode: (renderMode) => set({ renderMode }),
  setLightingMode: (lightingMode) => set({ lightingMode }),
  setEnvironmentMode: (environmentMode) => set({ environmentMode }),
  setBackgroundColor: (backgroundColor) => set({ backgroundColor }),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  setUpAxis: (upAxis) => set({ upAxis }),
  setAutoOrbit: (autoOrbit) => set({ autoOrbit }),
  setDisplayRecenter: (displayRecenter) => set({ displayRecenter }),
  setRenderStateOverride: (key, value) =>
    set((state) => ({
      renderStateOverrides: {
        ...state.renderStateOverrides,
        [key]: value
      }
    })),
  setDisplayOffset: (displayOffset) => set({ displayOffset }),
  setFps: (fps) => set({ fps }),
  setRuntimeInfo: (runtimeInfo) => set({ runtimeInfo })
}));
