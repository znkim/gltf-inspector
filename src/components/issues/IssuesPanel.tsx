import { useAssetStore } from '../../state/assetStore';
import { useSettingsStore } from '../../state/settingsStore';
import { coordinateIssues } from '../../inspection/CoordinateAnalyzer';

export function IssuesPanel() {
  const asset = useAssetStore((state) => state.asset);
  const issues = useAssetStore((state) => state.issues);
  const loading = useAssetStore((state) => state.loading);
  const thresholds = useSettingsStore((state) => state.thresholds);
  const allIssues = asset ? [...issues, ...coordinateIssues(asset.coordinateAnalysis, thresholds)] : issues;
  return (
    <div className="panel">
      <div className="panel-header">
        <span>Issues</span>
        <span className="tree-kind">{loading ? 'Loading' : `${allIssues.length}`}</span>
      </div>
      <div className="panel-scroll">
        {allIssues.length === 0 && <div className="panel-body">No issues reported.</div>}
        {allIssues.map((issue) => (
          <div key={issue.id} className={`issue ${issue.severity}`}>
            <div><strong>{issue.code}</strong> <span className="tree-kind">{issue.severity}</span></div>
            <div>{issue.message}</div>
            {issue.pointer && <div className="mono">{issue.pointer}</div>}
            {issue.resource && <div className="mono">{issue.resource}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
