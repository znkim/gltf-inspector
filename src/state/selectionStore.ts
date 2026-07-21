import { create } from 'zustand';

export interface PrimitiveSelection {
  nodeIndex: number;
  meshIndex: number;
  primitiveIndex: number;
}

export interface MeshSelection {
  nodeIndex: number;
  meshIndex: number;
}

interface SelectionState {
  selectedScene: boolean;
  selectedNodeIndex: number | null;
  selectedMesh: MeshSelection | null;
  selectedPrimitive: PrimitiveSelection | null;
  setSelectedScene: (selected: boolean) => void;
  setSelectedNodeIndex: (index: number | null) => void;
  setSelectedMesh: (selection: MeshSelection | null) => void;
  setSelectedPrimitive: (selection: PrimitiveSelection | null) => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedScene: false,
  selectedNodeIndex: null,
  selectedMesh: null,
  selectedPrimitive: null,
  setSelectedScene: (selectedScene) => set({ selectedScene, selectedNodeIndex: null, selectedMesh: null, selectedPrimitive: null }),
  setSelectedNodeIndex: (selectedNodeIndex) => set({ selectedScene: false, selectedNodeIndex, selectedMesh: null, selectedPrimitive: null }),
  setSelectedMesh: (selectedMesh) => set({ selectedScene: false, selectedMesh, selectedPrimitive: null, selectedNodeIndex: selectedMesh?.nodeIndex ?? null }),
  setSelectedPrimitive: (selectedPrimitive) => set({ selectedScene: false, selectedPrimitive, selectedMesh: null, selectedNodeIndex: selectedPrimitive?.nodeIndex ?? null })
}));
