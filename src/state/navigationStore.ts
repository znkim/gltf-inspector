import { create } from 'zustand';

interface NavigationState {
  explorerTab: 'scene' | 'raw';
  rawJsonPointer: string;
  rawJsonNonce: number;
  layoutResetNonce: number;
  setExplorerTab: (tab: 'scene' | 'raw') => void;
  focusRawJsonPointer: (pointer: string) => void;
  resetPanelLayout: () => void;
}

const PANEL_LAYOUT_STORAGE_KEYS = [
  'react-resizable-panels:gltf-inspector-workspace-v1',
  'react-resizable-panels:gltf-inspector-main-v1',
  'react-resizable-panels:gltf-inspector-bottom-v1',
  'react-resizable-panels:gltf-inspector-inspector-v1'
];

export const useNavigationStore = create<NavigationState>((set) => ({
  explorerTab: 'scene',
  rawJsonPointer: '',
  rawJsonNonce: 0,
  layoutResetNonce: 0,
  setExplorerTab: (explorerTab) => set({ explorerTab }),
  focusRawJsonPointer: (rawJsonPointer) =>
    set((state) => ({
      explorerTab: 'raw',
      rawJsonPointer,
      rawJsonNonce: state.rawJsonNonce + 1
    })),
  resetPanelLayout: () =>
    set((state) => {
      for (const key of PANEL_LAYOUT_STORAGE_KEYS) {
        localStorage.removeItem(key);
      }
      return { layoutResetNonce: state.layoutResetNonce + 1 };
    })
}));
