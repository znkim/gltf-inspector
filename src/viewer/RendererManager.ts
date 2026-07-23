import {
  ACESFilmicToneMapping,
  AmbientLight,
  Color,
  CubeTexture,
  DirectionalLight,
  HemisphereLight,
  LinearFilter,
  Object3D,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Texture,
  Vector3,
  WebGLRenderer
} from 'three';
import type { EnvironmentMode, LightingMode } from '../types/gltf';

export class RendererManager {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly displayRoot = new Object3D();
  private readonly ambientLight = new AmbientLight(0xffffff, 0);
  private readonly hemisphereLight = new HemisphereLight(0xffffff, 0x303844, 1.8);
  private readonly directionalLight = new DirectionalLight(0xffffff, 2.4);
  private readonly pmremGenerator: PMREMGenerator;
  private backgroundColor = '#1e2125';
  private environmentMode: EnvironmentMode = 'none';
  private backgroundTexture: CubeTexture | null = null;
  private environmentTexture: Texture | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(new Color(0x1e2125));
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.pmremGenerator = new PMREMGenerator(this.renderer);
    this.pmremGenerator.compileCubemapShader();
    this.directionalLight.position.set(5, 8, 6);
    this.scene.add(this.ambientLight, this.hemisphereLight, this.directionalLight);
    this.scene.add(this.displayRoot);
    this.setEnvironmentMode('studio');
  }

  setBackgroundColor(color: string) {
    this.backgroundColor = color;
    if (this.environmentMode === 'none') {
      this.renderer.setClearColor(new Color(color));
    }
  }

  setLightingMode(mode: LightingMode) {
    this.ambientLight.intensity = 0;
    this.hemisphereLight.visible = true;
    this.directionalLight.visible = true;
    this.directionalLight.position.set(5, 8, 6);
    if (mode === 'studio') {
      this.hemisphereLight.intensity = 1.8;
      this.directionalLight.intensity = 2.4;
    } else if (mode === 'neutral') {
      this.hemisphereLight.intensity = 1.1;
      this.directionalLight.intensity = 1.2;
    } else if (mode === 'bright') {
      this.hemisphereLight.intensity = 2.4;
      this.directionalLight.intensity = 3.4;
    } else if (mode === 'flat') {
      this.ambientLight.intensity = 1.8;
      this.hemisphereLight.visible = false;
      this.directionalLight.visible = false;
    } else {
      this.hemisphereLight.visible = false;
      this.directionalLight.visible = false;
    }
  }

  setEnvironmentMode(mode: EnvironmentMode) {
    if (mode === this.environmentMode && mode !== 'none') {
      return;
    }
    this.environmentMode = mode;
    this.backgroundTexture?.dispose();
    this.environmentTexture?.dispose();
    this.backgroundTexture = null;
    this.environmentTexture = null;
    this.scene.environment = null;
    if (mode === 'none') {
      this.scene.background = null;
      this.renderer.setClearColor(new Color(this.backgroundColor));
      return;
    }
    this.backgroundTexture = createEnvironmentTexture(mode);
    this.environmentTexture = this.pmremGenerator.fromCubemap(this.backgroundTexture).texture;
    this.scene.background = this.backgroundTexture;
    this.scene.environment = this.environmentTexture;
  }

  resize(width: number, height: number) {
    this.renderer.setSize(width, height, false);
  }

  dispose() {
    this.backgroundTexture?.dispose();
    this.environmentTexture?.dispose();
    this.pmremGenerator.dispose();
    this.renderer.dispose();
  }
}

function createEnvironmentTexture(mode: Exclude<EnvironmentMode, 'none'>): CubeTexture {
  const palette = ENVIRONMENT_PALETTES[mode];
  const images = [
    createEnvironmentFace(palette, 'px'),
    createEnvironmentFace(palette, 'nx'),
    createEnvironmentFace(palette, 'py'),
    createEnvironmentFace(palette, 'ny'),
    createEnvironmentFace(palette, 'pz'),
    createEnvironmentFace(palette, 'nz')
  ];
  const texture = new CubeTexture(images);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

type CubeFace = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz';

type EnvironmentPalette = Record<'top' | 'horizon' | 'bottom' | 'accent', string>;

function createEnvironmentFace(palette: EnvironmentPalette, face: CubeFace): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) {
    return canvas;
  }
  const image = context.createImageData(canvas.width, canvas.height);
  const top = new Color(palette.top);
  const horizon = new Color(palette.horizon);
  const bottom = new Color(palette.bottom);
  const accent = new Color(palette.accent);
  const sunDirection = new Vector3(0.45, 0.72, 0.54).normalize();
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const u = (2 * (x + 0.5)) / canvas.width - 1;
      const v = (2 * (y + 0.5)) / canvas.height - 1;
      const direction = cubeFaceDirection(face, u, v);
      const vertical = direction.y;
      const color = vertical >= 0
        ? horizon.clone().lerp(top, Math.pow(vertical, 0.72))
        : horizon.clone().lerp(bottom, Math.pow(-vertical, 0.58));
      const sun = Math.pow(Math.max(direction.dot(sunDirection), 0), 80);
      color.lerp(accent, Math.min(sun * 1.8, 0.86));
      const index = (y * canvas.width + x) * 4;
      image.data[index] = Math.round(color.r * 255);
      image.data[index + 1] = Math.round(color.g * 255);
      image.data[index + 2] = Math.round(color.b * 255);
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

function cubeFaceDirection(face: CubeFace, u: number, v: number): Vector3 {
  const direction =
    face === 'px' ? new Vector3(1, -v, -u)
    : face === 'nx' ? new Vector3(-1, -v, u)
    : face === 'py' ? new Vector3(u, 1, v)
    : face === 'ny' ? new Vector3(u, -1, -v)
    : face === 'pz' ? new Vector3(u, -v, 1)
    : new Vector3(-u, -v, -1);
  return direction.normalize();
}

const ENVIRONMENT_PALETTES = {
  studio: {
    top: '#6b7680',
    horizon: '#3c4650',
    bottom: '#20262d',
    accent: '#ffffff'
  },
  day: {
    top: '#74a8dc',
    horizon: '#d7e8f7',
    bottom: '#6d8796',
    accent: '#fff7d1'
  },
  sunset: {
    top: '#2d3350',
    horizon: '#f0a35e',
    bottom: '#2b1f24',
    accent: '#ffd08a'
  },
  night: {
    top: '#0b1021',
    horizon: '#24324b',
    bottom: '#05070c',
    accent: '#b8d7ff'
  }
} satisfies Record<Exclude<EnvironmentMode, 'none'>, EnvironmentPalette>;
