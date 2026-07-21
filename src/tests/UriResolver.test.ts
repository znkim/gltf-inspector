import { describe, expect, it } from 'vitest';
import { resolveUri, safeDecodeUri } from '../loaders/UriResolver';

describe('URI resolution', () => {
  const keys = ['models/Texture A.png', 'buffers/model.bin', 'other/texture.png', 'dup/texture.png'];

  it('resolves exact and decoded relative paths', () => {
    expect(resolveUri('buffers/model.bin', keys)?.key).toBe('buffers/model.bin');
    expect(resolveUri('models/Texture%20A.png', keys)?.key).toBe('models/Texture A.png');
  });

  it('resolves case-insensitive paths and reports basename ambiguity', () => {
    expect(resolveUri('BUFFERS/MODEL.BIN', keys)?.key).toBe('buffers/model.bin');
    expect(resolveUri('texture.png', keys)?.ambiguous).toBe(true);
  });

  it('keeps malformed encoded URIs intact', () => {
    expect(safeDecodeUri('%E0%A4%A')).toBe('%E0%A4%A');
  });
});
