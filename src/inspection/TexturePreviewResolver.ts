import type { LoadedAsset, GltfJsonObject, GltfJsonValue } from '../types/gltf';
import { parseGlbJsonChunk } from '../loaders/GlbParser';

export interface TexturePreview {
  url: string | null;
  revoke: boolean;
  label: string;
}

export async function resolveTexturePreview(asset: LoadedAsset, textureIndex: number): Promise<TexturePreview> {
  const texture = objectValue(asset.source.textures[textureIndex]);
  const imageIndex = numberValue(texture?.source);
  if (imageIndex === null) {
    return { url: null, revoke: false, label: 'no image source' };
  }
  return resolveImagePreview(asset, imageIndex);
}

export async function resolveImagePreview(asset: LoadedAsset, imageIndex: number): Promise<TexturePreview> {
  const image = objectValue(asset.source.images[imageIndex]);
  if (!image) {
    return { url: null, revoke: false, label: 'missing image' };
  }

  const uri = stringValue(image.uri);
  if (uri) {
    if (uri.startsWith('data:')) {
      return { url: uri, revoke: false, label: 'data URI' };
    }
    return { url: asset.bundle.resolveObjectUrl(uri), revoke: false, label: uri };
  }

  const bufferViewIndex = numberValue(image.bufferView);
  if (bufferViewIndex === null) {
    return { url: null, revoke: false, label: 'embedded image without bufferView' };
  }
  const bytes = await readBufferView(asset, bufferViewIndex);
  if (!bytes) {
    return { url: null, revoke: false, label: 'bufferView unavailable' };
  }
  const mimeType = stringValue(image.mimeType) ?? 'application/octet-stream';
  const blob = new Blob([bytes], { type: mimeType });
  return { url: URL.createObjectURL(blob), revoke: true, label: `bufferView ${bufferViewIndex}` };
}

async function readBufferView(asset: LoadedAsset, bufferViewIndex: number): Promise<Uint8Array | null> {
  const bufferView = objectValue(asset.source.bufferViews[bufferViewIndex]);
  if (!bufferView) {
    return null;
  }
  const bufferIndex = numberValue(bufferView.buffer) ?? 0;
  const byteOffset = numberValue(bufferView.byteOffset) ?? 0;
  const byteLength = numberValue(bufferView.byteLength);
  if (byteLength === null) {
    return null;
  }
  const buffer = await readBuffer(asset, bufferIndex);
  if (!buffer) {
    return null;
  }
  return buffer.slice(byteOffset, byteOffset + byteLength);
}

async function readBuffer(asset: LoadedAsset, bufferIndex: number): Promise<Uint8Array | null> {
  const buffer = objectValue(asset.source.buffers[bufferIndex]);
  const uri = stringValue(buffer?.uri);
  if (uri?.startsWith('data:')) {
    return decodeDataUri(uri);
  }
  if (uri) {
    const resolved = asset.bundle.resolveObjectUrl(uri);
    const response = await fetch(resolved);
    return new Uint8Array(await response.arrayBuffer());
  }

  const primary = asset.bundle.findPrimary();
  if (!primary || !primary.key.toLowerCase().endsWith('.glb')) {
    return null;
  }
  return parseGlbJsonChunk(await primary.file.arrayBuffer()).binaryChunk;
}

function decodeDataUri(uri: string): Uint8Array | null {
  const comma = uri.indexOf(',');
  if (comma < 0) {
    return null;
  }
  const header = uri.slice(0, comma);
  const payload = uri.slice(comma + 1);
  if (header.endsWith(';base64')) {
    const binary = atob(payload);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }
  return new TextEncoder().encode(decodeURIComponent(payload));
}

function objectValue(value: GltfJsonValue | undefined): GltfJsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function numberValue(value: GltfJsonValue | undefined): number | null {
  return typeof value === 'number' ? value : null;
}

function stringValue(value: GltfJsonValue | undefined): string | null {
  return typeof value === 'string' ? value : null;
}
