import { useEffect, useRef, useState } from 'react';
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
      <button className="uv-map-preview-button" onClick={() => setExpanded(true)}>
        <UvMapCanvas
          previewUrl={preview.url}
          textureIndex={mapping.textureIndex}
          triangles={visibleTriangles}
          imageSize={imageSize}
          setImageSize={setImageSize}
        />
      </button>
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
            <div className="texture-modal-caption">Texture {mapping.textureIndex} {mapping.slot}</div>
          </div>
        </div>
      )}
    </figure>
  );
}

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) {
        return;
      }
      const width = image.naturalWidth || image.width || 1;
      const height = image.naturalHeight || image.height || 1;
      canvas.width = width;
      canvas.height = height;
      setImageSize({ width, height });
      const context = canvas.getContext('2d');
      if (!context) {
        return;
      }
      context.clearRect(0, 0, width, height);
      context.imageSmoothingEnabled = false;
      context.drawImage(image, 0, 0, width, height);
      drawUvTriangles(context, triangles, width, height);
    };
    image.src = previewUrl;
    return () => {
      cancelled = true;
    };
  }, [previewUrl, setImageSize, triangles]);

  return (
    <div
      className={`uv-map-preview ${large ? 'large' : ''}`}
      style={imageSize ? { aspectRatio: `${imageSize.width} / ${imageSize.height}` } : undefined}
    >
      <canvas ref={canvasRef} aria-label={`Texture ${textureIndex} UV map`} />
    </div>
  );
}

function drawUvTriangles(context: CanvasRenderingContext2D, triangles: UvTriangle[], width: number, height: number) {
  context.save();
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.lineWidth = Math.max(1, Math.min(width, height) * 0.0045);
  context.strokeStyle = '#f7b267';
  context.fillStyle = 'rgba(247, 178, 103, 0.1)';
  for (const triangle of triangles) {
    const [first, second, third] = triangle.points;
    context.beginPath();
    context.moveTo(wrap01(first.u) * width, wrap01(first.v) * height);
    context.lineTo(wrap01(second.u) * width, wrap01(second.v) * height);
    context.lineTo(wrap01(third.u) * width, wrap01(third.v) * height);
    context.closePath();
    context.fill();
    context.stroke();
  }
  context.lineWidth = Math.max(1, Math.min(width, height) * 0.0015);
  context.strokeStyle = 'rgba(10, 12, 14, 0.8)';
  context.fillStyle = '#f7b267';
  const radius = Math.max(1.5, Math.min(width, height) * 0.0045);
  for (const triangle of triangles) {
    for (const point of triangle.points) {
      context.beginPath();
      context.arc(wrap01(point.u) * width, wrap01(point.v) * height, radius, 0, Math.PI * 2);
      context.fill();
      context.stroke();
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
