import type { AssetBundle } from '../loaders/AssetBundle';
import type { InspectorIssue, IssueSeverity, ValidationReport } from '../types/gltf';
import type { ValidatorIssue, ValidatorReport } from './ValidatorTypes';

interface ValidateResponse {
  id: string;
  ok: boolean;
  report?: ValidatorReport;
  error?: string;
}

export async function validateBundle(bundle: AssetBundle): Promise<ValidationReport> {
  const primary = bundle.findPrimary();
  if (!primary) {
    throw new Error('No primary glTF/GLB asset found for validation.');
  }
  const resources = await Promise.all(
    Array.from(bundle.files.values()).map(async (entry) => ({
      key: entry.key,
      bytes: new Uint8Array(await entry.file.arrayBuffer())
    }))
  );
  const primaryResource = resources.find((resource) => resource.key === primary.key);
  if (!primaryResource) {
    throw new Error('Primary asset bytes were not available for validation.');
  }
  const id = `validation-${Date.now()}`;
  const worker = new Worker(new URL('./validator.worker.ts', import.meta.url), { type: 'module' });
  try {
    const response = await new Promise<ValidateResponse>((resolve, reject) => {
      worker.onerror = () => reject(new Error('Validation worker failed.'));
      worker.onmessage = (event: MessageEvent<ValidateResponse>) => resolve(event.data);
      worker.postMessage({
        id,
        primaryKey: primary.key,
        primaryBytes: primaryResource.bytes,
        resources
      });
    });
    if (!response.ok) {
      return {
        errors: 0,
        warnings: 1,
        infos: 0,
        hints: 0,
        issues: [{
          id: `${id}-failed`,
          severity: 'warning',
          code: 'VALIDATION_FAILED',
          message: response.error ?? 'Validation failed.'
        }]
      };
    }
    return convertReport(response.report);
  } finally {
    worker.terminate();
  }
}

function convertReport(report: ValidatorReport | undefined): ValidationReport {
  const rawIssues = report?.issues;
  return {
    errors: rawIssues?.numErrors ?? 0,
    warnings: rawIssues?.numWarnings ?? 0,
    infos: rawIssues?.numInfos ?? 0,
    hints: rawIssues?.numHints ?? 0,
    issues: (rawIssues?.messages ?? []).map((issue: ValidatorIssue, index: number): InspectorIssue => ({
      id: `validator-${index}-${issue.code}`,
      severity: severityFromNumber(issue.severity),
      code: issue.code,
      message: issue.message,
      pointer: issue.pointer
    }))
  };
}

function severityFromNumber(severity: number): IssueSeverity {
  switch (severity) {
    case 0:
      return 'error';
    case 1:
      return 'warning';
    case 2:
      return 'info';
    default:
      return 'hint';
  }
}
