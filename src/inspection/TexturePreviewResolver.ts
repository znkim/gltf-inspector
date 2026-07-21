import {
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  WebGLRenderer,
  type Texture
} from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
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
    if (isKtx2Resource(uri, stringValue(image.mimeType))) {
      return resolveKtx2Preview(asset.bundle.resolveObjectUrl(uri), uri, false);
    }
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
  if (isKtx2Resource(undefined, mimeType)) {
    const sourceUrl = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
    return resolveKtx2Preview(sourceUrl, `bufferView ${bufferViewIndex} KTX2`, true);
  }
  const blob = new Blob([bytes], { type: mimeType });
  return { url: URL.createObjectURL(blob), revoke: true, label: `bufferView ${bufferViewIndex}` };
}

async function resolveKtx2Preview(sourceUrl: string, label: string, revokeSourceUrl: boolean): Promise<TexturePreview> {
  let renderer: WebGLRenderer | null = null;
  let loader: KTX2Loader | null = null;
  let texture: Texture | null = null;
  try {
    const canvas = document.createElement('canvas');
    renderer = new WebGLRenderer({ canvas, antialias: false, alpha: true, preserveDrawingBuffer: true });
    loader = new KTX2Loader()
      .setTranscoderPath(`${import.meta.env.BASE_URL}decoders/basis/`)
      .detectSupport(renderer);
    texture = await new Promise<Texture>((resolve, reject) => {
      loader?.load(
        sourceUrl,
        (loadedTexture) => resolve(loadedTexture),
        undefined,
        (error) => reject(error instanceof Error ? error : new Error(String(error)))
      );
    });
    const previewUrl = await renderTexturePreview(renderer, texture);
    return { url: previewUrl, revoke: true, label: `${label} rendered` };
  } catch (error) {
    return {
      url: null,
      revoke: false,
      label: `KTX2 preview failed: ${error instanceof Error ? error.message : String(error)}`
    };
  } finally {
    texture?.dispose();
    loader?.dispose();
    renderer?.dispose();
    if (revokeSourceUrl) {
      URL.revokeObjectURL(sourceUrl);
    }
  }
}

async function renderTexturePreview(renderer: WebGLRenderer, texture: Texture): Promise<string> {
  const source = texture.image as { width?: number; height?: number } | undefined;
  const sourceWidth = Math.max(1, source?.width ?? 256);
  const sourceHeight = Math.max(1, source?.height ?? 256);
  const maxSize = 1024;
  const scale = Math.min(1, maxSize / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  renderer.setSize(width, height, false);
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 10);
  camera.position.z = 1;
  const geometry = new PlaneGeometry(2, 2);
  const material = new MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false });
  scene.add(new Mesh(geometry, material));
  renderer.render(scene, camera);
  geometry.dispose();
  material.dispose();

  const blob = await new Promise<Blob>((resolve, reject) => {
    renderer.domElement.toBlob((result) => {
      if (result) {
        resolve(result);
      } else {
        reject(new Error('Canvas preview export failed.'));
      }
    }, 'image/png');
  });
  return URL.createObjectURL(blob);
}

function isKtx2Resource(uri: string | undefined, mimeType: string | null): boolean {
  const normalizedUri = uri?.toLowerCase() ?? '';
  const path = normalizedUri.split(/[?#]/)[0] ?? normalizedUri;
  return mimeType === 'image/ktx2' || normalizedUri.startsWith('data:image/ktx2') || path.endsWith('.ktx2');
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
