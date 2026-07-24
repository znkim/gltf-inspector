import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Vector3 } from 'three';
import { ViewerController } from '../../viewer/ViewerController';
import type { ViewAxis } from '../../viewer/CameraController';
import { loadGltfAsset } from '../../loaders/GltfAssetLoader';
import { bundleFromSampleAsset, SAMPLE_ASSETS, type SampleAsset } from '../../loaders/SampleAssets';
import { useAssetStore } from '../../state/assetStore';
import { useSelectionStore } from '../../state/selectionStore';
import { useSettingsStore } from '../../state/settingsStore';
import { useViewerStore } from '../../state/viewerStore';
import { getActiveController, getActiveRenderer, setActiveController } from './viewportController';

export function Viewport() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerDownRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const asset = useAssetStore((state) => state.asset);
  const issues = useAssetStore((state) => state.issues);
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
  const lightingMode = useViewerStore((state) => state.lightingMode);
  const environmentMode = useViewerStore((state) => state.environmentMode);
  const backgroundColor = useViewerStore((state) => state.backgroundColor);
  const setBackgroundColor = useViewerStore((state) => state.setBackgroundColor);
  const cameraMode = useViewerStore((state) => state.cameraMode);
  const upAxis = useViewerStore((state) => state.upAxis);
  const autoOrbit = useViewerStore((state) => state.autoOrbit);
  const displayRecenter = useViewerStore((state) => state.displayRecenter);
  const renderStateOverrides = useViewerStore((state) => state.renderStateOverrides);
  const setDisplayOffset = useViewerStore((state) => state.setDisplayOffset);
  const settings = useSettingsStore();

  const openSample = async (sample: SampleAsset) => {
    if (loading) {
      return;
    }
    const renderer = getActiveRenderer();
    if (!renderer) {
      addIssue({ id: 'renderer-not-ready', severity: 'error', code: 'RENDERER_NOT_READY', message: 'Renderer is not ready yet.' });
      return;
    }
    setLoading(true);
    try {
      const bundle = await bundleFromSampleAsset(sample);
      setAsset(await loadGltfAsset(bundle, renderer));
      useSelectionStore.getState().setSelectedNodeIndex(null);
    } catch (error) {
      clearAsset();
      addIssue({
        id: `sample-${sample.id}-${Date.now()}`,
        severity: 'error',
        code: 'LOAD_FAILED',
        message: error instanceof Error ? error.message : String(error)
      });
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canvasRef.current) {
      return undefined;
    }
    const canvas = canvasRef.current;
    const controller = new ViewerController(canvas);
    setActiveController(controller);
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) {
        return;
      }
      controller.resize(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(canvas);
    const clickMoveThresholdPx = 4;
    const clickTimeThresholdMs = 450;
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        pointerDownRef.current = null;
        return;
      }
      pointerDownRef.current = { x: event.clientX, y: event.clientY, time: performance.now() };
    };
    const onPointerUp = (event: PointerEvent) => {
      const start = pointerDownRef.current;
      pointerDownRef.current = null;
      if (!start || event.button !== 0) {
        return;
      }
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      const moved = Math.hypot(dx, dy);
      const elapsed = performance.now() - start.time;
      if (moved > clickMoveThresholdPx || elapsed > clickTimeThresholdMs) {
        return;
      }
      const selection = controller.pick(event);
      if (!selection) {
        useSelectionStore.getState().setSelectedNodeIndex(null);
        return;
      }
      if (selection.meshIndex !== undefined && selection.primitiveIndex !== undefined) {
        useSelectionStore.getState().setSelectedPrimitive({
          nodeIndex: selection.nodeIndex,
          meshIndex: selection.meshIndex,
          primitiveIndex: selection.primitiveIndex
        });
      } else {
        setSelectedNodeIndex(selection.nodeIndex);
      }
    };
    const onPointerMove = (event: PointerEvent) => {
      canvas.style.cursor = controller.canPick(event) ? 'pointer' : 'default';
    };
    const onPointerLeave = () => {
      canvas.style.cursor = 'default';
    };
    const onDoubleClick = (event: MouseEvent) => {
      const selection = controller.pick(event);
      const currentAsset = useAssetStore.getState().asset;
      if (!selection || !currentAsset) {
        return;
      }
      if (selection.meshIndex !== undefined && selection.primitiveIndex !== undefined) {
        useSelectionStore.getState().setSelectedPrimitive({
          nodeIndex: selection.nodeIndex,
          meshIndex: selection.meshIndex,
          primitiveIndex: selection.primitiveIndex
        });
        controller.focusSelected(currentAsset.inspection.getPrimitiveObject(selection.nodeIndex, selection.meshIndex, selection.primitiveIndex));
      } else {
        setSelectedNodeIndex(selection.nodeIndex);
        controller.focusSelected(currentAsset.inspection.nodeToObject.get(selection.nodeIndex) ?? null);
      }
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('dblclick', onDoubleClick);
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('dblclick', onDoubleClick);
      canvas.style.cursor = 'default';
      observer.disconnect();
      controller.dispose();
      setActiveController(null);
    };
  }, [setSelectedNodeIndex]);

  useEffect(() => {
    getActiveController()?.setAsset(asset);
  }, [asset]);

  useEffect(() => {
    getActiveController()?.setRenderMode(renderMode);
  }, [renderMode, asset]);

  useEffect(() => {
    getActiveController()?.setRenderStateOverrides(renderStateOverrides);
  }, [renderStateOverrides, asset]);

  useEffect(() => {
    getActiveController()?.setBackgroundColor(backgroundColor);
  }, [backgroundColor]);

  useEffect(() => {
    getActiveController()?.setLightingMode(lightingMode);
  }, [lightingMode]);

  useEffect(() => {
    getActiveController()?.setEnvironmentMode(environmentMode);
  }, [environmentMode]);

  useEffect(() => {
    getActiveController()?.cameraController.setAutoOrbit(autoOrbit);
  }, [autoOrbit]);

  useEffect(() => {
    const selection = useSelectionStore.getState();
    const currentAsset = useAssetStore.getState().asset;
    const focusObject =
      selection.selectedScene && currentAsset
        ? currentAsset.originalModel
        : selection.selectedPrimitive && currentAsset
        ? currentAsset.inspection.getPrimitiveObject(
            selection.selectedPrimitive.nodeIndex,
            selection.selectedPrimitive.meshIndex,
            selection.selectedPrimitive.primitiveIndex
          )
        : selection.selectedMesh && currentAsset
          ? currentAsset.inspection.getMeshPrimitiveObjects(selection.selectedMesh.nodeIndex, selection.selectedMesh.meshIndex)[0] ?? null
        : selection.selectedNodeIndex !== null
          ? currentAsset?.inspection.nodeToObject.get(selection.selectedNodeIndex) ?? null
          : currentAsset?.originalModel ?? null;
    getActiveController()?.cameraController.setMode(cameraMode, focusObject);
  }, [cameraMode]);

  useEffect(() => {
    const controller = getActiveController();
    setDisplayOffset(controller?.setDisplayTransform(displayRecenter, upAxis) ?? [0, 0, 0]);
    if (displayRecenter && asset) {
      controller?.focusScene();
    }
  }, [displayRecenter, upAxis, asset, setDisplayOffset]);

  useEffect(() => {
    const object = selectedScene ? asset?.originalModel ?? null : selectedNodeIndex !== null ? asset?.inspection.nodeToObject.get(selectedNodeIndex) ?? null : null;
    const highlightObjects = selectedPrimitive
      ? [asset?.inspection.getPrimitiveObject(selectedPrimitive.nodeIndex, selectedPrimitive.meshIndex, selectedPrimitive.primitiveIndex)].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      : selectedMesh && asset
        ? asset.inspection.getMeshPrimitiveObjects(selectedMesh.nodeIndex, selectedMesh.meshIndex)
        : object
          ? [object]
          : [];
    getActiveController()?.updateHelpers(
      object,
      highlightObjects,
      settings.showGrid,
      settings.showWorldAxes,
      settings.showGeometryLocalBox,
      settings.showWorldAabb
    );
  }, [
    asset,
    displayRecenter,
    selectedScene,
    selectedMesh,
    selectedNodeIndex,
    selectedPrimitive,
    settings.showGeometryLocalBox,
    settings.showGrid,
    settings.showWorldAabb,
    settings.showWorldAxes,
    upAxis
  ]);

  return (
    <div className="panel viewport-panel">
      <div className="panel-header">
        <span>Main Frame</span>
        <span className="tree-kind">{loading ? 'Loading' : asset ? 'Ready' : 'No Asset'}</span>
      </div>
      <div className="viewport-shell" style={{ backgroundColor }}>
        <canvas ref={canvasRef} className="viewport" />
        <ViewGizmo />
        <div className="viewport-floating-controls" aria-label="Viewport helpers">
          <button
            className={settings.showGrid ? 'viewport-floating-toggle active' : 'viewport-floating-toggle'}
            onClick={() => settings.setShowGrid(!settings.showGrid)}
            title="Grid"
            aria-label="Grid"
          >
            <ViewportIcon name="grid" />
          </button>
          <button
            className={settings.showWorldAxes ? 'viewport-floating-toggle active' : 'viewport-floating-toggle'}
            onClick={() => settings.setShowWorldAxes(!settings.showWorldAxes)}
            title="Axes"
            aria-label="Axes"
          >
            <ViewportIcon name="axes" />
          </button>
          <label className="viewport-color-control" title="Background Color" aria-label="Background Color">
            <ViewportIcon name="background" />
            <span className="viewport-color-swatch" style={{ backgroundColor }} />
            <input type="color" value={backgroundColor} onChange={(event) => setBackgroundColor(event.currentTarget.value)} />
          </label>
        </div>
        {!asset && issues.length > 0 && (
          <div className="viewport-message">
            <strong>{issues[issues.length - 1]?.code}</strong>
            <span>{issues[issues.length - 1]?.message}</span>
          </div>
        )}
        {!asset && issues.length === 0 && !loading && <SampleAssetPicker onOpenSample={(sample) => void openSample(sample)} />}
        {loading && (
          <div className="viewport-loading-backdrop">
            <div className="viewport-loading" role="status" aria-live="polite">
              <strong>Loading asset</strong>
              <span>Reading and parsing glTF resources...</span>
              <div className="viewport-progress" aria-hidden="true">
                <div />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SampleAssetPicker({ onOpenSample }: { onOpenSample: (sample: SampleAsset) => void }) {
  return (
    <div className="sample-picker" aria-label="Sample assets">
      <div className="sample-picker-header">
        <strong>Open a sample GLB</strong>
        <span>or drag a glTF asset into the viewport</span>
      </div>
      <div className="sample-picker-list">
        {SAMPLE_ASSETS.map((sample) => (
          <button key={sample.id} className="sample-picker-item" onClick={() => onOpenSample(sample)}>
            <img
              className="sample-picker-thumbnail"
              src={`${import.meta.env.BASE_URL}thumbnails/${sample.thumbnailFileName}`}
              alt=""
              loading="lazy"
              draggable={false}
            />
            <span className="sample-picker-copy">
              <strong>{sample.name}</strong>
              <span>{sample.description}</span>
              <small>{sample.license}</small>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

interface GizmoAxisLayout {
  axis: ViewAxis;
  label: string;
  className: string;
  x: number;
  y: number;
  z: number;
  size: number;
  opacity: number;
}

const GIZMO_AXES: Array<{ axis: ViewAxis; label: string; className: string; vector: Vector3 }> = [
  { axis: 'x', label: 'X', className: 'axis-x', vector: new Vector3(1, 0, 0) },
  { axis: '-x', label: '-X', className: 'axis-x negative', vector: new Vector3(-1, 0, 0) },
  { axis: 'y', label: 'Y', className: 'axis-y', vector: new Vector3(0, 1, 0) },
  { axis: '-y', label: '-Y', className: 'axis-y negative', vector: new Vector3(0, -1, 0) },
  { axis: 'z', label: 'Z', className: 'axis-z', vector: new Vector3(0, 0, 1) },
  { axis: '-z', label: '-Z', className: 'axis-z negative', vector: new Vector3(0, 0, -1) }
];

function ViewGizmo() {
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [axes, setAxes] = useState<GizmoAxisLayout[]>(() => projectGizmoAxes());

  useEffect(() => {
    let frame = 0;
    const update = () => {
      setAxes(projectGizmoAxes());
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, []);

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const drag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const previous = dragRef.current;
    if (!previous) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const deltaX = event.clientX - previous.x;
    const deltaY = event.clientY - previous.y;
    dragRef.current = { x: event.clientX, y: event.clientY };
    getActiveController()?.cameraController.orbitBy(deltaX, deltaY);
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const viewAxis = (axis: ViewAxis) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    getActiveController()?.cameraController.viewAxis(axis);
  };

  return (
    <div
      className="view-gizmo"
      aria-label="View gizmo"
      onPointerDown={beginDrag}
      onPointerMove={drag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className="view-gizmo-sphere">
        <svg className="view-gizmo-lines" viewBox="0 0 104 104" aria-hidden="true">
          {[...axes].sort((a, b) => a.z - b.z).map((entry) => (
            <line
              key={entry.axis}
              className={`view-gizmo-line ${entry.className}`}
              x1="52"
              y1="52"
              x2={entry.x}
              y2={entry.y}
              style={{ opacity: entry.opacity * 0.72 }}
            />
          ))}
        </svg>
        {[...axes].sort((a, b) => a.z - b.z).map((entry) => (
          <button
            key={entry.axis}
            className={`view-gizmo-axis ${entry.className}`}
            style={{
              left: entry.x,
              top: entry.y,
              width: entry.size,
              minHeight: entry.size,
              opacity: entry.opacity,
              zIndex: Math.round((entry.z + 1) * 100)
            }}
            onPointerDown={viewAxis(entry.axis)}
          >
            {entry.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function projectGizmoAxes(): GizmoAxisLayout[] {
  const controller = getActiveController();
  const camera = controller?.cameraController.active;
  const target = controller?.cameraController.controls.target;
  const center = 52;
  const radius = 34;
  if (!camera || !target) {
    return GIZMO_AXES.map((entry) => ({
      ...entry,
      x: center + entry.vector.x * radius,
      y: center - entry.vector.y * radius,
      z: entry.vector.z,
      size: entry.vector.z >= 0 ? 25 : 20,
      opacity: entry.vector.z >= 0 ? 1 : 0.48
    }));
  }
  camera.updateMatrixWorld();
  const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
  const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();
  const cameraDirection = camera.position.clone().sub(target).normalize();
  return GIZMO_AXES.map((entry) => {
    const x = entry.vector.dot(right);
    const y = entry.vector.dot(up);
    const z = entry.vector.dot(cameraDirection);
    return {
      ...entry,
      x: center + x * radius,
      y: center - y * radius,
      z,
      size: 21 + (z + 1) * 3.5,
      opacity: 0.42 + (z + 1) * 0.29
    };
  });
}

function ViewportIcon({ name }: { name: 'grid' | 'axes' | 'background' }) {
  return (
    <svg className="toolbar-icon" viewBox="0 0 24 24" aria-hidden="true">
      {name === 'grid' && <path d="M4 4h16v16H4V4Zm2 2v3h3V6H6Zm5 0v3h2V6h-2Zm4 0v3h3V6h-3ZM6 11v2h3v-2H6Zm5 0v2h2v-2h-2Zm4 0v2h3v-2h-3ZM6 15v3h3v-3H6Zm5 0v3h2v-3h-2Zm4 0v3h3v-3h-3Z" />}
      {name === 'axes' && <path d="M12 3h2v13.2l3.6-3.6L19 14l-6 6-6-6 1.4-1.4 3.6 3.6V3Zm-7 9h5v2H5v-2Zm9-7h5v2h-5V5Z" />}
      {name === 'background' && <path d="M12 3a9 9 0 1 1 0 18 4.2 4.2 0 0 1-1.7-.3 1.7 1.7 0 0 1-.9-2.4c.3-.5.2-.9-.1-1.2-.3-.3-.8-.4-1.4-.2A3.5 3.5 0 0 1 3 13.6C3 7.7 6.9 3 12 3Zm-4.2 9.5a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8Zm3-4.4a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8Zm5.4 1.2a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8Zm1.1 5.1a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8Z" />}
    </svg>
  );
}
