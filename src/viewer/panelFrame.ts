import { Box3, Vector3, type Object3D } from 'three';
import { collectMeshes } from './nodeUtils';

/**
 * Where a screen panel sits in its node's local space: its centre, size and an
 * orthonormal basis (`u` right, `v` up, `n` outward normal) matching the texture's
 * orientation. The thinnest axis of the panel mesh is taken as the normal.
 */
export interface PanelFrame {
  width: number;
  height: number;
  /** Half the panel thickness, so overlays can sit just proud of the surface. */
  halfDepth: number;
  center: Vector3;
  u: Vector3;
  v: Vector3;
  n: Vector3;
}

export function measurePanel(node: Object3D): PanelFrame | null {
  const mesh = collectMeshes(node)[0];
  if (!mesh) return null;
  mesh.geometry.computeBoundingBox();
  const box = mesh.geometry.boundingBox;
  if (!box) return null;
  const local = new Box3().copy(box);
  // The mesh is usually the node itself; if it is a child, bring its box into node space.
  if (mesh !== node) local.applyMatrix4(mesh.matrix);
  const size = local.getSize(new Vector3());
  const center = local.getCenter(new Vector3());
  const sizes = [size.x, size.y, size.z];
  const normalAxis = sizes.indexOf(Math.min(...sizes));
  const halfDepth = (sizes[normalAxis] ?? 0) / 2;

  switch (normalAxis) {
    case 1: // horizontal panel facing +Y (touch screen in a desk): texture top at -Z
      return {
        width: size.x,
        height: size.z,
        halfDepth,
        center,
        u: new Vector3(1, 0, 0),
        v: new Vector3(0, 0, -1),
        n: new Vector3(0, 1, 0),
      };
    case 0: // panel facing +X
      return {
        width: size.z,
        height: size.y,
        halfDepth,
        center,
        u: new Vector3(0, 0, -1),
        v: new Vector3(0, 1, 0),
        n: new Vector3(1, 0, 0),
      };
    default: // vertical panel facing +Z (monitors)
      return {
        width: size.x,
        height: size.y,
        halfDepth,
        center,
        u: new Vector3(1, 0, 0),
        v: new Vector3(0, 1, 0),
        n: new Vector3(0, 0, 1),
      };
  }
}
