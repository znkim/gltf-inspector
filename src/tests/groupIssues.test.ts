import { expect, it } from 'vitest';
import { groupIssues, ISSUE_GROUP_SAMPLE_LIMIT, ISSUE_GROUP_THRESHOLD } from '../components/issues/groupIssues';
import type { InspectorIssue } from '../types/gltf';

function makeIssues(count: number, code = 'NORMAL_ERROR', severity: InspectorIssue['severity'] = 'warning'): InspectorIssue[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${code}-${index}`,
    code,
    severity,
    message: `Triangle ${index} has an invalid normal`,
    pointer: `/meshes/0/primitives/0/attributes/NORMAL/${index}`
  }));
}

it('shows repeated issues individually below the threshold', () => {
  const issues = makeIssues(ISSUE_GROUP_THRESHOLD - 1);
  expect(groupIssues(issues)).toEqual(issues.map((issue) => ({ kind: 'issue', issue })));
});

it('groups repeated issues with the full count and a bounded, navigable sample', () => {
  const issues = makeIssues(5_000);
  const displayItems = groupIssues(issues);
  expect(displayItems).toHaveLength(1);
  expect(displayItems[0]).toEqual({
    kind: 'group', code: 'NORMAL_ERROR', severity: 'warning', count: 5_000,
    samples: issues.slice(0, ISSUE_GROUP_SAMPLE_LIMIT)
  });
});

it('keeps different codes and severities separate', () => {
  const displayItems = groupIssues([
    ...makeIssues(ISSUE_GROUP_THRESHOLD),
    ...makeIssues(ISSUE_GROUP_THRESHOLD, 'NORMAL_ERROR', 'error'),
    ...makeIssues(2, 'TANGENT_ERROR')
  ]);
  expect(displayItems.map((item) => item.kind === 'group' ? `${item.severity}:${item.code}:${item.count}` : item.issue.id)).toEqual([
    'warning:NORMAL_ERROR:10',
    'error:NORMAL_ERROR:10',
    'TANGENT_ERROR-0',
    'TANGENT_ERROR-1'
  ]);
});
