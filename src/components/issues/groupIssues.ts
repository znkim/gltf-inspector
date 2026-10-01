import type { InspectorIssue } from '../../types/gltf';

export const ISSUE_GROUP_THRESHOLD = 10;
export const ISSUE_GROUP_SAMPLE_LIMIT = 3;

export type IssueDisplayItem =
  | { kind: 'issue'; issue: InspectorIssue }
  | { kind: 'group'; code: string; severity: InspectorIssue['severity']; count: number; samples: InspectorIssue[] };

export function groupIssues(issues: InspectorIssue[]): IssueDisplayItem[] {
  const counts = new Map<string, number>();
  for (const issue of issues) {
    const key = issueKey(issue);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const displayItems: IssueDisplayItem[] = [];
  const groups = new Map<string, Extract<IssueDisplayItem, { kind: 'group' }>>();
  for (const issue of issues) {
    const key = issueKey(issue);
    const count = counts.get(key)!;
    if (count < ISSUE_GROUP_THRESHOLD) {
      displayItems.push({ kind: 'issue', issue });
      continue;
    }

    let group = groups.get(key);
    if (!group) {
      group = { kind: 'group', code: issue.code, severity: issue.severity, count, samples: [] };
      groups.set(key, group);
      displayItems.push(group);
    }
    if (group.samples.length < ISSUE_GROUP_SAMPLE_LIMIT) {
      group.samples.push(issue);
    }
  }
  return displayItems;
}

function issueKey(issue: InspectorIssue): string {
  return `${issue.severity}\0${issue.code}`;
}
