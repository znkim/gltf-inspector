import { useAssetStore } from '../../state/assetStore';
import { useNavigationStore } from '../../state/navigationStore';
import { useSelectionStore } from '../../state/selectionStore';
import { useSettingsStore } from '../../state/settingsStore';
import { coordinateIssues } from '../../inspection/CoordinateAnalyzer';

export function IssuesPanel() {
  const asset = useAssetStore((state) => state.asset);
  const issues = useAssetStore((state) => state.issues);
  const loading = useAssetStore((state) => state.loading);
  const thresholds = useSettingsStore((state) => state.thresholds);
  const focusRawJsonPointer = useNavigationStore((state) => state.focusRawJsonPointer);
  const setSelectedNodeIndex = useSelectionStore((state) => state.setSelectedNodeIndex);
  const allIssues = asset ? [...issues, ...coordinateIssues(asset.coordinateAnalysis, thresholds)] : issues;
  const focusIssue = (pointer?: string) => {
    if (!pointer) {
      return;
    }
    const nodeIndex = /^\/nodes\/(\d+)(?:\/|$)/.exec(pointer)?.[1];
    if (nodeIndex !== undefined) {
      setSelectedNodeIndex(Number(nodeIndex));
    }
    focusRawJsonPointer(pointer);
  };
  return (
    <div className="panel">
      <div className="panel-header">
        <span>Issues</span>
        <span className="tree-kind">{loading ? 'Loading' : `${allIssues.length}`}</span>
      </div>
      <div className="panel-scroll">
        {allIssues.length === 0 && <div className="panel-body">No issues reported.</div>}
        {allIssues.map((issue) => (
          <button
            key={issue.id}
            className={`issue issue-action ${issue.severity}`}
            disabled={!issue.pointer}
            onClick={() => focusIssue(issue.pointer)}
            title={issue.pointer ? 'Open JSON pointer' : undefined}
          >
            <div><strong>{issue.code}</strong> <span className="tree-kind">{issue.severity}</span></div>
            <div>{issue.message}</div>
            {issue.pointer && <div className="mono">{issue.pointer}</div>}
            {issue.resource && <div className="mono">{issue.resource}</div>}
          </button>
        ))}
      </div>
    </div>
  );
}
