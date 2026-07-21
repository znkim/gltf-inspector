import { create } from 'zustand';

export interface WarningThresholds {
  largeCoordinate: number;
  translationToSizeRatio: number;
}

interface SettingsState {
  thresholds: WarningThresholds;
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
}

export const useSettingsStore = create<SettingsState>((set) => ({
  thresholds: {
    largeCoordinate: 100000,
    translationToSizeRatio: 100
  },
  showGrid: true,
  showWorldAxes: true,
  showNodeAxes: true,
  showGeometryLocalBox: true,
  showWorldAabb: true,
  setShowGrid: (showGrid) => set({ showGrid }),
  setShowWorldAxes: (showWorldAxes) => set({ showWorldAxes }),
  setShowNodeAxes: (showNodeAxes) => set({ showNodeAxes }),
  setShowGeometryLocalBox: (showGeometryLocalBox) => set({ showGeometryLocalBox }),
  setShowWorldAabb: (showWorldAabb) => set({ showWorldAabb })
}));
