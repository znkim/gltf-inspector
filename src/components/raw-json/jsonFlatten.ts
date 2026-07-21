import type { GltfJsonValue } from '../../types/gltf';

export interface JsonRow {
  pointer: string;
  depth: number;
  label: string;
  preview: string;
}

export function flattenJson(value: GltfJsonValue, pointer = '', depth = 0, output: JsonRow[] = []): JsonRow[] {
  const label = pointer.split('/').at(-1) || '(root)';
  output.push({ pointer: pointer || '/', depth, label, preview: previewValue(value) });
  if (value && typeof value === 'object') {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => flattenJson(entry, `${pointer}/${index}`, depth + 1, output));
    } else {
      for (const [key, child] of Object.entries(value)) {
        flattenJson(child ?? null, `${pointer}/${escapePointer(key)}`, depth + 1, output);
      }
    }
  }
  return output;
}

function previewValue(value: GltfJsonValue): string {
  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }
  if (value && typeof value === 'object') {
    return `Object(${Object.keys(value).length})`;
  }
  return JSON.stringify(value);
}

function escapePointer(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}
