import {
  AxesHelper,
  Box3,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
  type Camera,
  type Scene
} from 'three';
import { geometryLocalBox, nodeOwnBox, nodeSubtreeBoxRelative, transformedLocalBoxCorners, worldAabb } from '../inspection/BoundingBoxInspector';

const BOX_EDGES = [
  0, 1, 1, 2, 2, 3, 3, 0,
  4, 5, 5, 6, 6, 7, 7, 4,
  0, 4, 1, 5, 2, 6, 3, 7
];
const DEFAULT_GRID_SIZE = 10000;
const AXIS_LENGTH = 1;
const AXIS_RADIUS = 0.012;
const FLOATING_ORIGIN_THRESHOLD = 100000;

export class HelperManager {
  private readonly root = new Object3D();
  private grid = new Mesh(new PlaneGeometry(1, 1), createInfiniteGridMaterial());
  private axes = createThickAxes(AXIS_LENGTH, AXIS_RADIUS);

  constructor(scene: Scene) {
    this.root.name = 'InspectorHelpers';
    this.grid.name = 'InfiniteGrid';
    this.grid.frustumCulled = false;
    this.grid.onBeforeRender = (_renderer, _scene, camera) => updateGridCameraUniforms(this.grid.material, camera, this.root);
    this.grid.renderOrder = -100;
    this.axes.name = 'WorldAxes';
    this.axes.renderOrder = -90;
    scene.add(this.root);
    this.root.add(this.grid, this.axes);
  }

  setBaseVisibility(showGrid: boolean, showAxes: boolean) {
    this.grid.visible = showGrid;
    this.axes.visible = showAxes;
  }

  updateSelection(
    object: Object3D | null,
    highlightObjects: Object3D[],
    showGeometryLocalBox: boolean,
    showWorldAabb: boolean,
    anchorObject: Object3D | null = null
  ) {
    this.clearDynamic();
    const frame = this.updateFloatingFrame(object ?? highlightObjects[0] ?? anchorObject);
    if (!object) {
      return;
    }
    object.updateWorldMatrix(true, true);
    if (highlightObjects.length > 0) {
      const color = highlightObjects.length === 1 && highlightObjects[0] !== object ? 0xffd166 : 0x55d6ff;
      for (const highlightObject of highlightObjects) {
        this.root.add(createSelectionOverlay(highlightObject, color, frame.inverseMatrix));
      }
    } else {
      this.root.add(createSelectionOverlay(object, 0x55d6ff, frame.inverseMatrix));
    }
    const boxTargets = highlightObjects.length > 0 ? highlightObjects : [object];
    if (showWorldAabb) {
      const box = unionWorldAabb(boxTargets);
      if (!box.isEmpty()) {
        this.root.add(createBoxLines(box, 0x6aa0e8, frame.origin));
      }
    }
    if (showGeometryLocalBox) {
      for (const target of boxTargets) {
        const mesh = target as Object3D & { geometry?: BufferGeometry };
        const local = mesh.geometry ? geometryLocalBox(mesh.geometry) : null;
        if (local) {
          this.root.add(createLineFromCorners(transformedLocalBoxCorners(local, target.matrixWorld), 0xf7b267, frame.origin));
        }
      }
    }
    const own = nodeOwnBox(object);
    if (!own.isEmpty()) {
      this.root.add(createBoxLines(own, 0xd95f59, frame.origin));
    }
    const subtree = nodeSubtreeBoxRelative(object);
    if (!subtree.isEmpty()) {
      const worldCorners = transformedLocalBoxCorners(subtree, object.matrixWorld);
      this.root.add(createLineFromCorners(worldCorners, 0x8bd17c, frame.origin));
    }
    const nodeAxes = new AxesHelper(1);
    object.updateWorldMatrix(true, true);
    nodeAxes.matrix.multiplyMatrices(frame.inverseMatrix, object.matrixWorld);
    nodeAxes.matrixAutoUpdate = false;
    this.root.add(nodeAxes);
  }

  dispose() {
    this.clearDynamic();
    this.grid.geometry.dispose();
    disposeShaderMaterial(this.grid.material);
    disposeObject(this.axes);
    this.root.removeFromParent();
  }

  private clearDynamic() {
    const keep = new Set<Object3D>([this.grid, this.axes]);
    for (const child of [...this.root.children]) {
      if (keep.has(child)) {
        continue;
      }
      disposeObject(child);
      child.removeFromParent();
    }
  }

  private updateFloatingFrame(anchorObject: Object3D | null) {
    const origin = new Vector3();
    let gridOffsetY = -0.003;
    if (anchorObject) {
      const box = worldAabb(anchorObject);
      if (!box.isEmpty()) {
        const center = new Vector3();
        const size = new Vector3();
        box.getCenter(center);
        box.getSize(size);
        gridOffsetY = box.min.y - origin.y - gridDropForSize(size);
        if (needsFloatingOrigin(center)) {
          origin.copy(center);
          gridOffsetY = box.min.y - origin.y - gridDropForSize(size);
        }
      }
    }
    this.root.position.copy(origin);
    updateGridPlaneY(this.grid.material, gridOffsetY);
    this.root.updateWorldMatrix(true, false);
    return {
      origin,
      inverseMatrix: this.root.matrixWorld.clone().invert()
    };
  }
}

function createThickAxes(length: number, radius: number): Object3D {
  const axes = new Object3D();
  axes.add(createAxis(0xf25f5c, length, radius, 'x'));
  axes.add(createAxis(0x8bd17c, length, radius, 'y'));
  axes.add(createAxis(0x6aa0e8, length, radius, 'z'));
  return axes;
}

function createAxis(color: number, length: number, radius: number, axis: 'x' | 'y' | 'z'): Object3D {
  const group = new Object3D();
  const shaftLength = length * 0.86;
  const coneLength = length * 0.14;
  const material = new MeshBasicMaterial({
    color,
    depthTest: true,
    depthWrite: false,
    opacity: 0.42,
    transparent: true
  });
  const shaft = new Mesh(new CylinderGeometry(radius, radius, shaftLength, 12), material);
  const cone = new Mesh(new ConeGeometry(radius * 2.3, coneLength, 16), material.clone());
  shaft.renderOrder = -90;
  cone.renderOrder = -90;
  shaft.position.y = shaftLength * 0.5;
  cone.position.y = shaftLength + coneLength * 0.5;
  group.add(shaft, cone);
  if (axis === 'x') {
    group.rotation.z = -Math.PI / 2;
  } else if (axis === 'z') {
    group.rotation.x = Math.PI / 2;
  }
  return group;
}

function createInfiniteGridMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    name: 'InfiniteGridMaterial',
    transparent: true,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
    side: DoubleSide,
    uniforms: {
      minorSpacing: { value: 1 },
      majorSpacing: { value: 10 },
      minorWidth: { value: 0.0035 },
      majorWidth: { value: 0.009 },
      gridSize: { value: DEFAULT_GRID_SIZE },
      gridPlaneY: { value: -0.003 },
      relativeCameraPosition: { value: new Vector3() },
      viewRotationMatrix: { value: new Matrix4() }
    },
    vertexShader: `
      uniform float gridSize;
      uniform float gridPlaneY;
      uniform vec3 relativeCameraPosition;
      uniform mat4 viewRotationMatrix;
      varying vec2 vGridPosition;
      void main() {
        vec3 gridPosition = vec3(position.x * gridSize, gridPlaneY, position.y * gridSize);
        vGridPosition = gridPosition.xz;
        vec3 viewPosition = (viewRotationMatrix * vec4(gridPosition - relativeCameraPosition, 1.0)).xyz;
        gl_Position = projectionMatrix * vec4(viewPosition, 1.0);
      }
    `,
    fragmentShader: `
      uniform float minorSpacing;
      uniform float majorSpacing;
      uniform float minorWidth;
      uniform float majorWidth;
      varying vec2 vGridPosition;

      float gridLine(float coordinate, float spacing, float width) {
        float distanceToLine = abs(fract(coordinate / spacing - 0.5) - 0.5) * spacing;
        float derivative = fwidth(coordinate);
        return 1.0 - smoothstep(width, width + derivative * 1.5, distanceToLine);
      }

      void main() {
        float minor = max(gridLine(vGridPosition.x, minorSpacing, minorWidth), gridLine(vGridPosition.y, minorSpacing, minorWidth));
        float major = max(gridLine(vGridPosition.x, majorSpacing, majorWidth), gridLine(vGridPosition.y, majorSpacing, majorWidth));
        vec3 minorColor = vec3(0.30, 0.35, 0.39);
        vec3 majorColor = vec3(0.45, 0.51, 0.56);
        vec3 color = mix(minorColor, majorColor, major);
        float alpha = max(minor * 0.28, major * 0.55);
        if (alpha < 0.01) {
          discard;
        }
        gl_FragColor = vec4(color, alpha);
      }
    `
  });
}

function disposeShaderMaterial(material: ShaderMaterial | ShaderMaterial[]) {
  if (Array.isArray(material)) {
    material.forEach((entry) => entry.dispose());
  } else {
    material.dispose();
  }
}

function createBoxLines(box: Box3, color: number, origin: Vector3): LineSegments {
  const corners = [
    new Vector3(box.min.x, box.min.y, box.min.z),
    new Vector3(box.max.x, box.min.y, box.min.z),
    new Vector3(box.max.x, box.max.y, box.min.z),
    new Vector3(box.min.x, box.max.y, box.min.z),
    new Vector3(box.min.x, box.min.y, box.max.z),
    new Vector3(box.max.x, box.min.y, box.max.z),
    new Vector3(box.max.x, box.max.y, box.max.z),
    new Vector3(box.min.x, box.max.y, box.max.z)
  ];
  return createLineFromCorners(corners, color, origin);
}

function updateGridPlaneY(material: ShaderMaterial | ShaderMaterial[], gridPlaneY: number) {
  const target = Array.isArray(material) ? material[0] : material;
  if (target?.uniforms.gridPlaneY) {
    target.uniforms.gridPlaneY.value = gridPlaneY;
  }
}

function updateGridCameraUniforms(material: ShaderMaterial | ShaderMaterial[], camera: Camera, root: Object3D) {
  const target = Array.isArray(material) ? material[0] : material;
  if (!target) {
    return;
  }
  camera.updateMatrixWorld();
  root.updateWorldMatrix(true, false);
  const rootPosition = new Vector3().setFromMatrixPosition(root.matrixWorld);
  const cameraPosition = new Vector3().setFromMatrixPosition(camera.matrixWorld);
  const relativeCameraPosition = target.uniforms.relativeCameraPosition?.value as Vector3 | undefined;
  const viewRotationMatrix = target.uniforms.viewRotationMatrix?.value as Matrix4 | undefined;
  relativeCameraPosition?.copy(cameraPosition.sub(rootPosition));
  viewRotationMatrix?.copy(camera.matrixWorldInverse);
  viewRotationMatrix?.setPosition(0, 0, 0);
}

function unionWorldAabb(objects: Object3D[]): Box3 {
  const box = new Box3();
  for (const object of objects) {
    const targetBox = worldAabb(object);
    if (!targetBox.isEmpty()) {
      box.union(targetBox);
    }
  }
  return box;
}

function createLineFromCorners(corners: Vector3[], color: number, origin: Vector3): LineSegments {
  const points = BOX_EDGES.map((index) => (corners[index] ?? new Vector3()).clone().sub(origin));
  const geometry = new BufferGeometry().setFromPoints(points);
  const lines = new LineSegments(geometry, new LineBasicMaterial({ color, depthTest: false, depthWrite: false }));
  lines.renderOrder = 30;
  return lines;
}

function createSelectionOverlay(root: Object3D, color: number, inverseHelperMatrix: Matrix4): Object3D {
  const group = new Object3D();
  group.name = 'SelectionHighlight';
  root.updateWorldMatrix(true, true);
  root.traverse((object) => {
    const target = object as Object3D & { isMesh?: boolean; geometry?: BufferGeometry };
    if (!target.isMesh || !target.geometry) {
      return;
    }
    target.updateWorldMatrix(true, false);
    const material = new MeshBasicMaterial({
      color,
      depthWrite: false,
      opacity: 0.32,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      side: DoubleSide,
      transparent: true
    });
    const overlay = new Mesh(target.geometry, material);
    overlay.matrix.multiplyMatrices(inverseHelperMatrix, target.matrixWorld);
    overlay.matrixAutoUpdate = false;
    overlay.renderOrder = 10;
    overlay.userData.inspectorSharedGeometry = true;
    group.add(overlay);

    const outlineMaterial = new MeshBasicMaterial({
      color,
      depthWrite: false,
      opacity: 0.95,
      side: DoubleSide,
      transparent: true,
      wireframe: true
    });
    const outline = new Mesh(target.geometry, outlineMaterial);
    outline.matrix.multiplyMatrices(inverseHelperMatrix, target.matrixWorld);
    outline.matrixAutoUpdate = false;
    outline.renderOrder = 11;
    outline.userData.inspectorSharedGeometry = true;
    group.add(outline);
  });
  return group;
}

function needsFloatingOrigin(center: Vector3): boolean {
  return Math.max(Math.abs(center.x), Math.abs(center.y), Math.abs(center.z)) >= FLOATING_ORIGIN_THRESHOLD;
}

function gridDropForSize(size: Vector3): number {
  return Math.min(Math.max(size.length() * 0.0005, 0.02), 5);
}

function disposeObject(object: Object3D) {
  object.traverse((child) => {
    const target = child as Object3D & { geometry?: BufferGeometry; material?: { dispose?: () => void } | Array<{ dispose?: () => void }> };
    if (!child.userData.inspectorSharedGeometry) {
      target.geometry?.dispose();
    }
    if (Array.isArray(target.material)) {
      target.material.forEach((material) => material.dispose?.());
    } else {
      target.material?.dispose?.();
    }
  });
}
