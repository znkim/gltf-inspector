import type { CoordinateAnalysis } from '../../inspection/CoordinateAnalyzer';

export function CoordinateSection({ analysis, expandedNumbers = false }: { analysis: CoordinateAnalysis; expandedNumbers?: boolean }) {
  return (
    <section className="section">
      <h3 className="section-title">Coordinate Analysis</h3>
      <KeyValue label="Max Abs Vertex" value={formatNumber(analysis.maximumAbsoluteVertexCoordinate, expandedNumbers)} />
      <KeyValue label="Scene Center Distance" value={formatNumber(analysis.sceneCenterDistanceFromOrigin, expandedNumbers)} />
      <KeyValue label="Root Translation" value={formatNumber(analysis.rootTranslationMagnitude, expandedNumbers)} />
      <KeyValue label="Model Dimensions" value={format(analysis.modelDimensions, expandedNumbers)} />
      <KeyValue label="Float32 Spacing" value={formatNumber(analysis.estimatedFloat32Spacing, expandedNumbers)} />
      <KeyValue label="Recenter Recommended" value={String(analysis.recenterRecommended)} />
    </section>
  );
}

function KeyValue({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="kv"><span>{label}</span><span className="mono">{value}</span></div>;
}

function format(value: number[], expandedNumbers: boolean): string {
  return `[${value.map((entry) => formatNumber(entry, expandedNumbers)).join(', ')}]`;
}

function formatNumber(value: number, expandedNumbers: boolean): string {
  if (!expandedNumbers) {
    return value.toPrecision(8);
  }
  const abs = Math.abs(value);
  if (abs === 0) {
    return '0';
  }
  const digits = abs >= 1 ? 8 : Math.min(16, Math.max(8, Math.ceil(-Math.log10(abs)) + 6));
  return value.toFixed(digits).replace(/\.?0+$/, '');
}
