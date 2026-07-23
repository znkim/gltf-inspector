import { AssetBundle } from './AssetBundle';

export interface SampleAsset {
  id: string;
  name: string;
  fileName: string;
  thumbnailFileName: string;
  description: string;
  license: string;
  credit: string;
}

export const SAMPLE_ASSETS: SampleAsset[] = [
  {
    id: 'duck',
    name: 'Duck',
    fileName: 'Duck.glb',
    thumbnailFileName: 'duck.png',
    description: 'Small textured model for basic GLB parsing and rendering checks.',
    license: 'SCEA Shared Source License 1.0',
    credit: 'Copyright 2006 Sony Computer Entertainment Inc.'
  },
  {
    id: 'damaged-helmet',
    name: 'Damaged Helmet',
    fileName: 'DamagedHelmet.glb',
    thumbnailFileName: 'helmet.png',
    description: 'PBR showcase model with normal, occlusion, and emissive textures.',
    license: 'CC BY-NC (non-commercial only)',
    credit: 'Battle Damaged Sci-fi Helmet by theblueturtle_'
  },
  {
    id: 'fox',
    name: 'Fox',
    fileName: 'Fox.glb',
    thumbnailFileName: 'fox.png',
    description: 'Animated rigged character with survey, walk, and run clips.',
    license: 'CC0 / CC BY 4.0',
    credit: 'Low poly fox by PixelMannen; rigging and animation by tomkranis'
  }
];

export async function bundleFromSampleAsset(sample: SampleAsset): Promise<AssetBundle> {
  const response = await fetch(`${import.meta.env.BASE_URL}samples/${sample.fileName}`);
  if (!response.ok) {
    throw new Error(`Sample asset could not be loaded: ${sample.name}`);
  }
  const blob = await response.blob();
  const file = new File([blob], sample.fileName, { type: 'model/gltf-binary' });
  return AssetBundle.fromFileList([file]);
}
