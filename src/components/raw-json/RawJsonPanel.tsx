import { useMemo, useState } from 'react';
import { useAssetStore } from '../../state/assetStore';
import { flattenJson } from './jsonFlatten';

const MAX_ROWS = 1500;

export function RawJsonPanel() {
  return (
    <div className="panel">
      <RawJsonContent />
    </div>
  );
}

export function RawJsonContent({ embedded = false }: { embedded?: boolean }) {
  const asset = useAssetStore((state) => state.asset);
  const [search, setSearch] = useState('');
  const rows = useMemo(() => {
    if (!asset) {
      return [];
    }
    const flattened = flattenJson(asset.source.json);
    const query = search.trim().toLowerCase();
    return query ? flattened.filter((row) => `${row.pointer} ${row.preview}`.toLowerCase().includes(query)) : flattened;
  }, [asset, search]);

  return (
    <>
      {!embedded && (
        <div className="panel-header">
        <span>Raw JSON</span>
        <input className="search-input" placeholder="Search pointer/value" value={search} onChange={(event) => setSearch(event.currentTarget.value)} />
      </div>
      )}
      {embedded && (
        <div className="panel-subheader">
          <input className="search-input" placeholder="Search pointer/value" value={search} onChange={(event) => setSearch(event.currentTarget.value)} />
        </div>
      )}
      {!asset && <div className="panel-body">No JSON loaded.</div>}
      {asset && (
        <div className="raw-json panel-scroll">
          {rows.slice(0, MAX_ROWS).map((row) => (
            <div key={row.pointer} className="raw-row" style={{ paddingLeft: 8 + row.depth * 12 }}>
              <span className="mono raw-pointer">{row.pointer}</span>
              <span className="raw-label">{row.label}</span>
              <span className="mono raw-preview">{row.preview}</span>
            </div>
          ))}
          {rows.length > MAX_ROWS && <div className="panel-body tree-kind">Showing first {MAX_ROWS} of {rows.length} rows.</div>}
        </div>
      )}
    </>
  );
}
