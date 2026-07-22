import { Box3, MathUtils, OrthographicCamera, PerspectiveCamera, Spherical, Vector3, type Object3D } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type ViewAxis = 'x' | 'y' | 'z' | '-x' | '-y' | '-z';

export class CameraController {
  readonly perspective = new PerspectiveCamera(50, 1, 0.01, 10000000);
  readonly orthographic = new OrthographicCamera(-1, 1, 1, -1, 0.01, 10000000);
  readonly controls: OrbitControls;
  active: PerspectiveCamera | OrthographicCamera;
  private aspect = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.perspective.position.set(16, 12, 20);
    this.orthographic.position.copy(this.perspective.position);
    this.active = this.perspective;
    this.controls = new OrbitControls(this.active, canvas);
    this.controls.enableDamping = true;
    this.controls.autoRotateSpeed = 1.2;
  }

  resize(width: number, height: number) {
    this.aspect = Math.max(width / Math.max(height, 1), 0.0001);
    this.perspective.aspect = this.aspect;
    this.perspective.updateProjectionMatrix();
    this.orthographic.left = -this.aspect;
    this.orthographic.right = this.aspect;
    this.orthographic.top = 1;
    this.orthographic.bottom = -1;
    this.orthographic.updateProjectionMatrix();
  }

  setMode(mode: 'perspective' | 'orthographic', focusObject?: Object3D | null) {
    const next = mode === 'perspective' ? this.perspective : this.orthographic;
    next.position.copy(this.active.position);
    next.quaternion.copy(this.active.quaternion);
    this.active = next;
    this.controls.object = this.active;
    if (focusObject) {
      this.focus(focusObject, false);
    }
    this.controls.update();
  }

  focus(object: Object3D, resetViewDirection = true) {
    const box = new Box3().setFromObject(object);
    if (box.isEmpty()) {
      return;
    }
    const center = new Vector3();
    const size = new Vector3();
    box.getCenter(center);
    box.getSize(size);
    const radius = Math.max(size.length() * 0.5, 1);
    this.controls.target.copy(center);
    const direction = resetViewDirection
      ? new Vector3(1.4, 1.1, 1.6).normalize()
      : this.active.position.clone().sub(this.controls.target).normalize();
    if (direction.lengthSq() === 0) {
      direction.set(1.4, 1.1, 1.6).normalize();
    }
    const fitDistance =
      this.active instanceof PerspectiveCamera
        ? (radius / Math.sin(MathUtils.degToRad(this.active.fov) * 0.5)) * 1.18
        : radius * 4.2;
    this.active.position.copy(center).add(direction.multiplyScalar(fitDistance));
    this.active.near = Math.max(radius / 1000, 0.001);
    this.active.far = Math.max(radius * 1000, 1000);
    if (this.active instanceof OrthographicCamera) {
      const fitHeight = Math.max(size.y, size.x / this.aspect, size.z / this.aspect, 1);
      this.active.zoom = 2 / (fitHeight * 1.08);
    }
    this.active.updateProjectionMatrix();
    this.controls.update();
  }

  viewAxis(axis: ViewAxis) {
    const direction = axisToVector(axis);
    const distance = Math.max(this.active.position.distanceTo(this.controls.target), 1);
    this.active.position.copy(this.controls.target).add(direction.multiplyScalar(distance));
    this.active.lookAt(this.controls.target);
    this.controls.update();
  }

  orbitBy(deltaX: number, deltaY: number) {
    const offset = this.active.position.clone().sub(this.controls.target);
    const spherical = new Spherical().setFromVector3(offset);
    spherical.theta -= deltaX * 0.01;
    spherical.phi -= deltaY * 0.01;
    spherical.phi = MathUtils.clamp(spherical.phi, 0.01, Math.PI - 0.01);
    offset.setFromSpherical(spherical);
    this.active.position.copy(this.controls.target).add(offset);
    this.active.lookAt(this.controls.target);
    this.controls.update();
  }

  setAutoOrbit(enabled: boolean) {
    this.controls.autoRotate = enabled;
  }

  update() {
    this.controls.update();
  }

  dispose() {
    this.controls.dispose();
  }
}

function axisToVector(axis: ViewAxis): Vector3 {
  switch (axis) {
    case 'x':
      return new Vector3(1, 0, 0);
    case '-x':
      return new Vector3(-1, 0, 0);
    case 'y':
      return new Vector3(0, 1, 0);
    case '-y':
      return new Vector3(0, -1, 0);
    case 'z':
      return new Vector3(0, 0, 1);
    case '-z':
      return new Vector3(0, 0, -1);
  }
}
