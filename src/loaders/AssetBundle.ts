import { unzipSync } from 'fflate';
import { basename, dirname, normalizeRelativePath, resolveUri } from './UriResolver';
import { isTileContainerKey, parseTileContainer } from './TileFormatParser';
import type { TileContainerInfo, TileContentInfo } from './TileFormatParser';
import type { InspectorIssue } from '../types/gltf';

export interface BundleFile {
  key: string;
  file: File;
  size: number;
  objectUrl?: string;
  /** Set when the file is a 3D Tiles container; `file` then holds the extracted glTF/GLB payload. */
  tile?: LoadedTileInfo;
}

export interface LoadedTileInfo {
  container: TileContainerInfo;
  content: TileContentInfo;
  contentIndex: number;
  sourceFile: File;
}

export class AssetBundle {
  readonly files = new Map<string, BundleFile>();
  readonly issues: InspectorIssue[] = [];

  static async fromFileList(inputFiles: FileList | File[]): Promise<AssetBundle> {
    const bundle = new AssetBundle();
    const files = Array.from(inputFiles);
    for (const file of files) {
      if (file.name.toLowerCase().endsWith('.zip')) {
        await bundle.addZip(file);
      } else {
        bundle.addFile(file);
      }
    }
    await bundle.unwrapPrimaryTile();
    return bundle;
  }

  /** Extracts the glTF payload of the first 3D Tiles container so it can load like a plain GLB. */
  async unwrapPrimaryTile() {
    const key = this.keys().find(isTileContainerKey);
    const entry = key ? this.files.get(key) : undefined;
    if (!entry || entry.tile) {
      return;
    }
    const container = parseTileContainer(await entry.file.arrayBuffer());
    const contentIndex = container.contents.findIndex((content) => content.gltfBytes || content.gltfUri);
    const content = container.contents[contentIndex];
    if (!content) {
      throw new Error(`${entry.key} does not contain b3dm or i3dm content with a glTF payload.`);
    }
    let payload: File;
    if (content.gltfBytes) {
      payload = new File([content.gltfBytes], `${basename(entry.key)}.glb`);
    } else {
      const uri = content.gltfUri ?? '';
      const resolved = resolveUri(`${dirname(entry.key)}${uri}`, this.keys()) ?? resolveUri(uri, this.keys());
      const referenced = resolved ? this.files.get(resolved.key) : undefined;
      if (!referenced) {
        throw new Error(`i3dm references an external glTF that was not dropped with it: ${uri}`);
      }
      payload = referenced.file;
    }
    entry.tile = { container, content, contentIndex, sourceFile: entry.file };
    entry.file = payload;
    if (container.contents.length > 1) {
      this.issues.push({
        id: 'tile-cmpt-first-content',
        severity: 'info',
        code: 'TILE_CMPT_FIRST_CONTENT',
        message: `Composite tile has ${container.contents.length} inner contents; only inner tile ${contentIndex} (${content.format}) is loaded.`,
        resource: entry.key
      });
    }
    if (container.skippedInnerTiles.length > 0) {
      this.issues.push({
        id: 'tile-cmpt-skipped',
        severity: 'warning',
        code: 'TILE_UNSUPPORTED_INNER_CONTENT',
        message: `Composite tile contains unsupported inner tiles: ${container.skippedInnerTiles.join(', ')}`,
        resource: entry.key
      });
    }
  }

  addFile(file: File, explicitPath?: string) {
    const pathFromDrop = getRelativePath(file);
    const key = normalizeRelativePath(explicitPath ?? pathFromDrop ?? file.name);
    this.files.set(key, { key, file, size: file.size });
  }

  async addZip(file: File) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const entries = unzipSync(bytes);
    for (const [path, data] of Object.entries(entries)) {
      if (path.endsWith('/')) {
        continue;
      }
      const entryFile = new File([data], basename(path));
      this.addFile(entryFile, path);
    }
  }

  keys(): string[] {
    return Array.from(this.files.keys());
  }

  totalSize(): number {
    return Array.from(this.files.values()).reduce((sum, file) => sum + file.size, 0);
  }

  findPrimary(): BundleFile | null {
    const tile = Array.from(this.files.values()).find((file) => file.tile);
    if (tile) {
      return tile;
    }
    const glb = this.keys().find((key) => key.toLowerCase().endsWith('.glb'));
    const gltf = this.keys().find((key) => key.toLowerCase().endsWith('.gltf'));
    const key = glb ?? gltf;
    return key ? this.files.get(key) ?? null : null;
  }

  resolveObjectUrl(uri: string): string {
    if (/^(data|blob|https?):/i.test(uri)) {
      return uri;
    }
    const result = resolveUri(uri, this.keys());
    if (!result) {
      this.issues.push({
        id: `missing-${uri}`,
        severity: 'error',
        code: 'RESOURCE_NOT_FOUND',
        message: `Resource URI could not be resolved: ${uri}`,
        resource: uri
      });
      return uri;
    }
    if (result.ambiguous) {
      this.issues.push({
        id: `ambiguous-${uri}`,
        severity: 'error',
        code: 'RESOURCE_BASENAME_AMBIGUOUS',
        message: `Resource URI matched multiple files by basename: ${uri}`,
        resource: uri
      });
    }
    const bundleFile = this.files.get(result.key);
    if (!bundleFile) {
      return uri;
    }
    bundleFile.objectUrl ??= URL.createObjectURL(bundleFile.file);
    return bundleFile.objectUrl;
  }

  revokeObjectUrls() {
    for (const file of this.files.values()) {
      if (file.objectUrl) {
        URL.revokeObjectURL(file.objectUrl);
        file.objectUrl = undefined;
      }
    }
  }
}

function getRelativePath(file: File): string | null {
  const candidate = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  return candidate && candidate.length > 0 ? candidate : null;
}
