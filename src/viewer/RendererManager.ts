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
  SpotLight,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer
} from 'three';
import type { Camera, Texture } from 'three';
import type { EnvironmentMode, LightingMode } from '../types/gltf';

export class RendererManager {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly displayRoot = new Object3D();
  private readonly ambientLight = new AmbientLight(0xffffff, 0);
  private readonly hemisphereLight = new HemisphereLight(0xffffff, 0x303844, 1.8);
  private readonly directionalLight = new DirectionalLight(0xffffff, 2.4);
  private readonly fillLight = new DirectionalLight(0xd8ecff, 0);
  private readonly rimLight = new DirectionalLight(0xfff1d6, 0);
  private readonly cameraFlash = new SpotLight(0xffffff, 0, 0, Math.PI / 5.4, 0.48, 1);
  private readonly cameraFlashTarget = new Object3D();
  private readonly cameraDirection = new Vector3();
  private readonly pmremGenerator: PMREMGenerator;
  private backgroundColor = '#1e2125';
  private environmentMode: EnvironmentMode = 'none';
  private lightingMode: LightingMode = 'studio';
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
    this.fillLight.position.set(-5, 3, -4);
    this.rimLight.position.set(-4, 7, -7);
    this.cameraFlashTarget.name = 'CameraFlashTarget';
    this.cameraFlash.name = 'CameraFlash';
    this.cameraFlash.castShadow = false;
    this.cameraFlash.target = this.cameraFlashTarget;
    this.scene.add(
      this.ambientLight,
      this.hemisphereLight,
      this.directionalLight,
      this.fillLight,
      this.rimLight,
      this.cameraFlash,
      this.cameraFlashTarget
    );
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
    this.lightingMode = mode;
    this.ambientLight.intensity = 0;
    this.hemisphereLight.visible = true;
    this.directionalLight.visible = true;
    this.fillLight.visible = false;
    this.rimLight.visible = false;
    this.cameraFlash.visible = false;
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
    } else if (mode === 'camera-flash') {
      this.hemisphereLight.intensity = 0.75;
      this.directionalLight.intensity = 0.65;
      this.cameraFlash.visible = true;
      this.cameraFlash.intensity = 4.6;
      this.cameraFlash.angle = Math.PI / 5.2;
      this.cameraFlash.penumbra = 0.58;
    } else if (mode === 'spotlight') {
      this.ambientLight.intensity = 0.18;
      this.hemisphereLight.visible = false;
      this.directionalLight.visible = false;
      this.cameraFlash.visible = true;
      this.cameraFlash.intensity = 7.2;
      this.cameraFlash.angle = Math.PI / 7.8;
      this.cameraFlash.penumbra = 0.34;
    } else if (mode === 'three-point') {
      this.hemisphereLight.intensity = 0.6;
      this.directionalLight.intensity = 2.8;
      this.directionalLight.position.set(4, 5, 5);
      this.fillLight.visible = true;
      this.fillLight.intensity = 1.15;
      this.rimLight.visible = true;
      this.rimLight.intensity = 2.2;
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

  render(camera: Camera) {
    this.updateCameraLight(camera);
    this.renderer.render(this.scene, camera);
  }

  dispose() {
    this.backgroundTexture?.dispose();
    this.environmentTexture?.dispose();
    this.pmremGenerator.dispose();
    this.renderer.dispose();
  }

  private updateCameraLight(camera: Camera) {
    if (!this.cameraFlash.visible || (this.lightingMode !== 'camera-flash' && this.lightingMode !== 'spotlight')) {
      return;
    }
    camera.updateMatrixWorld();
    camera.getWorldPosition(this.cameraFlash.position);
    camera.getWorldDirection(this.cameraDirection);
    this.cameraFlashTarget.position.copy(this.cameraFlash.position).addScaledVector(this.cameraDirection, 10);
    this.cameraFlashTarget.updateMatrixWorld();
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
