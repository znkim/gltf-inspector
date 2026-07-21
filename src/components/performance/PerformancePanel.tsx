import { useAssetStore } from '../../state/assetStore';
import { useViewerStore } from '../../state/viewerStore';

export function PerformancePanel() {
  const asset = useAssetStore((state) => state.asset);
  const fps = useViewerStore((state) => state.fps);
  const runtimeInfo = useViewerStore((state) => state.runtimeInfo);
  const perf = asset?.performance;
  return (
    <div className="panel">
      <div className="panel-header">Performance</div>
      <div className="panel-body">
        <KeyValue label="FPS" value={fps > 0 ? fps.toFixed(1) : '-'} />
        {!perf && <div>No metrics yet.</div>}
        {perf && (
          <>
            <KeyValue label="File Size" value={bytes(perf.fileSize)} />
            <KeyValue label="Total Resource Size" value={bytes(perf.totalResourceSize)} />
            <KeyValue label="Parse Time" value={`${perf.parseTimeMs.toFixed(1)} ms`} />
            <KeyValue label="Total Load Time" value={`${perf.totalLoadTimeMs.toFixed(1)} ms`} />
            <KeyValue label="Scene Objects" value={perf.sceneObjectCount} />
            <KeyValue label="Meshes" value={perf.meshCount} />
            <KeyValue label="Primitives" value={perf.primitiveCount} />
            <KeyValue label="Triangles" value={perf.triangleCount} />
            <KeyValue label="Vertices" value={perf.vertexCount} />
            <KeyValue label="Draw Calls" value={`${perf.drawCalls} estimated`} />
            <KeyValue label="Materials" value={perf.materialCount} />
            <KeyValue label="Textures" value={perf.textureCount} />
            <KeyValue label="Geometry Memory" value={`${bytes(perf.estimatedGeometryMemory)} estimated`} />
          </>
        )}
        {runtimeInfo && (
          <>
            <div className="section-title">Runtime</div>
            <KeyValue label="WebGL" value={runtimeInfo.webglVersion} />
            <KeyValue label="GLSL" value={runtimeInfo.glslVersion} />
            <KeyValue label="GPU Vendor" value={runtimeInfo.vendor} />
            <KeyValue label="GPU Renderer" value={runtimeInfo.renderer} />
            <KeyValue label="Platform" value={runtimeInfo.platform} />
            <KeyValue label="CPU Threads" value={runtimeInfo.hardwareConcurrency} />
            <KeyValue label="Device Memory" value={runtimeInfo.deviceMemory} />
            <KeyValue label="Browser" value={runtimeInfo.userAgent} />
          </>
        )}
      </div>
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="kv"><span>{label}</span><span className="mono">{value}</span></div>;
}

function bytes(value: number): string {
  if (value > 1024 * 1024) {
    return `${(value / 1024 / 1024).toFixed(2)} MiB`;
  }
  if (value > 1024) {
    return `${(value / 1024).toFixed(1)} KiB`;
  }
  return `${value} B`;
}
