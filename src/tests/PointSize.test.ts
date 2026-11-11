import { expect, it } from 'vitest';
import { Group, Mesh, MeshBasicMaterial, Points, PointsMaterial, ShaderMaterial } from 'three';
import { applyPointSize } from '../viewer/PointSize';
import { useSettingsStore } from '../state/settingsStore';

it('changes regular point materials in screen pixels without changing other representations', () => {
  const root = new Group();
  const material = new PointsMaterial({ size: 1, sizeAttenuation: true });
  const regular = new Points(undefined, material);
  const gaussian = new Points(undefined, new ShaderMaterial());
  gaussian.userData.inspectorRepresentation = 'gaussian-splat';
  const voxelMaterial = new PointsMaterial({ size: 0.04, sizeAttenuation: true });
  const voxel = new Points(undefined, voxelMaterial);
  voxel.userData.inspectorRepresentation = 'voxel-points';
  const meshMaterial = new MeshBasicMaterial();
  root.add(regular, gaussian, voxel, new Mesh(undefined, meshMaterial));

  applyPointSize(root, 7);
  expect(material.size).toBe(7);
  expect(material.sizeAttenuation).toBe(false);
  expect(voxelMaterial.size).toBe(0.04);
  expect(voxelMaterial.sizeAttenuation).toBe(true);
  expect(meshMaterial).toBeInstanceOf(MeshBasicMaterial);
});

it('defaults to 1 px and clamps persisted point size changes', () => {
  const settings = useSettingsStore.getState();
  expect(settings.pointSize).toBe(1);
  settings.setPointSize(30);
  expect(useSettingsStore.getState().pointSize).toBe(20);
  settings.setPointSize(0);
  expect(useSettingsStore.getState().pointSize).toBe(1);
  settings.setPointSize(5);
  settings.resetSettings();
  expect(useSettingsStore.getState().pointSize).toBe(1);
});
