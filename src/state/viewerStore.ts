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
  cameraMode: 'perspective' | 'orthographic';
  upAxis: 'Y' | 'Z';
  autoFrameSelection: boolean;
  displayRecenter: boolean;
  displayOffset: number[];
  fps: number;
  runtimeInfo: RuntimeInfo | null;
  setRenderMode: (mode: RenderMode) => void;
  setCameraMode: (mode: 'perspective' | 'orthographic') => void;
  setUpAxis: (axis: 'Y' | 'Z') => void;
  setAutoFrameSelection: (value: boolean) => void;
  setDisplayRecenter: (value: boolean) => void;
  setDisplayOffset: (offset: number[]) => void;
  setFps: (fps: number) => void;
  setRuntimeInfo: (info: RuntimeInfo) => void;
}

export const useViewerStore = create<ViewerState>((set) => ({
  renderMode: 'pbr',
  cameraMode: 'perspective',
  upAxis: 'Y',
  autoFrameSelection: false,
  displayRecenter: false,
  displayOffset: [0, 0, 0],
  fps: 0,
  runtimeInfo: null,
  setRenderMode: (renderMode) => set({ renderMode }),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  setUpAxis: (upAxis) => set({ upAxis }),
  setAutoFrameSelection: (autoFrameSelection) => set({ autoFrameSelection }),
  setDisplayRecenter: (displayRecenter) => set({ displayRecenter }),
  setDisplayOffset: (displayOffset) => set({ displayOffset }),
  setFps: (fps) => set({ fps }),
  setRuntimeInfo: (runtimeInfo) => set({ runtimeInfo })
}));
