export interface ValidatorIssue {
  code: string;
  message: string;
  severity: number;
  pointer?: string;
}

export interface ValidatorReport {
  issues?: {
    numErrors?: number;
    numWarnings?: number;
    numInfos?: number;
    numHints?: number;
    messages?: ValidatorIssue[];
  };
}

export interface ValidatorOptions {
  uri?: string;
  format?: 'glb' | 'gltf';
  maxIssues?: number;
  writeTimestamp?: boolean;
  externalResourceFunction?: (uri: string) => Promise<Uint8Array>;
}
