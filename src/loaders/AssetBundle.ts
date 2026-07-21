import { unzipSync } from 'fflate';
import { basename, normalizeRelativePath, resolveUri } from './UriResolver';
import type { InspectorIssue } from '../types/gltf';

export interface BundleFile {
  key: string;
  file: File;
  size: number;
  objectUrl?: string;
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
    return bundle;
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
