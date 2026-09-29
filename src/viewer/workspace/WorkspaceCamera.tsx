import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { type PerspectiveCamera, Vector3 } from 'three';
import { useWorkspaceStore } from '@/state/workspaceStore';
import type { ScreenFrame } from './screenFrame';

export interface CameraTarget {
  id: string;
  frame: ScreenFrame;
}

interface WorkspaceCameraProps {
  /** The visible screens. */
  screens: readonly CameraTarget[];
  /** Screen the overview looks straight at. */
  primaryId: string | undefined;
}

/** The parts of drei's OrbitControls this component adjusts. */
interface Controls {
  enabled: boolean;
  target: Vector3;
  minDistance: number;
  maxDistance: number;
  minPolarAngle: number;
  maxPolarAngle: number;
  update: () => void;
}

interface Pose {
  position: Vector3;
  target: Vector3;
}

const MOVE_SECONDS = 0.7;
const MARGIN = 1.08;
const WORLD_UP = new Vector3(0, 1, 0);

/** Corners of a screen's display surface in world space. */
function worldCorners({ frame }: CameraTarget): Vector3[] {
  frame.mesh.updateWorldMatrix(true, false);
  const right = new Vector3(1, 0, 0)
    .applyQuaternion(frame.quaternion)
    .multiplyScalar(frame.width / 2);
  const up = new Vector3(0, 1, 0)
    .applyQuaternion(frame.quaternion)
    .multiplyScalar(frame.height / 2);
  return [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ].map(([a = 0, b = 0]) =>
    frame.position
      .clone()
      .addScaledVector(right, a)
      .addScaledVector(up, b)
      .applyMatrix4(frame.mesh.matrixWorld),
  );
}

/** Direction a screen's display faces, in world space. */
function worldFront({ frame }: CameraTarget): Vector3 {
  frame.mesh.updateWorldMatrix(true, false);
  return new Vector3(0, 0, 1)
    .applyQuaternion(frame.quaternion)
    .transformDirection(frame.mesh.matrixWorld);
}

/** A pose looking along -`back` that fits all corners, like sitting in front of the desk. */
function fitPose(corners: Vector3[], back: Vector3, camera: PerspectiveCamera): Pose {
  const centre = corners
    .reduce((sum, c) => sum.add(c), new Vector3())
    .multiplyScalar(1 / Math.max(1, corners.length));
  const right = new Vector3().crossVectors(WORLD_UP, back);
  if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
  right.normalize();
  const up = new Vector3().crossVectors(back, right).normalize();
  let hx = 0;
  let hy = 0;
  let nearest = 0;
  for (const corner of corners) {
    const offset = corner.clone().sub(centre);
    hx = Math.max(hx, Math.abs(offset.dot(right)));
    hy = Math.max(hy, Math.abs(offset.dot(up)));
    nearest = Math.max(nearest, offset.dot(back));
  }
  const tanV = Math.tan((camera.fov * Math.PI) / 360);
  const distance = Math.max(hy / tanV, hx / (tanV * camera.aspect)) * MARGIN + nearest;
  return { position: centre.clone().addScaledVector(back, distance), target: centre };
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * Moves the camera for workspace mode: to a seated view of every visible screen (or one
 * focused screen), and back to where the visitor was when they leave. Orbiting is off
 * meanwhile, so pointer input goes to the websites.
 */
export function WorkspaceCamera({ screens, primaryId }: WorkspaceCameraProps) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const controls = useThree((s) => s.controls) as unknown as Controls | null;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const active = useWorkspaceStore((s) => s.active);
  const focus = useWorkspaceStore((s) => s.focus);
  const setCameraFree = useWorkspaceStore((s) => s.setCameraFree);

  const saved = useRef<(Pose & { limits: Partial<Controls> }) | null>(null);
  const move = useRef<{ from: Pose; to: Pose; t: number; onDone?: () => void } | null>(null);

  const current = (): Pose => ({
    position: camera.position.clone(),
    target: controls?.target.clone() ?? new Vector3(),
  });

  // Entering: remember the orbit pose and limits, lift the limits that would fight the view.
  useEffect(() => {
    if (!active || !controls || saved.current) return;
    saved.current = {
      ...current(),
      limits: {
        minDistance: controls.minDistance,
        maxDistance: controls.maxDistance,
        minPolarAngle: controls.minPolarAngle,
        maxPolarAngle: controls.maxPolarAngle,
      },
    };
    Object.assign(controls, {
      enabled: false,
      minDistance: 0.05,
      maxDistance: Infinity,
      minPolarAngle: 0,
      maxPolarAngle: Math.PI,
    });
    // `current` only reads refs and the camera; it does not need to be a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, controls]);

  // While active: frame the focused screen or all of them; refit when the canvas resizes.
  useEffect(() => {
    if (!active || screens.length === 0) return;
    const focused = screens.find((s) => s.id === focus);
    const facing = focused ?? screens.find((s) => s.id === primaryId) ?? screens[0];
    if (!facing) return;
    const corners = (focused ? [focused] : screens).flatMap(worldCorners);
    move.current = { from: current(), to: fitPose(corners, worldFront(facing), camera), t: 0 };
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, focus, screens, primaryId, size.width, size.height, camera, invalidate]);

  // Leaving: fly back, then hand the camera back to the orbit controls.
  useEffect(() => {
    if (active || !saved.current) return;
    const back = saved.current;
    move.current = {
      from: current(),
      to: back,
      t: 0,
      onDone: () => {
        if (controls) Object.assign(controls, { ...back.limits, enabled: true });
        saved.current = null;
        setCameraFree(true);
      },
    };
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useFrame((_, delta) => {
    const m = move.current;
    if (!m) return;
    m.t = Math.min(1, m.t + Math.min(delta, 0.1) / MOVE_SECONDS);
    const k = smooth(m.t);
    camera.position.lerpVectors(m.from.position, m.to.position, k);
    const target = new Vector3().lerpVectors(m.from.target, m.to.target, k);
    controls?.target.copy(target);
    camera.lookAt(target);
    controls?.update();
    if (m.t >= 1) {
      move.current = null;
      m.onDone?.();
    }
    invalidate();
  });

  return null;
}
