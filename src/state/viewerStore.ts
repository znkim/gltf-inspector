import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
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
  resetViewerSettings: () => void;
}

const DEFAULT_VIEWER_SETTINGS = {
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
  }
} satisfies Pick<
  ViewerState,
  | 'renderMode'
  | 'lightingMode'
  | 'environmentMode'
  | 'backgroundColor'
  | 'cameraMode'
  | 'upAxis'
  | 'autoOrbit'
  | 'displayRecenter'
  | 'renderStateOverrides'
>;

export const useViewerStore = create<ViewerState>()(
  persist(
    (set) => ({
      ...DEFAULT_VIEWER_SETTINGS,
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
      setRuntimeInfo: (runtimeInfo) => set({ runtimeInfo }),
      resetViewerSettings: () =>
        set({
          ...DEFAULT_VIEWER_SETTINGS,
          renderStateOverrides: { ...DEFAULT_VIEWER_SETTINGS.renderStateOverrides },
          displayOffset: [0, 0, 0]
        })
    }),
    {
      name: 'gltf-inspector-viewer-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        renderMode: state.renderMode,
        lightingMode: state.lightingMode,
        environmentMode: state.environmentMode,
        backgroundColor: state.backgroundColor,
        cameraMode: state.cameraMode,
        upAxis: state.upAxis,
        autoOrbit: state.autoOrbit,
        displayRecenter: state.displayRecenter,
        renderStateOverrides: state.renderStateOverrides
      })
    }
  )
);
