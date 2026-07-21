import { useState } from 'react';
import { Matrix4 } from 'three';
import type { BufferGeometry } from 'three';
import type { GltfMeshDef, GltfPrimitiveDef, LoadedAsset } from '../../types/gltf';
import { useAssetStore } from '../../state/assetStore';
import { useSelectionStore } from '../../state/selectionStore';
import { useViewerStore } from '../../state/viewerStore';
import { summarizeBox, worldAabb } from '../../inspection/BoundingBoxInspector';
import { inspectTransform } from '../../inspection/TransformInspector';
import { inspectPrimitive } from '../../inspection/GeometryInspector';
import { ExtensionSection, MaterialSection, TextureSection } from './MaterialTextureSections';
import { CoordinateSection } from './CoordinateSection';
import { AnimationSkinMorphSection } from './AnimationSkinMorphSection';
import { PrimitiveUvSection } from './PrimitiveUvSection';

interface SelectionStatSummary {
  vertexCount: number;
  triangleCount: number;
  primitiveCount: number;
}

export function InspectorPanel() {
  const [topTab, setTopTab] = useState<'selection' | 'asset' | 'animation'>('asset');
  const [resourceTab, setResourceTab] = useState<'materials' | 'textures' | 'uv-map'>('materials');
  const [expandedNumbers, setExpandedNumbers] = useState(true);
  const asset = useAssetStore((state) => state.asset);
  const selectedScene = useSelectionStore((state) => state.selectedScene);
  const selectedNodeIndex = useSelectionStore((state) => state.selectedNodeIndex);
  const selectedPrimitive = useSelectionStore((state) => state.selectedPrimitive);
  const displayOffset = useViewerStore((state) => state.displayOffset);
  const object = selectedScene ? asset?.originalModel ?? null : selectedNodeIndex !== null ? asset?.inspection.nodeToObject.get(selectedNodeIndex) : null;
  const nodeDef = selectedNodeIndex !== null ? asset?.source.nodes[selectedNodeIndex] : undefined;
  const transform = object ? inspectTransform(nodeDef, object) : null;
  const geometry = object ? findFirstGeometry(object) : undefined;
  const worldBox = object ? summarizeBox(worldAabb(object)) : null;
  const mesh = nodeDef?.mesh !== undefined ? asset?.source.meshes[nodeDef.mesh] : undefined;
  const selectedPrimitiveDef = selectedPrimitive && asset ? asset.source.meshes[selectedPrimitive.meshIndex]?.primitives?.[selectedPrimitive.primitiveIndex] : undefined;
  const selectedMaterial = selectedPrimitiveDef?.material !== undefined && asset ? asset.source.materials[selectedPrimitiveDef.material] : undefined;
  const assetWorldBox = asset ? summarizeBox(worldAabb(asset.originalModel)) : null;

  return (
    <div className="panel inspector-split-panel">
      <div className="inspector-pane">
        <div className="panel-header">
          <span>Inspector</span>
          <label className="header-toggle">
            <input type="checkbox" checked={expandedNumbers} onChange={(event) => setExpandedNumbers(event.currentTarget.checked)} />
            Expanded Numbers
          </label>
        </div>
          <div className="inspector-pane-body">
          <div className="inspector-tabs vertical">
            <TabButton active={topTab === 'asset'} onClick={() => setTopTab('asset')}>Asset</TabButton>
            <TabButton active={topTab === 'selection'} onClick={() => setTopTab('selection')}>Selection</TabButton>
            <TabButton active={topTab === 'animation'} onClick={() => setTopTab('animation')}>Animation</TabButton>
          </div>
          <div className="panel-body inspector-content">
        {!asset && <div>No asset loaded.</div>}
        {asset && topTab === 'asset' && (
          <>
            <AssetStats asset={asset} />
            <section className="section">
              <h3 className="section-title">Asset</h3>
              <KeyValue label="Nodes" value={asset.source.nodes.length} />
              <KeyValue label="Meshes" value={asset.source.meshes.length} />
              <KeyValue label="Materials" value={asset.source.materials.length} />
              <KeyValue label="Textures" value={asset.source.textures.length} />
              <KeyValue label="Display Offset" value={format(displayOffset)} />
            </section>
            <section className="section">
              <h3 className="section-title">BBox</h3>
              <BoxBlock box={assetWorldBox} expandedNumbers={expandedNumbers} />
            </section>
            <ExtensionSection asset={asset} />
            <CoordinateSection analysis={asset.coordinateAnalysis} expandedNumbers={expandedNumbers} />
            {asset.validation && (
              <section className="section">
                <h3 className="section-title">Validation</h3>
                <KeyValue label="Errors" value={asset.validation.errors} />
                <KeyValue label="Warnings" value={asset.validation.warnings} />
                <KeyValue label="Infos" value={asset.validation.infos} />
                <KeyValue label="Hints" value={asset.validation.hints} />
              </section>
            )}
          </>
        )}
        {topTab === 'selection' && transform && (
          <>
          <SelectionStats asset={asset} selectedScene={selectedScene} mesh={mesh} geometry={geometry} selectedPrimitiveDef={selectedPrimitiveDef} />
          <section className="section">
            <h3 className="section-title">Transform</h3>
            <KeyValue label="Selection" value={selectedScene ? 'Scene' : 'Node'} />
            <KeyValue label="glTF node index" value={selectedScene ? '-' : selectedNodeIndex ?? '-'} />
            <KeyValue label="Name" value={selectedScene ? 'Scene' : nodeDef?.name ?? `Node ${selectedNodeIndex ?? ''}`} />
            <KeyValue label="Parent" value={object?.parent?.name || '-'} />
            <KeyValue label="Children" value={nodeDef?.children?.join(', ') ?? '-'} />
            <KeyValue label="Mesh" value={nodeDef?.mesh ?? '-'} />
            <KeyValue label="Skin" value={nodeDef?.skin ?? '-'} />
            <KeyValue label="Source T" value={format(transform.source.translation)} />
            <KeyValue label="Source R" value={format(transform.source.rotation)} />
            <KeyValue label="Source S" value={format(transform.source.scale)} />
            <KeyValue label="TRS Error" value={transform.source.recompositionError ?? '-'} />
            {transform.source.shearSuspected && <div className="issue warning">Source matrix decomposition exceeded tolerance. Shear or invalid transform is suspected.</div>}
            <Matrix label="Local Matrix Column-major" elements={transform.runtime.localMatrix} expandedNumbers={expandedNumbers} />
            <Matrix label="World Matrix Column-major" elements={transform.runtime.matrixWorld} expandedNumbers={expandedNumbers} />
            <KeyValue label="World Position" value={format(transform.runtime.worldPosition)} />
            <KeyValue label="Determinant" value={formatNumber(transform.runtime.determinant, expandedNumbers)} />
            <KeyValue label="Invertible" value={String(transform.runtime.invertible)} />
            <KeyValue label="Negative Scale" value={String(transform.runtime.negativeScale)} />
            <KeyValue label="Zero Scale" value={String(transform.runtime.zeroScale)} />
            <button onClick={() => void navigator.clipboard.writeText(JSON.stringify(transform.runtime.matrixWorld))}>Copy Matrix JSON</button>
            <button onClick={() => void navigator.clipboard.writeText(JSON.stringify(transform.runtime.worldPosition))}>Copy World Position</button>
          </section>
          </>
        )}
        {topTab === 'selection' && asset && selectedPrimitive && selectedPrimitiveDef && (
          <section className="section">
            <h3 className="section-title">Selected Primitive</h3>
            <KeyValue label="Node" value={selectedPrimitive.nodeIndex} />
            <KeyValue label="Mesh" value={selectedPrimitive.meshIndex} />
            <KeyValue label="Primitive" value={selectedPrimitive.primitiveIndex} />
            {(() => {
              const stats = inspectPrimitive(asset.source, selectedPrimitiveDef, geometry);
              return (
                <>
                  <KeyValue label="Mode" value={stats.mode} />
                  <KeyValue label="Indexed" value={String(stats.indexed)} />
                  <KeyValue label="Vertex Count" value={stats.vertexCount} />
                  <KeyValue label="Triangle Count" value={stats.triangleCount} />
                  <KeyValue label="Material Index" value={stats.materialIndex ?? '-'} />
                </>
              );
            })()}
            {selectedMaterial && (
              <>
                <h3 className="section-title">Selected Material</h3>
                <KeyValue label="Name" value={selectedMaterial.name ?? '-'} />
                <KeyValue label="baseColorFactor" value={jsonValue(objectValue(selectedMaterial.pbrMetallicRoughness)?.baseColorFactor)} />
                <KeyValue label="metallicFactor" value={jsonValue(objectValue(selectedMaterial.pbrMetallicRoughness)?.metallicFactor)} />
                <KeyValue label="roughnessFactor" value={jsonValue(objectValue(selectedMaterial.pbrMetallicRoughness)?.roughnessFactor)} />
                <KeyValue label="alphaMode" value={jsonValue(selectedMaterial.alphaMode)} />
                <KeyValue label="doubleSided" value={jsonValue(selectedMaterial.doubleSided)} />
              </>
            )}
          </section>
        )}
        {topTab === 'selection' && asset && !selectedPrimitive && mesh && (
          <section className="section">
            <h3 className="section-title">Selected Node Materials</h3>
            {(mesh.primitives ?? []).map((primitive, primitiveIndex) => {
              const material = primitive.material !== undefined ? asset.source.materials[primitive.material] : undefined;
              return (
                <div key={primitiveIndex} className="section">
                  <KeyValue label="Primitive" value={primitiveIndex} />
                  <KeyValue label="Material Index" value={primitive.material ?? '-'} />
                  <KeyValue label="Material Name" value={material?.name ?? '-'} />
                  <KeyValue label="baseColorFactor" value={jsonValue(objectValue(material?.pbrMetallicRoughness)?.baseColorFactor)} />
                  <KeyValue label="alphaMode" value={jsonValue(material?.alphaMode)} />
                  <KeyValue label="doubleSided" value={jsonValue(material?.doubleSided)} />
                </div>
              );
            })}
          </section>
        )}
        {topTab === 'selection' && asset && nodeDef?.mesh !== undefined && mesh && (
          <section className="section">
            <h3 className="section-title">Geometry</h3>
            <KeyValue label="Mesh Index" value={nodeDef.mesh} />
            <KeyValue label="Name" value={mesh.name ?? '-'} />
            {(mesh.primitives ?? []).map((primitive, primitiveIndex) => {
              const stats = inspectPrimitive(asset.source, primitive, geometry);
              return (
                <div key={primitiveIndex} className="section">
                  <KeyValue label="Primitive" value={primitiveIndex} />
                  <KeyValue label="Mode" value={stats.mode} />
                  <KeyValue label="Indexed" value={String(stats.indexed)} />
                  <KeyValue label="Vertex Count" value={stats.vertexCount} />
                  <KeyValue label="Index Count" value={stats.indexCount} />
                  <KeyValue label="Triangle Count" value={stats.triangleCount} />
                  <KeyValue label="Material" value={stats.materialIndex ?? '-'} />
                  <KeyValue label="Draco" value={String(stats.draco)} />
                  <KeyValue label="Meshopt" value={String(stats.meshopt)} />
                  <KeyValue label="Quantized" value={String(stats.quantized)} />
                </div>
              );
            })}
          </section>
        )}
        {topTab === 'selection' && object && (
          <section className="section">
            <h3 className="section-title">BBox</h3>
            <BoxBlock box={worldBox} expandedNumbers={expandedNumbers} />
          </section>
        )}
        {topTab === 'selection' && asset && !object && <div>Select a node or primitive.</div>}
        {topTab === 'animation' && asset && <AnimationSkinMorphSection asset={asset} selectedObject={object ?? null} />}
          </div>
        </div>
      </div>
      <div className="inspector-pane resource-pane">
        <div className="panel-header">Resources</div>
        <div className="inspector-pane-body">
          <div className="inspector-tabs vertical">
            <TabButton active={resourceTab === 'materials'} onClick={() => setResourceTab('materials')}>Materials</TabButton>
            <TabButton active={resourceTab === 'textures'} onClick={() => setResourceTab('textures')}>Textures</TabButton>
            <TabButton active={resourceTab === 'uv-map'} onClick={() => setResourceTab('uv-map')}>UV Map</TabButton>
          </div>
          <div className="panel-body inspector-content">
            {!asset && <div>No asset loaded.</div>}
            {asset && resourceTab === 'materials' && <MaterialSection asset={asset} />}
            {asset && resourceTab === 'textures' && <TextureSection asset={asset} />}
            {asset && resourceTab === 'uv-map' && <PrimitiveUvSection asset={asset} selectedPrimitive={selectedPrimitive} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function AssetStats({ asset }: { asset: LoadedAsset }) {
  const perf = asset.performance;
  return (
    <section className="section stats-section">
      <h3 className="section-title">Statistics</h3>
      <div className="stat-grid">
        <Stat label="Triangles" value={perf.triangleCount} />
        <Stat label="Vertices" value={perf.vertexCount} />
        <Stat label="Meshes" value={perf.meshCount} />
        <Stat label="Primitives" value={perf.primitiveCount} />
        <Stat label="Draw Calls" value={perf.drawCalls} />
        <Stat label="Textures" value={perf.textureCount} />
      </div>
    </section>
  );
}

function SelectionStats({
  asset,
  selectedScene,
  mesh,
  geometry,
  selectedPrimitiveDef
}: {
  asset: LoadedAsset | null;
  selectedScene: boolean;
  mesh?: GltfMeshDef;
  geometry?: BufferGeometry;
  selectedPrimitiveDef?: GltfPrimitiveDef;
}) {
  if (!asset || (!selectedScene && !selectedPrimitiveDef && !mesh)) {
    return null;
  }
  const stats: SelectionStatSummary = selectedScene
    ? {
      vertexCount: asset.performance.vertexCount,
      triangleCount: asset.performance.triangleCount,
      primitiveCount: asset.performance.primitiveCount
    }
    : selectedPrimitiveDef
    ? {
      vertexCount: inspectPrimitive(asset.source, selectedPrimitiveDef, geometry).vertexCount,
      triangleCount: inspectPrimitive(asset.source, selectedPrimitiveDef, geometry).triangleCount,
      primitiveCount: 1
    }
    : (mesh?.primitives ?? []).reduce<SelectionStatSummary>(
      (acc, primitive) => {
        const primitiveStats = inspectPrimitive(asset.source, primitive, geometry);
        acc.vertexCount += primitiveStats.vertexCount;
        acc.triangleCount += primitiveStats.triangleCount;
        acc.primitiveCount += 1;
        return acc;
      },
      { vertexCount: 0, triangleCount: 0, primitiveCount: 0 }
    );
  return (
    <section className="section stats-section">
      <h3 className="section-title">Selection Statistics</h3>
      <div className="stat-grid">
        <Stat label="Triangles" value={stats.triangleCount} />
        <Stat label="Vertices" value={stats.vertexCount} />
        <Stat label="Primitives" value={stats.primitiveCount} />
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong className="mono">{value}</strong>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className={`inspector-tab ${active ? 'active' : ''}`} onClick={onClick}>
      {children}
    </button>
  );
}

function KeyValue({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="kv"><span>{label}</span><span className="mono">{value}</span></div>;
}

function Matrix({ label, elements, expandedNumbers }: { label: string; elements: number[]; expandedNumbers?: boolean }) {
  const matrix = new Matrix4().fromArray(elements);
  const columnMajor = matrix.elements;
  const columnLabels = ['x', 'y', 'z', 'w'];
  const rowLabels = ['Right', 'Up', 'Dir', 'Pos'];
  return (
    <>
      <div className="section-title">{label}</div>
      <div className="matrix matrix-labeled mono">
        <div className="matrix-corner" />
        {columnLabels.map((column) => (
          <div key={column} className="matrix-heading">
            {column}
          </div>
        ))}
        {[0, 1, 2, 3].flatMap((row) => [
          <div key={`row-${row}`} className={`matrix-row-label ${row < 3 ? `axis-${row}` : 'axis-translation'}`}>{rowLabels[row]}</div>,
          ...[0, 1, 2, 3].map((col) => (
            <div key={`${row}-${col}`} className={row < 3 ? `axis-${row}` : 'axis-translation'}>
              {formatNumber(columnMajor[row * 4 + col] ?? 0, expandedNumbers)}
            </div>
          ))
        ])}
      </div>
    </>
  );
}

function BoxBlock({ box, expandedNumbers = false }: { box: ReturnType<typeof summarizeBox>; expandedNumbers?: boolean }) {
  return (
    <div>
      {!box && <div className="tree-kind">Empty</div>}
      {box && (
        <>
          <KeyValue label="min" value={format(box.min, expandedNumbers)} />
          <KeyValue label="max" value={format(box.max, expandedNumbers)} />
          <KeyValue label="center" value={format(box.center, expandedNumbers)} />
          <KeyValue label="center distance" value={formatNumber(box.centerDistanceFromOrigin, expandedNumbers)} />
        </>
      )}
    </div>
  );
}

function format(value: number[] | null, expandedNumbers = false): string {
  return value ? `[${value.map((entry) => formatNumber(entry, expandedNumbers)).join(', ')}]` : '-';
}

function formatNumber(value: number, expandedNumbers = false): string {
  if (!Number.isFinite(value)) {
    return String(value);
  }
  if (!expandedNumbers) {
    return Number(value).toPrecision(6);
  }
  const abs = Math.abs(value);
  if (abs === 0) {
    return '0';
  }
  const digits = abs >= 1 ? 8 : Math.min(16, Math.max(8, Math.ceil(-Math.log10(abs)) + 6));
  return value.toFixed(digits).replace(/\.?0+$/, '');
}

function findFirstGeometry(object: object): BufferGeometry | undefined {
  const root = object as { traverse?: (callback: (child: object) => void) => void; geometry?: BufferGeometry };
  if (root.geometry) {
    return root.geometry;
  }
  let geometry: BufferGeometry | undefined;
  root.traverse?.((child) => {
    if (!geometry) {
      geometry = (child as { geometry?: BufferGeometry }).geometry;
    }
  });
  return geometry;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function jsonValue(value: unknown): string {
  if (value === undefined || value === null) {
    return '-';
  }
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}
