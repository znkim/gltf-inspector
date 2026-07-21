import { useEffect, useState } from 'react';
import type { LoadedAsset, GltfJsonObject, GltfJsonValue } from '../../types/gltf';
import { classifyExtension } from '../../inspection/ExtensionInspector';
import { resolveTexturePreview } from '../../inspection/TexturePreviewResolver';
import { useSelectionStore } from '../../state/selectionStore';

export function ExtensionSection({ asset }: { asset: LoadedAsset }) {
  const required = new Set(asset.source.extensionsRequired);
  return (
    <section className="section">
      <h3 className="section-title">Extensions</h3>
      {asset.source.extensionsUsed.length === 0 && <div className="tree-kind">No extensionsUsed.</div>}
      {asset.source.extensionsUsed.map((extension) => (
        <KeyValue key={extension} label={extension} value={`${classifyExtension(extension)}${required.has(extension) ? ' required' : ''}`} />
      ))}
    </section>
  );
}

export function MaterialSection({ asset }: { asset: LoadedAsset }) {
  const usage = buildMaterialUsage(asset);
  const highlightedMaterials = useHighlightedMaterials(asset);
  return (
    <section className="section">
      <h3 className="section-title">Materials</h3>
      {asset.source.materials.length === 0 && <div className="tree-kind">No materials.</div>}
      {asset.source.materials.map((material, index) => {
        const pbr = objectValue(material.pbrMetallicRoughness);
        const textureSlots = collectMaterialTextureSlots(material);
        const firstTexture = textureSlots[0]?.index;
        return (
          <details key={index} className={`resource-card ${highlightedMaterials.has(index) ? 'selected' : ''}`}>
            <summary className="resource-card-summary">
              {firstTexture !== undefined ? (
                <TexturePreviewImage asset={asset} textureIndex={firstTexture} compact />
              ) : (
                <div className="texture-thumb texture-thumb-small texture-thumb-empty">No texture</div>
              )}
              <div className="resource-card-title">
                <span className="mono">Material {index}</span>
                <strong>{material.name ?? `Material ${index}`}</strong>
                <span className="tree-kind">{textureSlots.length > 0 ? textureSlots.map((slot) => `${slot.label}: ${slot.index}`).join(', ') : 'No matched textures'}</span>
              </div>
            </summary>
            <div className="resource-card-body">
              <KeyValue label="Used By" value={(usage.get(index) ?? []).join(', ') || '-'} />
              <KeyValue label="Matched Textures" value={textureSlots.length > 0 ? textureSlots.map((slot) => `${slot.label} -> Texture ${slot.index}`).join(', ') : '-'} />
              <KeyValue label="baseColorFactor" value={formatValue(pbr?.baseColorFactor)} />
              <KeyValue label="metallicFactor" value={formatValue(pbr?.metallicFactor)} />
              <KeyValue label="roughnessFactor" value={formatValue(pbr?.roughnessFactor)} />
              <KeyValue label="emissiveFactor" value={formatValue(material.emissiveFactor)} />
              <KeyValue label="alphaMode" value={formatValue(material.alphaMode)} />
              <KeyValue label="alphaCutoff" value={formatValue(material.alphaCutoff)} />
              <KeyValue label="doubleSided" value={formatValue(material.doubleSided)} />
              <KeyValue label="normalScale" value={formatValue(objectValue(material.normalTexture)?.scale)} />
              <KeyValue label="occlusionStrength" value={formatValue(objectValue(material.occlusionTexture)?.strength)} />
              <KeyValue label="Extensions" value={Object.keys(objectValue(material.extensions) ?? {}).join(', ') || '-'} />
            </div>
          </details>
        );
      })}
    </section>
  );
}

export function TextureSection({ asset }: { asset: LoadedAsset }) {
  const usage = buildTextureUsage(asset);
  const highlightedTextures = useHighlightedTextures(asset);
  return (
    <section className="section">
      <h3 className="section-title">Textures</h3>
      {asset.source.textures.length === 0 && <div className="tree-kind">No textures.</div>}
      {asset.source.textures.map((texture, index) => {
        const textureObject = objectValue(texture);
        const imageIndex = getTextureImageIndex(textureObject);
        const basisuImageIndex = getBasisuImageIndex(textureObject);
        const samplerIndex = numberValue(textureObject?.sampler);
        const image = imageIndex !== null ? objectValue(asset.source.images[imageIndex]) : null;
        const uri = stringValue(image?.uri);
        const sampler = samplerIndex !== null ? objectValue(asset.source.samplers[samplerIndex]) : null;
        const title = stringValue(textureObject?.name) ?? stringValue(image?.name) ?? uri?.split(/[\\/]/).pop() ?? `Texture ${index}`;
        const isKtx2 = basisuImageIndex !== null || stringValue(image?.mimeType) === 'image/ktx2' || uri?.toLowerCase().split(/[?#]/)[0]?.endsWith('.ktx2') === true;
        return (
          <details key={index} className={`resource-card ${highlightedTextures.has(index) ? 'selected' : ''}`}>
            <summary className="resource-card-summary">
              <TexturePreviewImage asset={asset} textureIndex={index} compact />
              <div className="resource-card-title">
                <span className="mono">Texture {index}</span>
                <strong>{title}</strong>
                <span className="tree-kind">{usage.get(index)?.join(', ') || 'Unused'}</span>
              </div>
            </summary>
            <div className="resource-card-body">
              <KeyValue label="Image" value={imageIndex ?? '-'} />
              <KeyValue label="BasisU Image" value={basisuImageIndex ?? '-'} />
              <KeyValue label="Sampler" value={samplerIndex ?? '-'} />
              <KeyValue label="URI" value={uri ?? (image ? 'embedded' : '-')} />
              <KeyValue label="MIME" value={formatValue(image?.mimeType)} />
              <KeyValue label="minFilter" value={formatValue(sampler?.minFilter)} />
              <KeyValue label="magFilter" value={formatValue(sampler?.magFilter)} />
              <KeyValue label="wrapS" value={formatValue(sampler?.wrapS)} />
              <KeyValue label="wrapT" value={formatValue(sampler?.wrapT)} />
              <KeyValue label="KTX2" value={String(isKtx2)} />
              <KeyValue label="Used By" value={(usage.get(index) ?? []).join(', ') || '-'} />
            </div>
          </details>
        );
      })}
    </section>
  );
}

function useHighlightedMaterials(asset: LoadedAsset): Set<number> {
  const selectedMesh = useSelectionStore((state) => state.selectedMesh);
  const selectedPrimitive = useSelectionStore((state) => state.selectedPrimitive);
  const highlighted = new Set<number>();
  if (selectedPrimitive) {
    const material = asset.source.meshes[selectedPrimitive.meshIndex]?.primitives?.[selectedPrimitive.primitiveIndex]?.material;
    if (material !== undefined) {
      highlighted.add(material);
    }
    return highlighted;
  }
  if (selectedMesh) {
    for (const primitive of asset.source.meshes[selectedMesh.meshIndex]?.primitives ?? []) {
      if (primitive.material !== undefined) {
        highlighted.add(primitive.material);
      }
    }
  }
  return highlighted;
}

function useHighlightedTextures(asset: LoadedAsset): Set<number> {
  const highlighted = new Set<number>();
  for (const materialIndex of useHighlightedMaterials(asset)) {
    collectTextureIndices(asset.source.materials[materialIndex], highlighted);
  }
  return highlighted;
}

function TexturePreviewImage({ asset, textureIndex, compact = false }: { asset: LoadedAsset; textureIndex: number; compact?: boolean }) {
  const [preview, setPreview] = useState<{ url: string | null; label: string }>({ url: null, label: 'loading' });
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let revokeUrl: string | null = null;
    setPreview({ url: null, label: 'loading' });
    setSize(null);
    setExpanded(false);
    void resolveTexturePreview(asset, textureIndex).then((result) => {
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
  }, [asset, textureIndex]);

  if (!preview.url) {
    return <div className={`texture-thumb ${compact ? 'texture-thumb-small' : ''} texture-thumb-empty`}>{preview.label}</div>;
  }

  return (
    <>
      <figure className={`texture-preview ${compact ? 'compact' : ''}`}>
        <button
          className="texture-preview-button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setExpanded(true);
          }}
        >
          <img
            className={`texture-thumb ${compact ? 'texture-thumb-small' : ''}`}
            src={preview.url}
            alt={`Texture ${textureIndex}`}
            onLoad={(event) => setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
          />
        </button>
        {!compact && <figcaption className="tree-kind">{preview.label}{size ? ` ${size.width}x${size.height}` : ''}</figcaption>}
      </figure>
      {expanded && (
        <div className="texture-modal" onClick={() => setExpanded(false)}>
          <div className="texture-modal-body">
            <img src={preview.url} alt={`Texture ${textureIndex} enlarged`} />
            <div className="texture-modal-caption">Texture {textureIndex}{size ? ` ${size.width}x${size.height}` : ''}</div>
          </div>
        </div>
      )}
    </>
  );
}

function buildMaterialUsage(asset: LoadedAsset): Map<number, string[]> {
  const usage = new Map<number, string[]>();
  for (const { meshIndex, primitiveIndex, primitive } of asset.source.primitives) {
    if (primitive.material === undefined) {
      continue;
    }
    const entries = usage.get(primitive.material) ?? [];
    entries.push(`Mesh ${meshIndex} Prim ${primitiveIndex}`);
    usage.set(primitive.material, entries);
  }
  return usage;
}

function buildTextureUsage(asset: LoadedAsset): Map<number, string[]> {
  const usage = new Map<number, string[]>();
  asset.source.materials.forEach((material, materialIndex) => {
    collectTextureSlots(material, `Material ${materialIndex}`, usage);
  });
  return usage;
}

function collectTextureSlots(value: GltfJsonValue | undefined, prefix: string, usage: Map<number, string[]>) {
  const object = objectValue(value);
  if (!object) {
    return;
  }
  const textureIndex = numberValue(object.index);
  if (textureIndex !== null) {
    const entries = usage.get(textureIndex) ?? [];
    entries.push(prefix);
    usage.set(textureIndex, entries);
  }
  for (const [key, child] of Object.entries(object)) {
    if (key === 'index') {
      continue;
    }
    collectTextureSlots(child, `${prefix}.${key}`, usage);
  }
}

function collectMaterialTextureSlots(material: GltfJsonValue | undefined): Array<{ label: string; index: number }> {
  const slots: Array<{ label: string; index: number }> = [];
  collectNamedTextureSlots(material, '', slots);
  return slots;
}

function collectNamedTextureSlots(value: GltfJsonValue | undefined, prefix: string, slots: Array<{ label: string; index: number }>) {
  const object = objectValue(value);
  if (!object) {
    return;
  }
  const textureIndex = numberValue(object.index);
  if (textureIndex !== null) {
    slots.push({ label: formatTextureSlotLabel(prefix), index: textureIndex });
  }
  for (const [key, child] of Object.entries(object)) {
    if (key === 'index') {
      continue;
    }
    collectNamedTextureSlots(child, prefix ? `${prefix}.${key}` : key, slots);
  }
}

function formatTextureSlotLabel(path: string): string {
  return path.replace(/\.extensions\./g, '.').replace(/Texture$/i, '') || 'texture';
}

function getTextureImageIndex(texture: GltfJsonObject | null): number | null {
  return getBasisuImageIndex(texture) ?? numberValue(texture?.source);
}

function getBasisuImageIndex(texture: GltfJsonObject | null): number | null {
  return numberValue(objectValue(objectValue(texture?.extensions)?.KHR_texture_basisu)?.source);
}

function collectTextureIndices(value: GltfJsonValue | undefined, indices: Set<number>) {
  const object = objectValue(value);
  if (!object) {
    return;
  }
  const textureIndex = numberValue(object.index);
  if (textureIndex !== null) {
    indices.add(textureIndex);
  }
  for (const [key, child] of Object.entries(object)) {
    if (key === 'index') {
      continue;
    }
    collectTextureIndices(child, indices);
  }
}

function objectValue(value: GltfJsonValue | undefined): GltfJsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function numberValue(value: GltfJsonValue | undefined): number | null {
  return typeof value === 'number' ? value : null;
}

function stringValue(value: GltfJsonValue | undefined): string | null {
  return typeof value === 'string' ? value : null;
}

function formatValue(value: GltfJsonValue | undefined): string {
  if (value === undefined) {
    return '-';
  }
  if (Array.isArray(value)) {
    return `[${value.join(', ')}]`;
  }
  return String(value);
}

function KeyValue({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="kv"><span>{label}</span><span className="mono">{value}</span></div>;
}
