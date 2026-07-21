import type { Object3D } from 'three';
import { inspectAnimations, inspectMorphTargets, inspectSkins } from '../../inspection/AnimationSkinMorphInspector';
import type { LoadedAsset } from '../../types/gltf';

export function AnimationSkinMorphSection({ asset, selectedObject }: { asset: LoadedAsset; selectedObject: Object3D | null }) {
  const animations = inspectAnimations(asset.source);
  const skins = inspectSkins(asset.source);
  const morphs = inspectMorphTargets(asset.source, selectedObject);
  return (
    <section className="section">
      <h3 className="section-title">Animation / Skin / Morph</h3>
      <KeyValue label="Runtime Clips" value={asset.runtime.animations.length} />
      <KeyValue label="Source Animations" value={animations.length} />
      {animations.map((animation) => (
        <div key={animation.index} className="section">
          <KeyValue label="Animation" value={`${animation.index} ${animation.name}`} />
          <KeyValue label="Channels" value={animation.channelCount} />
          <KeyValue label="Samplers" value={animation.samplerCount} />
          <KeyValue label="Targets" value={animation.targets.join(', ') || '-'} />
        </div>
      ))}
      <KeyValue label="Skins" value={skins.length} />
      {skins.map((skin) => (
        <div key={skin.index} className="section">
          <KeyValue label="Skin" value={`${skin.index} ${skin.name}`} />
          <KeyValue label="Joints" value={skin.jointCount} />
          <KeyValue label="Skeleton" value={skin.skeleton ?? '-'} />
          <KeyValue label="Inverse Bind" value={skin.inverseBindMatrices ?? '-'} />
        </div>
      ))}
      <KeyValue label="Morph Primitives" value={morphs.length} />
      {morphs.map((morph) => (
        <div key={`${morph.meshIndex}-${morph.primitiveIndex}`} className="section">
          <KeyValue label="Primitive" value={`Mesh ${morph.meshIndex} Prim ${morph.primitiveIndex}`} />
          <KeyValue label="Targets" value={morph.targetCount} />
          <KeyValue label="Attributes" value={morph.targetAttributes.join(', ') || '-'} />
          <KeyValue label="Selected Influences" value={morph.runtimeInfluences.length ? morph.runtimeInfluences.map((value) => value.toPrecision(4)).join(', ') : '-'} />
        </div>
      ))}
    </section>
  );
}

function KeyValue({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="kv"><span>{label}</span><span className="mono">{value}</span></div>;
}
