import { validateBytes } from 'gltf-validator';
import type { ValidatorReport } from './ValidatorTypes';

interface ValidateRequest {
  id: string;
  primaryKey: string;
  primaryBytes: Uint8Array;
  resources: Array<{ key: string; bytes: Uint8Array }>;
}

interface ValidateResponse {
  id: string;
  ok: boolean;
  report?: ValidatorReport;
  error?: string;
}

self.onmessage = (event: MessageEvent<ValidateRequest>) => {
  void validate(event.data);
};

async function validate(request: ValidateRequest) {
  const resources = new Map(request.resources.map((resource) => [resource.key, resource.bytes]));
  try {
    const report = await validateBytes(request.primaryBytes, {
      uri: request.primaryKey,
      format: request.primaryKey.toLowerCase().endsWith('.glb') ? 'glb' : 'gltf',
      maxIssues: 0,
      writeTimestamp: false,
      externalResourceFunction: (uri: string) => Promise.resolve().then(() => {
        const decoded = safeDecode(uri).replaceAll('\\', '/').replace(/^\/+/, '');
        const exact = resources.get(decoded);
        if (exact) {
          return exact;
        }
        const lower = decoded.toLowerCase();
        const match = Array.from(resources.entries()).find(([key]) => key.toLowerCase() === lower);
        if (match) {
          return match[1];
        }
        throw new Error(`Validation resource not found: ${uri}`);
      })
    });
    post({ id: request.id, ok: true, report });
  } catch (error) {
    post({ id: request.id, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function post(response: ValidateResponse) {
  self.postMessage(response);
}
