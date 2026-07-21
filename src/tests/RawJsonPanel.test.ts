import { expect, it } from 'vitest';
import { flattenJson } from '../components/raw-json/jsonFlatten';

it('flattens JSON with escaped JSON pointers', () => {
  const rows = flattenJson({ asset: { version: '2.0' }, 'a/b': [1] });
  expect(rows.map((row) => row.pointer)).toContain('/asset/version');
  expect(rows.map((row) => row.pointer)).toContain('/a~1b/0');
});
