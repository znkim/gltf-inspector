import type { WebGLRenderer } from 'three';
import type { ViewerController } from '../../viewer/ViewerController';

let activeController: ViewerController | null = null;

export function setActiveController(controller: ViewerController | null) {
  activeController = controller;
}

export function getActiveRenderer(): WebGLRenderer | null {
  return activeController?.renderer ?? null;
}

export function getActiveController(): ViewerController | null {
  return activeController;
}
