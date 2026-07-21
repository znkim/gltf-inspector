import { useMemo, useState } from 'react';
import { useAssetStore } from '../../state/assetStore';
import { useSelectionStore, type MeshSelection, type PrimitiveSelection } from '../../state/selectionStore';
import { getActiveController } from '../layout/viewportController';
import { RawJsonContent } from '../raw-json/RawJsonPanel';

interface TreeRow {
  key: string;
  kind: 'Scene' | 'Node' | 'Mesh' | 'Primitive';
  label: string;
  depth: number;
  collapsible: boolean;
  nodeIndex?: number;
  meshIndex?: number;
  primitiveIndex?: number;
}

const MAX_ROWS = 2000;

export function SceneTree() {
  const [tab, setTab] = useState<'scene' | 'raw'>('scene');
  const asset = useAssetStore((state) => state.asset);
  const selectedScene = useSelectionStore((state) => state.selectedScene);
  const selectedNodeIndex = useSelectionStore((state) => state.selectedNodeIndex);
  const selectedMesh = useSelectionStore((state) => state.selectedMesh);
  const selectedPrimitive = useSelectionStore((state) => state.selectedPrimitive);
  const setSelectedScene = useSelectionStore((state) => state.setSelectedScene);
  const setSelectedNodeIndex = useSelectionStore((state) => state.setSelectedNodeIndex);
  const setSelectedMesh = useSelectionStore((state) => state.setSelectedMesh);
  const setSelectedPrimitive = useSelectionStore((state) => state.setSelectedPrimitive);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [hiddenPrimitives, setHiddenPrimitives] = useState<Set<string>>(() => new Set());
  const rows = useMemo(() => (asset ? buildRows(asset.source.nodes, asset.source.meshes, collapsed) : []), [asset, collapsed]);
  const allRows = useMemo(() => (asset ? buildRows(asset.source.nodes, asset.source.meshes, new Set()) : []), [asset]);
  const collapsibleKeys = useMemo(() => allRows.filter((row) => row.collapsible).map((row) => row.key), [allRows]);
  const primitiveRows = useMemo(() => allRows.filter((row) => row.kind === 'Primitive'), [allRows]);

  const toggle = (key: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const setPrimitiveVisible = (row: TreeRow, visible: boolean) => {
    if (!asset || row.nodeIndex === undefined || row.meshIndex === undefined || row.primitiveIndex === undefined) {
      return;
    }
    const object = asset.inspection.getPrimitiveObject(row.nodeIndex, row.meshIndex, row.primitiveIndex);
    if (object) {
      object.visible = visible;
    }
    const key = primitiveVisibilityKey(row.nodeIndex, row.meshIndex, row.primitiveIndex);
    setHiddenPrimitives((current) => {
      const next = new Set(current);
      if (visible) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const setAllPrimitivesVisible = (visible: boolean) => {
    if (!asset) {
      return;
    }
    for (const row of primitiveRows) {
      if (row.nodeIndex !== undefined && row.meshIndex !== undefined && row.primitiveIndex !== undefined) {
        const object = asset.inspection.getPrimitiveObject(row.nodeIndex, row.meshIndex, row.primitiveIndex);
        if (object) {
          object.visible = visible;
        }
      }
    }
    setHiddenPrimitives(
      visible
        ? new Set()
        : new Set(
            primitiveRows
              .filter((row) => row.nodeIndex !== undefined && row.meshIndex !== undefined && row.primitiveIndex !== undefined)
              .map((row) => primitiveVisibilityKey(row.nodeIndex ?? 0, row.meshIndex ?? 0, row.primitiveIndex ?? 0))
          )
    );
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <span>Explorer</span>
        <span className="tree-kind">{tab === 'scene' ? `${rows.length}${rows.length >= MAX_ROWS ? '+' : ''}` : 'JSON'}</span>
      </div>
      <div className="inspector-pane-body">
        <div className="inspector-tabs vertical">
          <button className={`inspector-tab ${tab === 'scene' ? 'active' : ''}`} onClick={() => setTab('scene')}>Scene</button>
          <button className={`inspector-tab ${tab === 'raw' ? 'active' : ''}`} onClick={() => setTab('raw')}>Raw JSON</button>
        </div>
        <div className="explorer-content">
      {tab === 'raw' && <RawJsonContent embedded />}
      {tab === 'scene' && (
      <>
        <div className="panel-subheader tree-actions-row">
          <IconActionButton disabled={!asset} label="Expand All" icon="expand" onClick={() => setCollapsed(new Set())} />
          <IconActionButton disabled={!asset} label="Collapse All" icon="collapse" onClick={() => setCollapsed(new Set(collapsibleKeys))} />
          <IconActionButton disabled={!asset} label="Show All" icon="show" onClick={() => setAllPrimitivesVisible(true)} />
          <IconActionButton disabled={!asset} label="Hide All" icon="hide" onClick={() => setAllPrimitivesVisible(false)} />
        </div>
      <div className="panel-scroll">
        {!asset && <div className="panel-body">Drop a GLB or glTF resource set.</div>}
        {rows.slice(0, MAX_ROWS).map((row) => (
          <div
            key={row.key}
            className={`tree-row ${row.kind === 'Scene' || row.nodeIndex !== undefined ? 'clickable' : ''} ${isSelected(row, selectedScene, selectedNodeIndex, selectedMesh, selectedPrimitive) ? 'selected' : ''} ${isPrimitiveHidden(row, hiddenPrimitives) ? 'hidden-primitive' : ''}`}
            style={{ paddingLeft: row.depth * 12 }}
            onClick={() => {
              if (row.kind === 'Scene') {
                setSelectedScene(true);
              } else if (row.kind === 'Primitive' && row.nodeIndex !== undefined && row.meshIndex !== undefined && row.primitiveIndex !== undefined) {
                setSelectedPrimitive({ nodeIndex: row.nodeIndex, meshIndex: row.meshIndex, primitiveIndex: row.primitiveIndex });
              } else if (row.kind === 'Mesh' && row.nodeIndex !== undefined && row.meshIndex !== undefined) {
                setSelectedMesh({ nodeIndex: row.nodeIndex, meshIndex: row.meshIndex });
              } else if (row.nodeIndex !== undefined) {
                setSelectedNodeIndex(row.nodeIndex);
              }
            }}
            onDoubleClick={() => {
              if (!asset) {
                return;
              }
              if (row.kind === 'Scene') {
                getActiveController()?.focusSelected(asset.originalModel);
              } else if (row.nodeIndex === undefined) {
                return;
              } else if (row.kind === 'Primitive' && row.meshIndex !== undefined && row.primitiveIndex !== undefined) {
                getActiveController()?.focusSelected(asset.inspection.getPrimitiveObject(row.nodeIndex, row.meshIndex, row.primitiveIndex));
              } else if (row.kind === 'Mesh' && row.meshIndex !== undefined) {
                getActiveController()?.focusSelected(asset.inspection.getMeshPrimitiveObjects(row.nodeIndex, row.meshIndex)[0] ?? null);
              } else {
                getActiveController()?.focusSelected(asset.inspection.nodeToObject.get(row.nodeIndex) ?? null);
              }
            }}
          >
            <button
              className="tree-toggle"
              disabled={!row.collapsible}
              onClick={(event) => {
                event.stopPropagation();
                if (row.collapsible) {
                  toggle(row.key);
                }
              }}
            >
              {row.collapsible ? (collapsed.has(row.key) ? '+' : '-') : ''}
            </button>
            <span className={`tree-badge kind-${row.kind.toLowerCase()}`}>{row.kind[0]}</span>
            <span className="tree-name">{row.label}</span>
            <span className="tree-kind">{row.primitiveIndex ?? row.nodeIndex ?? ''}</span>
            {row.kind === 'Primitive' && (
              <button
                className="tree-visibility"
                onClick={(event) => {
                  event.stopPropagation();
                  setPrimitiveVisible(row, isPrimitiveHidden(row, hiddenPrimitives));
                }}
              >
                {isPrimitiveHidden(row, hiddenPrimitives) ? 'Show' : 'Hide'}
              </button>
            )}
          </div>
        ))}
      </div>
      </>
      )}
        </div>
      </div>
    </div>
  );
}

function IconActionButton({
  disabled,
  label,
  icon,
  onClick
}: {
  disabled: boolean;
  label: string;
  icon: 'expand' | 'collapse' | 'show' | 'hide';
  onClick: () => void;
}) {
  return (
    <button className="tree-action-icon" disabled={disabled} title={label} aria-label={label} onClick={onClick}>
      <TreeActionIcon name={icon} />
    </button>
  );
}

function TreeActionIcon({ name }: { name: 'expand' | 'collapse' | 'show' | 'hide' }) {
  return (
    <svg className="toolbar-icon" viewBox="0 0 24 24" aria-hidden="true">
      {name === 'expand' && <path d="M5 4h14v2H5V4Zm2 4h10v2H7V8Zm2 4h6v2H9v-2Zm2 4h2v4h-2v-4Zm-4 1.2L8.4 16 12 19.6 15.6 16l1.4 1.2-5 5-5-5Z" />}
      {name === 'collapse' && <path d="M5 4h14v2H5V4Zm2 4h10v2H7V8Zm2 4h6v2H9v-2Zm3 3.8L8.4 19.4 7 18.2l5-5 5 5-1.4 1.2L12 15.8Z" />}
      {name === 'show' && <path d="M12 5c5.2 0 8.6 4.3 9.7 6.2.3.5.3 1.1 0 1.6C20.6 14.7 17.2 19 12 19s-8.6-4.3-9.7-6.2a1.6 1.6 0 0 1 0-1.6C3.4 9.3 6.8 5 12 5Zm0 2c-4 0-6.8 3.2-7.8 5 1 1.8 3.8 5 7.8 5s6.8-3.2 7.8-5c-1-1.8-3.8-5-7.8-5Zm0 2.2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6Z" />}
      {name === 'hide' && <path d="m4.3 3 16.7 16.7-1.3 1.3-3-3A10.6 10.6 0 0 1 12 19c-5.2 0-8.6-4.3-9.7-6.2a1.6 1.6 0 0 1 0-1.6c.5-.9 1.5-2.2 2.8-3.4L3 4.3 4.3 3Zm2.2 6.2A12 12 0 0 0 4.2 12c1 1.8 3.8 5 7.8 5 1.1 0 2.1-.2 3-.7l-2-2a2.8 2.8 0 0 1-3.3-3.3L6.5 9.2ZM12 5c5.2 0 8.6 4.3 9.7 6.2.3.5.3 1.1 0 1.6-.4.7-1.1 1.7-2.1 2.7l-1.4-1.4c.7-.7 1.2-1.5 1.6-2.1-1-1.8-3.8-5-7.8-5-.7 0-1.4.1-2 .3L8.5 5.8C9.6 5.3 10.7 5 12 5Z" />}
    </svg>
  );
}

function buildRows(
  nodes: Array<{ name?: string; children?: number[]; mesh?: number }>,
  meshes: Array<{ name?: string; primitives?: unknown[] }>,
  collapsed: Set<string>
): TreeRow[] {
  const childSet = new Set(nodes.flatMap((node) => node.children ?? []));
  const rootNodes = nodes.map((_, index) => index).filter((index) => !childSet.has(index));
  const roots = rootNodes.length > 0 ? rootNodes : nodes.map((_, index) => index);
  const rows: TreeRow[] = [{ key: 'scene-0', kind: 'Scene', label: 'Scene 0', depth: 0, collapsible: roots.length > 0 }];
  if (!collapsed.has('scene-0')) {
    for (const root of roots) {
      appendNodeRows(rows, nodes, meshes, root, 1, collapsed);
    }
  }
  return rows;
}

function appendNodeRows(
  rows: TreeRow[],
  nodes: Array<{ name?: string; children?: number[]; mesh?: number }>,
  meshes: Array<{ name?: string; primitives?: unknown[] }>,
  nodeIndex: number,
  depth: number,
  collapsed: Set<string>
) {
  const node = nodes[nodeIndex];
  if (!node) {
    return;
  }
  const key = `node-${nodeIndex}`;
  const hasMesh = node.mesh !== undefined;
  const hasChildren = (node.children?.length ?? 0) > 0;
  rows.push({ key, kind: 'Node', label: node.name ?? `Node ${nodeIndex}`, depth, nodeIndex, collapsible: hasMesh || hasChildren });
  if (collapsed.has(key)) {
    return;
  }

  if (node.mesh !== undefined) {
    const mesh = meshes[node.mesh];
    const meshKey = `${key}-mesh-${node.mesh}`;
    rows.push({
      key: meshKey,
      kind: 'Mesh',
      label: mesh?.name ? `Mesh ${node.mesh}: ${mesh.name}` : `Mesh ${node.mesh}`,
      depth: depth + 1,
      nodeIndex,
      meshIndex: node.mesh,
      collapsible: (mesh?.primitives?.length ?? 0) > 0
    });
    if (!collapsed.has(meshKey)) {
      (mesh?.primitives ?? []).forEach((_, primitiveIndex) => {
        rows.push({
          key: `${meshKey}-primitive-${primitiveIndex}`,
          kind: 'Primitive',
          label: `Primitive ${primitiveIndex}`,
          depth: depth + 2,
          nodeIndex,
          meshIndex: node.mesh,
          primitiveIndex,
          collapsible: false
        });
      });
    }
  }

  for (const child of node.children ?? []) {
    appendNodeRows(rows, nodes, meshes, child, depth + 1, collapsed);
  }
}

function isSelected(
  row: TreeRow,
  selectedScene: boolean,
  selectedNodeIndex: number | null,
  selectedMesh: MeshSelection | null,
  selectedPrimitive: PrimitiveSelection | null
): boolean {
  if (row.kind === 'Scene') {
    return selectedScene;
  }
  if (row.kind === 'Primitive') {
    return Boolean(
      selectedPrimitive &&
        row.nodeIndex === selectedPrimitive.nodeIndex &&
        row.meshIndex === selectedPrimitive.meshIndex &&
        row.primitiveIndex === selectedPrimitive.primitiveIndex
    );
  }
  if (row.kind === 'Mesh') {
    return Boolean(selectedMesh && row.nodeIndex === selectedMesh.nodeIndex && row.meshIndex === selectedMesh.meshIndex);
  }
  return row.kind === 'Node' && row.nodeIndex === selectedNodeIndex && !selectedMesh && !selectedPrimitive;
}

function isPrimitiveHidden(row: TreeRow, hiddenPrimitives: Set<string>): boolean {
  return (
    row.nodeIndex !== undefined &&
    row.meshIndex !== undefined &&
    row.primitiveIndex !== undefined &&
    hiddenPrimitives.has(primitiveVisibilityKey(row.nodeIndex, row.meshIndex, row.primitiveIndex))
  );
}

function primitiveVisibilityKey(nodeIndex: number, meshIndex: number, primitiveIndex: number): string {
  return `${nodeIndex}:${meshIndex}:${primitiveIndex}`;
}
