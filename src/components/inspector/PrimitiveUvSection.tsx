import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';
import type { LoadedAsset } from '../../types/gltf';
import type { PrimitiveSelection } from '../../state/selectionStore';
import {
  inspectSelectedPrimitiveUvMapping,
  UV_TRIANGLE_PREVIEW_LIMIT,
  type TextureSlotMapping,
  type UvPoint,
  type UvTriangle
} from '../../inspection/UvMappingInspector';
import { resolveTexturePreview } from '../../inspection/TexturePreviewResolver';

export function PrimitiveUvSection({ asset, selectedPrimitive }: { asset: LoadedAsset; selectedPrimitive: PrimitiveSelection | null }) {
  const mappings = inspectSelectedPrimitiveUvMapping(asset, selectedPrimitive);

  return (
    <section className="section">
      <h3 className="section-title">Primitive UV Map</h3>
      {!selectedPrimitive && <div className="tree-kind">Select a primitive to inspect texture UV matching.</div>}
      {selectedPrimitive && mappings.length === 0 && (
        <div className="tree-kind">Selected primitive has no material texture slots with matching UV attributes.</div>
      )}
      {mappings.map((mapping) => (
        <div key={`${mapping.slot}-${mapping.textureIndex}-${mapping.texCoord}`} className="section">
          <KeyValue label="Slot" value={mapping.slot} />
          <KeyValue label="Texture" value={mapping.textureIndex} />
          <KeyValue label="TexCoord" value={`TEXCOORD_${mapping.texCoord} (${mapping.uvAttributeName})`} />
          <KeyValue label="UV Count" value={mapping.uvCount} />
          <KeyValue label="UV Min" value={formatUv(mapping.bounds.min)} />
          <KeyValue label="UV Max" value={formatUv(mapping.bounds.max)} />
          <UvTexturePreview asset={asset} mapping={mapping} />
        </div>
      ))}
    </section>
  );
}

function UvTexturePreview({ asset, mapping }: { asset: LoadedAsset; mapping: TextureSlotMapping }) {
  const [preview, setPreview] = useState<{ url: string | null; label: string }>({ url: null, label: 'loading' });
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [showAllTriangles, setShowAllTriangles] = useState(false);
  const isLimited = mapping.triangles.length > UV_TRIANGLE_PREVIEW_LIMIT;
  const visibleTriangles = showAllTriangles ? mapping.triangles : mapping.triangles.slice(0, UV_TRIANGLE_PREVIEW_LIMIT);

  useEffect(() => {
    let cancelled = false;
    let revokeUrl: string | null = null;
    setPreview({ url: null, label: 'loading' });
    setImageSize(null);
    setExpanded(false);
    setShowAllTriangles(false);
    void resolveTexturePreview(asset, mapping.textureIndex).then((result) => {
      if (cancelled) {
        if (result.revoke && result.url) {
          URL.revokeObjectURL(result.url);
        }
        return;
      }
      if (result.revoke) {
        revokeUrl = result.url;
      }
      setPreview({ url: result.url, label: result.label });
    });
    return () => {
      cancelled = true;
      if (revokeUrl) {
        URL.revokeObjectURL(revokeUrl);
      }
    };
  }, [asset, mapping.textureIndex]);

  if (!preview.url) {
    return <div className="uv-map-preview uv-map-preview-empty">{preview.label}</div>;
  }

  return (
    <figure className="uv-map-figure">
      {isLimited && (
        <div className="uv-map-warning">
          Rendering all {mapping.triangles.length} UV triangles can be slow.
          <label className="inline-toggle uv-map-toggle">
            <input type="checkbox" checked={showAllTriangles} onChange={(event) => setShowAllTriangles(event.currentTarget.checked)} />
            Show all
          </label>
        </div>
      )}
      <div className="uv-map-toolbar">
        <span>Wheel to zoom · drag to pan</span>
        <button type="button" onClick={() => setExpanded(true)}>Expand</button>
      </div>
      <UvMapCanvas
        previewUrl={preview.url}
        textureIndex={mapping.textureIndex}
        triangles={visibleTriangles}
        imageSize={imageSize}
        setImageSize={setImageSize}
      />
      <figcaption className="tree-kind">
        {preview.label} - {visibleTriangles.length} / {mapping.triangles.length} triangles shown
      </figcaption>
      {expanded && (
        <div className="uv-map-modal" onClick={() => setExpanded(false)}>
          <div className="uv-map-modal-body" onClick={(event) => event.stopPropagation()}>
            <UvMapCanvas
              previewUrl={preview.url}
              textureIndex={mapping.textureIndex}
              triangles={visibleTriangles}
              imageSize={imageSize}
              setImageSize={setImageSize}
              large
            />
            <div className="texture-modal-caption">Texture {mapping.textureIndex} {mapping.slot} · wheel to zoom · drag to pan</div>
          </div>
        </div>
      )}
    </figure>
  );
}

type UvView = { zoom: number; x: number; y: number };
const DEFAULT_UV_VIEW: UvView = { zoom: 1, x: 0, y: 0 };

function UvMapCanvas({
  previewUrl,
  textureIndex,
  triangles,
  imageSize,
  setImageSize,
  large = false
}: {
  previewUrl: string;
  textureIndex: number;
  triangles: UvTriangle[];
  imageSize: { width: number; height: number } | null;
  setImageSize: (size: { width: number; height: number }) => void;
  large?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [view, setView] = useState<UvView>(DEFAULT_UV_VIEW);

  useEffect(() => {
    let cancelled = false;
    const nextImage = new Image();
    nextImage.onload = () => {
      if (cancelled) {
        return;
      }
      const width = nextImage.naturalWidth || nextImage.width || 1;
      const height = nextImage.naturalHeight || nextImage.height || 1;
      setImageSize({ width, height });
      setImage(nextImage);
      setView(DEFAULT_UV_VIEW);
    };
    nextImage.src = previewUrl;
    return () => {
      cancelled = true;
    };
  }, [previewUrl, setImageSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) {
      return undefined;
    }
    const render = () => drawUvMap(canvas, image, triangles, view);
    const observer = new ResizeObserver(render);
    observer.observe(canvas);
    render();
    return () => observer.disconnect();
  }, [image, triangles, view]);

  const zoom = (event: ReactWheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const pointerX = event.clientX - rect.left - rect.width / 2;
    const pointerY = event.clientY - rect.top - rect.height / 2;
    const factor = Math.exp(-event.deltaY * 0.0015);
    setView((current) => {
      const nextZoom = Math.min(16, Math.max(0.5, current.zoom * factor));
      const ratio = nextZoom / current.zoom;
      return {
        zoom: nextZoom,
        x: pointerX - (pointerX - current.x) * ratio,
        y: pointerY - (pointerY - current.y) * ratio
      };
    });
  };

  const startPan = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const pan = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    const deltaX = event.clientX - drag.x;
    const deltaY = event.clientY - drag.y;
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    setView((current) => ({ ...current, x: current.x + deltaX, y: current.y + deltaY }));
  };

  const stopPan = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  };

  return (
    <div
      className={`uv-map-preview ${large ? 'large' : ''}`}
      style={imageSize ? { aspectRatio: `${imageSize.width} / ${imageSize.height}` } : undefined}
    >
      <canvas
        ref={canvasRef}
        aria-label={`Texture ${textureIndex} UV map`}
        onWheel={zoom}
        onPointerDown={startPan}
        onPointerMove={pan}
        onPointerUp={stopPan}
        onPointerCancel={stopPan}
      />
      <button className="uv-map-reset" type="button" onClick={() => setView(DEFAULT_UV_VIEW)}>Reset</button>
      <span className="uv-map-zoom">{Math.round(view.zoom * 100)}%</span>
    </div>
  );
}

function drawUvMap(canvas: HTMLCanvasElement, image: HTMLImageElement, triangles: UvTriangle[], view: UvView) {
  const cssWidth = Math.max(1, canvas.clientWidth);
  const cssHeight = Math.max(1, canvas.clientHeight);
  const pixelRatio = window.devicePixelRatio || 1;
  const width = Math.max(1, image.naturalWidth || image.width);
  const height = Math.max(1, image.naturalHeight || image.height);
  const renderWidth = Math.round(cssWidth * pixelRatio);
  const renderHeight = Math.round(cssHeight * pixelRatio);
  if (canvas.width !== renderWidth || canvas.height !== renderHeight) {
    canvas.width = renderWidth;
    canvas.height = renderHeight;
  }
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, cssWidth, cssHeight);
  const fitScale = Math.min(cssWidth / width, cssHeight / height);
  const scale = fitScale * view.zoom;
  const originX = cssWidth / 2 - width * scale / 2 + view.x;
  const originY = cssHeight / 2 - height * scale / 2 + view.y;
  context.imageSmoothingEnabled = false;
  context.drawImage(image, originX, originY, width * scale, height * scale);
  drawUvTriangles(context, triangles, width, height, originX, originY, scale);
}

function drawUvTriangles(
  context: CanvasRenderingContext2D,
  triangles: UvTriangle[],
  width: number,
  height: number,
  originX: number,
  originY: number,
  scale: number
) {
  context.save();
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.lineWidth = 1;
  context.strokeStyle = '#f7b267';
  context.fillStyle = 'rgba(247, 178, 103, 0.1)';
  for (const triangle of triangles) {
    const [first, second, third] = triangle.points;
    context.beginPath();
    context.moveTo(originX + wrap01(first.u) * width * scale, originY + wrap01(first.v) * height * scale);
    context.lineTo(originX + wrap01(second.u) * width * scale, originY + wrap01(second.v) * height * scale);
    context.lineTo(originX + wrap01(third.u) * width * scale, originY + wrap01(third.v) * height * scale);
    context.closePath();
    context.fill();
    context.stroke();
  }
  context.fillStyle = '#f7b267';
  const radius = 1;
  for (const triangle of triangles) {
    for (const point of triangle.points) {
      context.beginPath();
      context.arc(originX + wrap01(point.u) * width * scale, originY + wrap01(point.v) * height * scale, radius, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.restore();
}

function wrap01(value: number): number {
  return ((value % 1) + 1) % 1;
}

function formatUv(point: UvPoint): string {
  return `[${formatNumber(point.u)}, ${formatNumber(point.v)}]`;
}

function formatNumber(value: number): string {
  return Number.isFinite(value) ? Number(value).toPrecision(6) : String(value);
}

function KeyValue({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="kv"><span>{label}</span><span className="mono">{value}</span></div>;
}
