import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface WarningThresholds {
  largeCoordinate: number;
  translationToSizeRatio: number;
}

interface SettingsState {
  thresholds: WarningThresholds;
  pointSize: number;
  showGrid: boolean;
  showWorldAxes: boolean;
  showNodeAxes: boolean;
  showGeometryLocalBox: boolean;
  showWorldAabb: boolean;
  setShowGrid: (value: boolean) => void;
  setShowWorldAxes: (value: boolean) => void;
  setShowNodeAxes: (value: boolean) => void;
  setShowGeometryLocalBox: (value: boolean) => void;
  setShowWorldAabb: (value: boolean) => void;
  setPointSize: (value: number) => void;
  resetSettings: () => void;
}

const DEFAULT_SETTINGS = {
  thresholds: {
    largeCoordinate: 100000,
    translationToSizeRatio: 100
  },
  pointSize: 1,
  showGrid: true,
  showWorldAxes: true,
  showNodeAxes: true,
  showGeometryLocalBox: true,
  showWorldAabb: true
} satisfies Pick<
  SettingsState,
  'thresholds' | 'pointSize' | 'showGrid' | 'showWorldAxes' | 'showNodeAxes' | 'showGeometryLocalBox' | 'showWorldAabb'
>;

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      setShowGrid: (showGrid) => set({ showGrid }),
      setShowWorldAxes: (showWorldAxes) => set({ showWorldAxes }),
      setShowNodeAxes: (showNodeAxes) => set({ showNodeAxes }),
      setShowGeometryLocalBox: (showGeometryLocalBox) => set({ showGeometryLocalBox }),
      setShowWorldAabb: (showWorldAabb) => set({ showWorldAabb }),
      setPointSize: (value) => set({ pointSize: Number.isFinite(value) ? Math.max(1, Math.min(20, Math.round(value))) : 1 }),
      resetSettings: () =>
        set({
          ...DEFAULT_SETTINGS,
          thresholds: { ...DEFAULT_SETTINGS.thresholds }
        })
    }),
    {
      name: 'gltf-inspector-settings-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        thresholds: state.thresholds,
        pointSize: state.pointSize,
        showGrid: state.showGrid,
        showWorldAxes: state.showWorldAxes,
        showNodeAxes: state.showNodeAxes,
        showGeometryLocalBox: state.showGeometryLocalBox,
        showWorldAabb: state.showWorldAabb
      })
    }
  )
);
