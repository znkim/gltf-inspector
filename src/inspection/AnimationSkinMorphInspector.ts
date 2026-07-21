import type { BufferGeometry, Object3D } from 'three';
import type { GltfJsonObject, GltfJsonValue, SourceGltfDocument } from '../types/gltf';

export interface AnimationSummary {
  index: number;
  name: string;
  channelCount: number;
  samplerCount: number;
  targets: string[];
}

export interface SkinSummary {
  index: number;
  name: string;
  jointCount: number;
  skeleton: number | null;
  inverseBindMatrices: number | null;
}

export interface MorphSummary {
  meshIndex: number;
  primitiveIndex: number;
  targetCount: number;
  targetAttributes: string[];
  runtimeInfluences: number[];
}

export function inspectAnimations(source: SourceGltfDocument): AnimationSummary[] {
  return source.animations.map((entry, index) => {
    const animation = objectValue(entry);
    const channels = arrayValue(animation?.channels);
    const samplers = arrayValue(animation?.samplers);
    return {
      index,
      name: stringValue(animation?.name) ?? `Animation ${index}`,
      channelCount: channels.length,
      samplerCount: samplers.length,
      targets: channels.map((channel) => {
        const target = objectValue(objectValue(channel)?.target);
        return `node ${numberValue(target?.node) ?? '-'} ${stringValue(target?.path) ?? '-'}`;
      })
    };
  });
}

export function inspectSkins(source: SourceGltfDocument): SkinSummary[] {
  return source.skins.map((entry, index) => {
    const skin = objectValue(entry);
    return {
      index,
      name: stringValue(skin?.name) ?? `Skin ${index}`,
      jointCount: arrayValue(skin?.joints).length,
      skeleton: numberValue(skin?.skeleton),
      inverseBindMatrices: numberValue(skin?.inverseBindMatrices)
    };
  });
}

export function inspectMorphTargets(source: SourceGltfDocument, selectedObject: Object3D | null): MorphSummary[] {
  const runtimeInfluences = selectedObject ? readInfluences(selectedObject) : [];
  return source.primitives.flatMap(({ meshIndex, primitiveIndex, primitive }) => {
    const targets = arrayValue(primitive.targets);
    if (targets.length === 0) {
      return [];
    }
    const targetAttributes = Array.from(new Set(targets.flatMap((target) => Object.keys(objectValue(target) ?? {}))));
    return [{
      meshIndex,
      primitiveIndex,
      targetCount: targets.length,
      targetAttributes,
      runtimeInfluences
    }];
  });
}

function readInfluences(object: Object3D): number[] {
  const candidate = object as Object3D & { morphTargetInfluences?: number[]; geometry?: BufferGeometry };
  if (candidate.morphTargetInfluences) {
    return candidate.morphTargetInfluences.slice();
  }
  return [];
}

function objectValue(value: GltfJsonValue | undefined): GltfJsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function arrayValue(value: GltfJsonValue | undefined): GltfJsonValue[] {
  return Array.isArray(value) ? value : [];
}

function numberValue(value: GltfJsonValue | undefined): number | null {
  return typeof value === 'number' ? value : null;
}

function stringValue(value: GltfJsonValue | undefined): string | null {
  return typeof value === 'string' ? value : null;
}
