import { BackSide, BoxGeometry, DoubleSide, FrontSide, Mesh, MeshBasicMaterial } from 'three';
import { expect, it } from 'vitest';
import { RenderStateOverrideManager } from '../viewer/RenderStateOverrideManager';

it('overrides and restores material render state', () => {
  const material = new MeshBasicMaterial({
    color: 0xffffff,
    side: BackSide,
    depthTest: true,
    depthWrite: false
  });
  const mesh = new Mesh(new BoxGeometry(), material);
  const manager = new RenderStateOverrideManager();

  manager.apply(mesh, {
    doubleSided: 'enabled',
    depthTest: 'disabled',
    depthWrite: 'enabled'
  });

  expect(material.side).toBe(DoubleSide);
  expect(material.depthTest).toBe(false);
  expect(material.depthWrite).toBe(true);

  manager.restore();

  expect(material.side).toBe(BackSide);
  expect(material.depthTest).toBe(true);
  expect(material.depthWrite).toBe(false);
});

it('can force front side while preserving other default render states', () => {
  const material = new MeshBasicMaterial({
    color: 0xffffff,
    side: DoubleSide,
    depthTest: false,
    depthWrite: false
  });
  const mesh = new Mesh(new BoxGeometry(), material);
  const manager = new RenderStateOverrideManager();

  manager.apply(mesh, {
    doubleSided: 'disabled',
    depthTest: 'default',
    depthWrite: 'default'
  });

  expect(material.side).toBe(FrontSide);
  expect(material.depthTest).toBe(false);
  expect(material.depthWrite).toBe(false);
});
