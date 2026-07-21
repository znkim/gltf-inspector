import { create } from 'zustand';
import type { LoadedAsset, InspectorIssue } from '../types/gltf';

interface AssetState {
  asset: LoadedAsset | null;
  loading: boolean;
  issues: InspectorIssue[];
  setLoading: (loading: boolean) => void;
  setAsset: (asset: LoadedAsset | null) => void;
  addIssue: (issue: InspectorIssue) => void;
  clearAsset: () => void;
}

export const useAssetStore = create<AssetState>((set, get) => ({
  asset: null,
  loading: false,
  issues: [],
  setLoading: (loading) => set({ loading }),
  setAsset: (asset) => {
    const current = get().asset;
    if (current && current !== asset) {
      current.bundle.revokeObjectUrls();
    }
    set({ asset, issues: asset?.issues ?? [], loading: false });
  },
  addIssue: (issue) => set((state) => ({ issues: [...state.issues, issue] })),
  clearAsset: () => {
    const current = get().asset;
    current?.bundle.revokeObjectUrls();
    set({ asset: null, issues: [], loading: false });
  }
}));
