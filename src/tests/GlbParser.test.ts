import { expect, it } from 'vitest';
import { parseGlbJsonChunk } from '../loaders/GlbParser';

it('parses a GLB JSON chunk', () => {
  const json = JSON.stringify({ asset: { version: '2.0' }, nodes: [] });
  const encoded = new TextEncoder().encode(json.padEnd(Math.ceil(json.length / 4) * 4, ' '));
  const binary = new Uint8Array([1, 2, 3, 4]);
  const buffer = new ArrayBuffer(20 + encoded.byteLength + 8 + binary.byteLength);
  const view = new DataView(buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, buffer.byteLength, true);
  view.setUint32(12, encoded.byteLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(buffer, 20).set(encoded);
  const binaryHeaderOffset = 20 + encoded.byteLength;
  view.setUint32(binaryHeaderOffset, binary.byteLength, true);
  view.setUint32(binaryHeaderOffset + 4, 0x004e4942, true);
  new Uint8Array(buffer, binaryHeaderOffset + 8).set(binary);

  const parsed = parseGlbJsonChunk(buffer);
  expect(parsed.json.asset).toEqual({ version: '2.0' });
  expect(Array.from(parsed.binaryChunk ?? [])).toEqual([1, 2, 3, 4]);
});
