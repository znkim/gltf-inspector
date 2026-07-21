import { MeshBasicMaterial, NearestFilter, RepeatWrapping, SRGBColorSpace, TextureLoader } from 'three';
import uvCheckerUrl from '../images/uv-checker.png';

const uvCheckerTexture = new TextureLoader().load(uvCheckerUrl);
uvCheckerTexture.wrapS = RepeatWrapping;
uvCheckerTexture.wrapT = RepeatWrapping;
uvCheckerTexture.magFilter = NearestFilter;
uvCheckerTexture.minFilter = NearestFilter;
uvCheckerTexture.colorSpace = SRGBColorSpace;
uvCheckerTexture.flipY = false;

export function createUvCheckerMaterial(): MeshBasicMaterial {
  return new MeshBasicMaterial({
    name: 'UvCheckerDebugMaterial',
    map: uvCheckerTexture
  });
}
