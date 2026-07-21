export interface ResolutionResult {
  key: string;
  ambiguous: boolean;
}

export function normalizeRelativePath(path: string): string {
  return path.replaceAll('\\', '/').replace(/^\/+/, '').split('/').filter(Boolean).join('/');
}

export function basename(path: string): string {
  const normalized = normalizeRelativePath(path);
  const parts = normalized.split('/');
  return parts[parts.length - 1] ?? normalized;
}

export function dirname(path: string): string {
  const normalized = normalizeRelativePath(path);
  const index = normalized.lastIndexOf('/');
  return index >= 0 ? normalized.slice(0, index + 1) : '';
}

export function safeDecodeUri(uri: string): string {
  try {
    return decodeURIComponent(uri);
  } catch {
    return uri;
  }
}

export function resolveUri(uri: string, keys: string[]): ResolutionResult | null {
  const normalized = normalizeRelativePath(uri);
  if (keys.includes(normalized)) {
    return { key: normalized, ambiguous: false };
  }

  const decoded = normalizeRelativePath(safeDecodeUri(uri));
  if (keys.includes(decoded)) {
    return { key: decoded, ambiguous: false };
  }

  const lower = normalized.toLowerCase();
  const caseMatch = keys.find((key) => key.toLowerCase() === lower);
  if (caseMatch) {
    return { key: caseMatch, ambiguous: false };
  }

  const name = basename(normalized).toLowerCase();
  const basenameMatches = keys.filter((key) => basename(key).toLowerCase() === name);
  if (basenameMatches.length === 1 && basenameMatches[0]) {
    return { key: basenameMatches[0], ambiguous: false };
  }
  if (basenameMatches.length > 1 && basenameMatches[0]) {
    return { key: basenameMatches[0], ambiguous: true };
  }
  return null;
}
