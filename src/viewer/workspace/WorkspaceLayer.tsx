import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import {
  Quaternion,
  Raycaster,
  Vector2,
  Vector3,
  type Object3D,
  type PerspectiveCamera,
} from 'three';
import type { ProductDefinition } from '@/catalog/schema';
import { useWorkspaceStore } from '@/state/workspaceStore';
import { matrixRelativeTo } from '../nodeUtils';
import { cssProjection, updateCssProjection } from './cssProjection';
import { screenFrame, screenMeshes, type ScreenFrame } from './screenFrame';
import { WorkspaceCamera, type CameraTarget } from './WorkspaceCamera';

interface WorkspaceLayerProps {
  product: ProductDefinition;
  scene: Object3D;
  index: ReadonlyMap<string, Object3D>;
  /** Blender object names hidden by the current configuration (monitors switched off). */
  hiddenNodes: ReadonlySet<string>;
}

interface ResolvedScreen {
  screen: ProductDefinition['screens'][number];
  node: Object3D;
  frame: ScreenFrame;
  /** World metres per local unit of the screen mesh. */
  worldScale: number;
}

const blenderName = (object: Object3D) =>
  (object.userData.name as string | undefined) ?? object.name;

/** True unless the node or one of its ancestors is hidden by the configuration. */
function isShown(node: Object3D, scene: Object3D, hidden: ReadonlySet<string>) {
  for (
    let current: Object3D | null = node;
    current && current !== scene;
    current = current.parent
  ) {
    if (hidden.has(blenderName(current))) return false;
  }
  return true;
}

/**
 * Workspace mode inside the canvas: finds each screen's display surface, tracks which ones
 * are switched on, lets the drag code find the screen under the pointer, and keeps the live
 * websites (the screen layer over the canvas) on their screens every frame.
 */
export function WorkspaceLayer({ product, scene, index, hiddenNodes }: WorkspaceLayerProps) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const active = useWorkspaceStore((s) => s.active);
  const dragging = useWorkspaceStore((s) => s.drag !== null);
  const setPicker = useWorkspaceStore((s) => s.setPicker);
  const setSurfaces = useWorkspaceStore((s) => s.setSurfaces);
  const updateDrag = useWorkspaceStore((s) => s.updateDrag);
  const endDrag = useWorkspaceStore((s) => s.endDrag);

  const screens = useMemo(() => {
    const resolved: ResolvedScreen[] = [];
    for (const screen of product.screens) {
      const node = index.get(screen.node);
      const mesh = node ? screenMeshes(node, product.screenMaterial)[0] : undefined;
      if (!node || !mesh) {
        console.warn(
          `[configurator] screen "${screen.node}" has no "${product.screenMaterial}" mesh`,
        );
        continue;
      }
      const scale = new Vector3();
      matrixRelativeTo(mesh, scene).decompose(new Vector3(), new Quaternion(), scale);
      resolved.push({
        screen,
        node,
        frame: screenFrame(mesh, scene),
        worldScale: ((scale.x + scale.y + scale.z) / 3) * product.model.scale,
      });
    }
    return resolved;
  }, [product, index, scene]);

  const visible = useMemo(
    () => screens.filter((s) => isShown(s.node, scene, hiddenNodes)),
    [screens, scene, hiddenNodes],
  );
  // The primary screen is the one the overview faces and that takes the windows of screens
  // switched off: the largest upright one (a monitor you look at, not a display lying on
  // the desk, which can be just as large), else the largest of any.
  const primary = useMemo(() => {
    const area = (s: ResolvedScreen) => s.frame.width * s.frame.height * s.worldScale ** 2;
    const upright = (s: ResolvedScreen) => {
      const front = new Vector3(0, 0, 1)
        .applyQuaternion(s.frame.quaternion)
        .transformDirection(matrixRelativeTo(s.frame.mesh, scene));
      return Math.abs(front.y) < 0.7;
    };
    return [...visible].sort(
      (a, b) => Number(upright(b)) - Number(upright(a)) || area(b) - area(a),
    )[0];
  }, [visible, scene]);
  const cameraTargets = useMemo<CameraTarget[]>(
    () => visible.map((s) => ({ id: s.screen.id, frame: s.frame })),
    [visible],
  );

  // Tell the screen layer which screens are on and how many CSS pixels each one spans.
  useEffect(() => {
    const ppm = product.pixelsPerMetre;
    setSurfaces(
      visible.map((s) => ({
        screen: s.screen,
        widthPx: Math.round(s.frame.width * s.worldScale * ppm),
        heightPx: Math.round(s.frame.height * s.worldScale * ppm),
      })),
      primary?.screen.id,
    );
  }, [visible, primary, product.pixelsPerMetre, setSurfaces]);

  const frames = useMemo(() => new Map(visible.map((s) => [s.screen.id, s.frame])), [visible]);
  useEffect(() => {
    cssProjection.invalidate = invalidate;
    return () => {
      cssProjection.invalidate = null;
    };
  }, [invalidate]);
  // When the scene is drawn, after everything moved this frame (camera, desk height), so the
  // sites never lag behind. Other renders of the scene (contact shadows) use other cameras.
  const root = useThree((s) => s.scene);
  const size = useThree((s) => s.size);
  useEffect(() => {
    if (!active) return;
    const previous = root.onAfterRender.bind(root);
    root.onAfterRender = (renderer, scene, drawn, ...rest) => {
      previous(renderer, scene, drawn, ...rest);
      if (drawn === camera) {
        updateCssProjection(camera as PerspectiveCamera, size, frames, product.pixelsPerMetre);
      }
    };
    invalidate();
    return () => {
      root.onAfterRender = previous;
    };
  }, [active, root, camera, size, frames, product.pixelsPerMetre, invalidate]);

  // Screen under a viewport position, for dropping dragged windows.
  useEffect(() => {
    const raycaster = new Raycaster();
    const pointer = new Vector2();
    setPicker((clientX, clientY) => {
      const rect = gl.domElement.getBoundingClientRect();
      pointer.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(
        visible.map((s) => s.frame.mesh),
        false,
      )[0];
      return visible.find((s) => s.frame.mesh === hit?.object)?.screen.id ?? null;
    });
    return () => setPicker(null);
  }, [visible, camera, gl, setPicker]);

  // While a window is dragged: iframes must not swallow the pointer, and the move and
  // release are followed on the whole window wherever the pointer goes.
  useEffect(() => {
    if (!dragging) return;
    document.body.classList.add('ws-dragging');
    const move = (event: PointerEvent) => updateDrag(event.clientX, event.clientY);
    const up = () => endDrag();
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      document.body.classList.remove('ws-dragging');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [dragging, updateDrag, endDrag]);

  if (screens.length === 0) return null;
  return <WorkspaceCamera screens={cameraTargets} primaryId={primary?.screen.id} />;
}
