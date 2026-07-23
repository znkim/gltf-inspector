import { useRef } from 'react';
import { AssetBundle } from '../../loaders/AssetBundle';
import { loadGltfAsset } from '../../loaders/GltfAssetLoader';
import { useAssetStore } from '../../state/assetStore';
import { useSelectionStore } from '../../state/selectionStore';
import { useViewerStore } from '../../state/viewerStore';
import { getActiveController, getActiveRenderer } from '../layout/viewportController';
import type { EnvironmentMode, LightingMode, RenderMode } from '../../types/gltf';
import { downloadInspectionReport } from '../../inspection/ReportExporter';

const logoUrl = `${import.meta.env.BASE_URL}favicon.svg`;

export function Toolbar() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const asset = useAssetStore((state) => state.asset);
  const loading = useAssetStore((state) => state.loading);
  const clearAsset = useAssetStore((state) => state.clearAsset);
  const setAsset = useAssetStore((state) => state.setAsset);
  const setLoading = useAssetStore((state) => state.setLoading);
  const addIssue = useAssetStore((state) => state.addIssue);
  const selectedScene = useSelectionStore((state) => state.selectedScene);
  const selectedNodeIndex = useSelectionStore((state) => state.selectedNodeIndex);
  const selectedMesh = useSelectionStore((state) => state.selectedMesh);
  const selectedPrimitive = useSelectionStore((state) => state.selectedPrimitive);
  const setSelectedNodeIndex = useSelectionStore((state) => state.setSelectedNodeIndex);
  const renderMode = useViewerStore((state) => state.renderMode);
  const setRenderMode = useViewerStore((state) => state.setRenderMode);
  const lightingMode = useViewerStore((state) => state.lightingMode);
  const setLightingMode = useViewerStore((state) => state.setLightingMode);
  const environmentMode = useViewerStore((state) => state.environmentMode);
  const setEnvironmentMode = useViewerStore((state) => state.setEnvironmentMode);
  const cameraMode = useViewerStore((state) => state.cameraMode);
  const setCameraMode = useViewerStore((state) => state.setCameraMode);
  const upAxis = useViewerStore((state) => state.upAxis);
  const setUpAxis = useViewerStore((state) => state.setUpAxis);
  const autoOrbit = useViewerStore((state) => state.autoOrbit);
  const setAutoOrbit = useViewerStore((state) => state.setAutoOrbit);
  const displayRecenter = useViewerStore((state) => state.displayRecenter);
  const setDisplayRecenter = useViewerStore((state) => state.setDisplayRecenter);

  const openFiles = async (files: FileList | null) => {
    if (loading || !files || files.length === 0) {
      return;
    }
    const renderer = getActiveRenderer();
    if (!renderer) {
      return;
    }
    setLoading(true);
    try {
      const bundle = await AssetBundle.fromFileList(files);
      setAsset(await loadGltfAsset(bundle, renderer));
      setSelectedNodeIndex(null);
    } catch (error) {
      clearAsset();
      addIssue({ id: `open-${Date.now()}`, severity: 'error', code: 'LOAD_FAILED', message: error instanceof Error ? error.message : String(error) });
      setLoading(false);
    }
  };

  return (
    <div className="toolbar">
      <div className="toolbar-title"><img src={logoUrl} alt="" className="toolbar-logo" /> glTF Inspector</div>
      <button className="toolbar-button" disabled={loading} onClick={() => inputRef.current?.click()}><ToolbarIcon name="open" /> Open</button>
      <input ref={inputRef} hidden type="file" multiple accept=".glb,.gltf,.bin,.png,.jpg,.jpeg,.webp,.ktx2,.zip" onChange={(event) => void openFiles(event.currentTarget.files)} />
      <button
        className="toolbar-button"
        disabled={!asset || loading}
        onClick={() => {
          clearAsset();
          setSelectedNodeIndex(null);
        }}
      >
        <ToolbarIcon name="close" /> Close
      </button>
      <button className="toolbar-button" disabled={!asset || loading} onClick={() => getActiveController()?.focusScene()}><ToolbarIcon name="frame" /> Frame Scene</button>
      <button
        className="toolbar-button"
        disabled={loading || !asset || (!selectedScene && selectedNodeIndex === null)}
        onClick={() => {
          if (!asset || (!selectedScene && selectedNodeIndex === null)) {
            return;
          }
          let object = null;
          if (selectedScene) {
            object = asset.originalModel;
          } else if (selectedPrimitive) {
            object = asset.inspection.getPrimitiveObject(selectedPrimitive.nodeIndex, selectedPrimitive.meshIndex, selectedPrimitive.primitiveIndex);
          } else if (selectedMesh) {
            object = asset.inspection.getMeshPrimitiveObjects(selectedMesh.nodeIndex, selectedMesh.meshIndex)[0] ?? null;
          } else if (selectedNodeIndex !== null) {
            object = asset.inspection.nodeToObject.get(selectedNodeIndex) ?? null;
          }
          getActiveController()?.focusSelected(object);
        }}
      >
        <ToolbarIcon name="target" /> Frame Selected
      </button>
      <button
        className="toolbar-icon-toggle"
        onClick={() => setCameraMode(cameraMode === 'perspective' ? 'orthographic' : 'perspective')}
        title={cameraMode === 'perspective' ? 'Perspective View' : 'Orthographic View'}
        aria-label={cameraMode === 'perspective' ? 'Perspective View' : 'Orthographic View'}
      >
        <ToolbarIcon name={cameraMode === 'perspective' ? 'perspective' : 'orthographic'} />
      </button>
      <button
        className="toolbar-icon-toggle"
        onClick={() => setUpAxis(upAxis === 'Y' ? 'Z' : 'Y')}
        title={upAxis === 'Y' ? 'Y Up Axis' : 'Z Up Axis'}
        aria-label={upAxis === 'Y' ? 'Y Up Axis' : 'Z Up Axis'}
      >
        <ToolbarIcon name={upAxis === 'Y' ? 'y-up' : 'z-up'} />
      </button>
      <label className="toolbar-field">
        <span>Render</span>
        <select className="toolbar-select" value={renderMode} onChange={(event) => setRenderMode(event.currentTarget.value as RenderMode)} title="Render Mode" aria-label="Render Mode">
          <optgroup label="Shading">
            <option value="pbr">PBR</option>
            <option value="unlit">Unlit</option>
            <option value="base-color">Base Color</option>
            <option value="vertex-color">Vertex Color</option>
          </optgroup>
          <optgroup label="Geometry">
            <option value="face-orientation">Face Orientation</option>
            <option value="wireframe-white">Wire White</option>
            <option value="wireframe-overlay">Wire Overlay</option>
            <option value="triangle-color">Triangle Color</option>
          </optgroup>
          <optgroup label="Normals">
            <option value="eye-normal">Eye Normal</option>
            <option value="world-normal">World Normal</option>
            <option value="normal-texture">Normal Texture</option>
          </optgroup>
          <optgroup label="UV">
            <option value="uv-color">UV Color</option>
            <option value="uv-checker">UV Checker</option>
          </optgroup>
          <optgroup label="ID / Depth">
            <option value="linear-depth">Linear Depth</option>
            <option value="material-id">Material ID</option>
            <option value="node-id">Node ID</option>
          </optgroup>
        </select>
      </label>
      <label className="toolbar-field">
        <span>Light</span>
        <select
          className="toolbar-select compact"
          value={lightingMode}
          onChange={(event) => setLightingMode(event.currentTarget.value as LightingMode)}
          title="Lighting Mode"
          aria-label="Lighting Mode"
        >
          <option value="studio">Studio</option>
          <option value="neutral">Neutral</option>
          <option value="bright">Bright</option>
          <option value="flat">Flat</option>
          <option value="none">None</option>
        </select>
      </label>
      <label className="toolbar-field">
        <span>Env</span>
        <select
          className="toolbar-select compact"
          value={environmentMode}
          onChange={(event) => setEnvironmentMode(event.currentTarget.value as EnvironmentMode)}
          title="Lighting Environment"
          aria-label="Lighting Environment"
        >
          <option value="none">None</option>
          <option value="studio">Studio</option>
          <option value="day">Day</option>
          <option value="sunset">Sunset</option>
          <option value="night">Night</option>
        </select>
      </label>
      <button
        className={displayRecenter ? 'toolbar-icon-toggle active' : 'toolbar-icon-toggle'}
        onClick={() => setDisplayRecenter(!displayRecenter)}
        title="Display Recenter"
        aria-label="Display Recenter"
      >
        <ToolbarIcon name="center" />
      </button>
      <button
        className={autoOrbit ? 'toolbar-icon-toggle active' : 'toolbar-icon-toggle'}
        onClick={() => setAutoOrbit(!autoOrbit)}
        title="Auto Orbit"
        aria-label="Auto Orbit"
      >
        <ToolbarIcon name="orbit" />
      </button>
      <div className="toolbar-spacer" />
      <button className="toolbar-button" disabled={!asset || loading} onClick={() => getActiveController()?.screenshot()}><ToolbarIcon name="camera" /> Screenshot</button>
      <button className="toolbar-button" disabled={!asset || loading} onClick={() => asset && downloadInspectionReport(asset)}><ToolbarIcon name="download" /> Export Report</button>
    </div>
  );
}

type ToolbarIconName =
  | 'open'
  | 'close'
  | 'frame'
  | 'target'
  | 'grid'
  | 'axes'
  | 'box'
  | 'center'
  | 'orbit'
  | 'camera'
  | 'download'
  | 'perspective'
  | 'orthographic'
  | 'y-up'
  | 'z-up';

function ToolbarIcon({ name }: { name: ToolbarIconName }) {
  return (
    <svg className="toolbar-icon" viewBox="0 0 24 24" aria-hidden="true">
      {name === 'open' && <path d="M4 19V6h6l2 2h8v11H4Zm2-2h12v-7h-6.8l-2-2H6v9Z" />}
      {name === 'close' && <path d="m6.4 19 5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6L19 6.4 17.6 5 12 10.6 6.4 5 5 6.4l5.6 5.6L5 17.6 6.4 19Z" />}
      {name === 'frame' && <path d="M4 10V4h6v2H6v4H4Zm14 0V6h-4V4h6v6h-2ZM4 20v-6h2v4h4v2H4Zm10 0v-2h4v-4h2v6h-6Z" />}
      {name === 'target' && <path d="M11 21v-3.1a6 6 0 0 1-4.9-4.9H3v-2h3.1A6 6 0 0 1 11 6.1V3h2v3.1a6 6 0 0 1 4.9 4.9H21v2h-3.1a6 6 0 0 1-4.9 4.9V21h-2Zm1-5a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />}
      {name === 'grid' && <path d="M4 4h16v16H4V4Zm2 2v3h3V6H6Zm5 0v3h2V6h-2Zm4 0v3h3V6h-3ZM6 11v2h3v-2H6Zm5 0v2h2v-2h-2Zm4 0v2h3v-2h-3ZM6 15v3h3v-3H6Zm5 0v3h2v-3h-2Zm4 0v3h3v-3h-3Z" />}
      {name === 'axes' && <path d="M12 3h2v13.2l3.6-3.6L19 14l-6 6-6-6 1.4-1.4 3.6 3.6V3Zm-7 9h5v2H5v-2Zm9-7h5v2h-5V5Z" />}
      {name === 'box' && <path d="m12 2 8 4.5v9L12 20l-8-4.5v-9L12 2Zm0 2.3L7 7.1l5 2.8 5-2.8-5-2.8ZM6 8.8v5.5l5 2.8v-5.5L6 8.8Zm12 0-5 2.8v5.5l5-2.8V8.8Z" />}
      {name === 'center' && <path d="M11 4h2v6h6v2h-6v8h-2v-8H5v-2h6V4Zm-7 7a8 8 0 0 1 8-8v2a6 6 0 0 0-6 6H4Zm16 0h-2a6 6 0 0 0-6-6V3a8 8 0 0 1 8 8Zm-8 10a8 8 0 0 1-8-8h2a6 6 0 0 0 6 6v2Zm0 0v-2a6 6 0 0 0 6-6h2a8 8 0 0 1-8 8Z" />}
      {name === 'orbit' && <path d="M12 5.5c-3.7 0-6.7 2.3-6.7 5.1 0 1.4.8 2.7 2.1 3.6l-1.2 1.6C4.4 14.5 3.3 12.7 3.3 10.6 3.3 6.6 7.2 3.5 12 3.5h.5l-1.8-1.8L12.1.3 16.4 4.6 12.1 8.9l-1.4-1.4 2-2H12Zm5.8 1.1c1.8 1.3 2.9 3.1 2.9 5.2 0 4-3.9 7.1-8.7 7.1h-.5l1.8 1.8-1.4 1.4-4.3-4.3 4.3-4.3 1.4 1.4-2 2h.7c3.7 0 6.7-2.3 6.7-5.1 0-1.4-.8-2.7-2.1-3.6l1.2-1.6Z" />}
      {name === 'camera' && <path d="M4 7h4l1.5-2h5L16 7h4v12H4V7Zm2 2v8h12V9h-3l-1.5-2h-3L9 9H6Zm6 7a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Zm0-2a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />}
      {name === 'download' && <path d="M11 4h2v8.2l3.1-3.1 1.4 1.4-5.5 5.5-5.5-5.5 1.4-1.4 3.1 3.1V4ZM5 18h14v2H5v-2Z" />}
      {name === 'perspective' && <path d="M4 5h16l-3 14H7L4 5Zm2.5 2 2.15 10h6.7L17.5 7h-11ZM10 9l2 3 2-3h2.2L12 15.2 7.8 9H10Z" />}
      {name === 'orthographic' && <path d="M5 5h14v14H5V5Zm2 2v10h10V7H7Zm2 2h6v2H9V9Zm0 4h6v2H9v-2Z" />}
      {name === 'y-up' && (
        <>
          <path d="M11 20V7.8l-3.4 3.4L6.2 9.8 12 4l5.8 5.8-1.4 1.4L13 7.8V20h-2Z" />
          <text x="12" y="23" textAnchor="middle" fontSize="7" fontWeight="800" fill="currentColor">+Y</text>
        </>
      )}
      {name === 'z-up' && (
        <>
          <path d="M11 20V7.8l-3.4 3.4L6.2 9.8 12 4l5.8 5.8-1.4 1.4L13 7.8V20h-2Z" />
          <text x="12" y="23" textAnchor="middle" fontSize="7" fontWeight="800" fill="currentColor">+Z</text>
        </>
      )}
    </svg>
  );
}
