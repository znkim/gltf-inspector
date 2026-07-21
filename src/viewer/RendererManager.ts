import { ACESFilmicToneMapping, Color, DirectionalLight, HemisphereLight, Object3D, Scene, WebGLRenderer } from 'three';

export class RendererManager {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly displayRoot = new Object3D();
  private readonly hemisphereLight = new HemisphereLight(0xffffff, 0x303844, 1.8);
  private readonly directionalLight = new DirectionalLight(0xffffff, 2.4);

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(new Color(0x0b0d0f));
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.directionalLight.position.set(5, 8, 6);
    this.scene.add(this.hemisphereLight, this.directionalLight);
    this.scene.add(this.displayRoot);
  }

  resize(width: number, height: number) {
    this.renderer.setSize(width, height, false);
  }

  dispose() {
    this.renderer.dispose();
  }
}
