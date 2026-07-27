import { useEffect, useRef, useState } from 'react';
import { useAssetStore } from '../../state/assetStore';
import { useViewerStore } from '../../state/viewerStore';

interface BenchmarkResult {
  frames: number;
  durationMs: number;
  averageFps: number;
  lowOnePercentFps: number;
  averageFrameMs: number;
  minFrameMs: number;
  maxFrameMs: number;
}

const BENCHMARK_SAMPLE_FRAMES = 240;
const BENCHMARK_WARMUP_FRAMES = 30;

export function PerformancePanel() {
  const asset = useAssetStore((state) => state.asset);
  const fps = useViewerStore((state) => state.fps);
  const runtimeInfo = useViewerStore((state) => state.runtimeInfo);
  const perf = asset?.performance;
  const [benchmarkRunning, setBenchmarkRunning] = useState(false);
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkResult | null>(null);
  const benchmarkFrameRef = useRef(0);

  useEffect(() => () => cancelAnimationFrame(benchmarkFrameRef.current), []);

  const runBenchmark = () => {
    if (benchmarkRunning || !asset) {
      return;
    }
    setBenchmarkRunning(true);
    setBenchmarkResult(null);
    const frameTimes: number[] = [];
    let frame = 0;
    let previous = performance.now();
    let sampleStart = previous;
    const tick = (now: number) => {
      const delta = now - previous;
      previous = now;
      frame += 1;
      if (frame === BENCHMARK_WARMUP_FRAMES + 1) {
        sampleStart = now;
      }
      if (frame > BENCHMARK_WARMUP_FRAMES) {
        frameTimes.push(delta);
      }
      if (frameTimes.length >= BENCHMARK_SAMPLE_FRAMES) {
        setBenchmarkResult(summarizeBenchmark(frameTimes, now - sampleStart));
        setBenchmarkRunning(false);
        benchmarkFrameRef.current = 0;
        return;
      }
      benchmarkFrameRef.current = requestAnimationFrame(tick);
    };
    benchmarkFrameRef.current = requestAnimationFrame(tick);
  };

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
        <div className="section-title">Benchmark</div>
        <button className="benchmark-button" disabled={!asset || benchmarkRunning} onClick={runBenchmark}>
          {benchmarkRunning ? 'Running Benchmark...' : 'Run Frame Benchmark'}
        </button>
        {!asset && <div className="tree-kind">Load an asset to benchmark the active scene.</div>}
        {benchmarkResult && (
          <div className="benchmark-result">
            <KeyValue label="Frames" value={benchmarkResult.frames} />
            <KeyValue label="Duration" value={`${benchmarkResult.durationMs.toFixed(1)} ms`} />
            <KeyValue label="Average FPS" value={benchmarkResult.averageFps.toFixed(1)} />
            <KeyValue label="1% Low FPS" value={benchmarkResult.lowOnePercentFps.toFixed(1)} />
            <KeyValue label="Average Frame" value={`${benchmarkResult.averageFrameMs.toFixed(2)} ms`} />
            <KeyValue label="Frame Range" value={`${benchmarkResult.minFrameMs.toFixed(2)} - ${benchmarkResult.maxFrameMs.toFixed(2)} ms`} />
          </div>
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

function summarizeBenchmark(frameTimes: number[], durationMs: number): BenchmarkResult {
  const sorted = [...frameTimes].sort((a, b) => b - a);
  const lowFrameCount = Math.max(1, Math.ceil(sorted.length * 0.01));
  const lowFrameAverage = average(sorted.slice(0, lowFrameCount));
  const averageFrameMs = average(frameTimes);
  return {
    frames: frameTimes.length,
    durationMs,
    averageFps: (frameTimes.length * 1000) / durationMs,
    lowOnePercentFps: 1000 / lowFrameAverage,
    averageFrameMs,
    minFrameMs: Math.min(...frameTimes),
    maxFrameMs: Math.max(...frameTimes)
  };
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
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
