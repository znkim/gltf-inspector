import { create } from 'zustand';
import type { RenderMode } from '../types/gltf';

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
  backgroundColor: string;
  cameraMode: 'perspective' | 'orthographic';
  upAxis: 'Y' | 'Z';
  autoOrbit: boolean;
  displayRecenter: boolean;
  displayOffset: number[];
  fps: number;
  runtimeInfo: RuntimeInfo | null;
  setRenderMode: (mode: RenderMode) => void;
  setBackgroundColor: (color: string) => void;
  setCameraMode: (mode: 'perspective' | 'orthographic') => void;
  setUpAxis: (axis: 'Y' | 'Z') => void;
  setAutoOrbit: (value: boolean) => void;
  setDisplayRecenter: (value: boolean) => void;
  setDisplayOffset: (offset: number[]) => void;
  setFps: (fps: number) => void;
  setRuntimeInfo: (info: RuntimeInfo) => void;
}

export const useViewerStore = create<ViewerState>((set) => ({
  renderMode: 'pbr',
  backgroundColor: '#1e2125',
  cameraMode: 'perspective',
  upAxis: 'Y',
  autoOrbit: false,
  displayRecenter: false,
  displayOffset: [0, 0, 0],
  fps: 0,
  runtimeInfo: null,
  setRenderMode: (renderMode) => set({ renderMode }),
  setBackgroundColor: (backgroundColor) => set({ backgroundColor }),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  setUpAxis: (upAxis) => set({ upAxis }),
  setAutoOrbit: (autoOrbit) => set({ autoOrbit }),
  setDisplayRecenter: (displayRecenter) => set({ displayRecenter }),
  setDisplayOffset: (displayOffset) => set({ displayOffset }),
  setFps: (fps) => set({ fps }),
  setRuntimeInfo: (runtimeInfo) => set({ runtimeInfo })
}));
