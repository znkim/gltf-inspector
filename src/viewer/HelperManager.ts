import {
  AxesHelper,
  Box3,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
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
const AXIS_RADIUS = 0.035;

export class HelperManager {
  private readonly root = new Object3D();
  private grid = new Mesh(new PlaneGeometry(1, 1), createInfiniteGridMaterial());
  private axes = createThickAxes(AXIS_LENGTH, AXIS_RADIUS);

  constructor(scene: Scene) {
    this.root.name = 'InspectorHelpers';
    this.grid.name = 'InfiniteGrid';
    this.grid.rotation.x = -Math.PI / 2;
    this.grid.position.y = 0.002;
    this.grid.scale.set(DEFAULT_GRID_SIZE, DEFAULT_GRID_SIZE, 1);
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

  updateSelection(object: Object3D | null, highlightObjects: Object3D[], showGeometryLocalBox: boolean, showWorldAabb: boolean) {
    this.clearDynamic();
    if (!object) {
      return;
    }
    object.updateWorldMatrix(true, true);
    if (highlightObjects.length > 0) {
      const color = highlightObjects.length === 1 && highlightObjects[0] !== object ? 0xffd166 : 0x55d6ff;
      for (const highlightObject of highlightObjects) {
        this.root.add(createSelectionOverlay(highlightObject, color));
      }
    } else {
      this.root.add(createSelectionOverlay(object, 0x55d6ff));
    }
    const boxTargets = highlightObjects.length > 0 ? highlightObjects : [object];
    if (showWorldAabb) {
      const box = unionWorldAabb(boxTargets);
      if (!box.isEmpty()) {
        this.root.add(createBoxLines(box, 0x6aa0e8));
      }
    }
    if (showGeometryLocalBox) {
      for (const target of boxTargets) {
        const mesh = target as Object3D & { geometry?: BufferGeometry };
        const local = mesh.geometry ? geometryLocalBox(mesh.geometry) : null;
        if (local) {
          this.root.add(createLineFromCorners(transformedLocalBoxCorners(local, target.matrixWorld), 0xf7b267));
        }
      }
    }
    const own = nodeOwnBox(object);
    if (!own.isEmpty()) {
      this.root.add(createBoxLines(own, 0xd95f59));
    }
    const subtree = nodeSubtreeBoxRelative(object);
    if (!subtree.isEmpty()) {
      const worldCorners = transformedLocalBoxCorners(subtree, object.matrixWorld);
      this.root.add(createLineFromCorners(worldCorners, 0x8bd17c));
    }
    const nodeAxes = new AxesHelper(1);
    object.updateWorldMatrix(true, true);
    nodeAxes.matrix.copy(object.matrixWorld);
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
  const cone = new Mesh(new ConeGeometry(radius * 3.2, coneLength, 16), material.clone());
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
      majorWidth: { value: 0.009 }
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform float minorSpacing;
      uniform float majorSpacing;
      uniform float minorWidth;
      uniform float majorWidth;
      varying vec3 vWorldPosition;

      float gridLine(float coordinate, float spacing, float width) {
        float distanceToLine = abs(fract(coordinate / spacing - 0.5) - 0.5) * spacing;
        float derivative = fwidth(coordinate);
        return 1.0 - smoothstep(width, width + derivative * 1.5, distanceToLine);
      }

      void main() {
        float minor = max(gridLine(vWorldPosition.x, minorSpacing, minorWidth), gridLine(vWorldPosition.z, minorSpacing, minorWidth));
        float major = max(gridLine(vWorldPosition.x, majorSpacing, majorWidth), gridLine(vWorldPosition.z, majorSpacing, majorWidth));
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

function createBoxLines(box: Box3, color: number): LineSegments {
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
  return createLineFromCorners(corners, color);
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

function createLineFromCorners(corners: Vector3[], color: number): LineSegments {
  const points = BOX_EDGES.map((index) => corners[index] ?? new Vector3());
  const geometry = new BufferGeometry().setFromPoints(points);
  const lines = new LineSegments(geometry, new LineBasicMaterial({ color, depthTest: false, depthWrite: false }));
  lines.renderOrder = 30;
  return lines;
}

function createSelectionOverlay(root: Object3D, color: number): Object3D {
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
    overlay.matrix.copy(target.matrixWorld);
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
    outline.matrix.copy(target.matrixWorld);
    outline.matrixAutoUpdate = false;
    outline.renderOrder = 11;
    outline.userData.inspectorSharedGeometry = true;
    group.add(outline);
  });
  return group;
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
