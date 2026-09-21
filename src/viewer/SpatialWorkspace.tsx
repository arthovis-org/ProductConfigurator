import { createPortal, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  AdditiveBlending,
  CanvasTexture,
  Euler,
  type Group,
  MathUtils,
  Matrix4,
  type Mesh,
  type MeshBasicMaterial,
  Quaternion,
  Vector3,
  type Object3D,
} from 'three';
import type { Pane } from '@/screens/layouts';
import { palette } from '@/screens/palette';
import {
  renderControlSurface,
  renderPaneCard,
  renderSpatialBackdrop,
  screenPanes,
  textureSize,
  type ScreenSpec,
} from '@/screens/renderScreen';
import { useSpatialStore } from '@/state/spatialStore';
import { createCanvasTexture } from './canvasTexture';
import type { PanelFrame } from './panelFrame';

/** A screen that is currently on the model, with where its panel is. */
export interface VisibleScreen {
  node: Object3D;
  spec: ScreenSpec;
  frame: PanelFrame;
}

/** Seconds for the flat -> spatial transition (and back). */
const DURATION = 1.5;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

interface SpatialWorkspaceProps {
  screens: readonly VisibleScreen[];
}

/**
 * The "3D workspace" transition. While enabled, each display's windows lift off the
 * screen plane as floating cards tilted towards the user, the desktop fades to a dark
 * spatial backdrop and touch screens become control surfaces. Progress is driven in
 * `useFrame`; the canvas runs on demand, so the loop asks for the next frame itself
 * while the animation is running and stops when it settles.
 */
export function SpatialWorkspace({ screens }: SpatialWorkspaceProps) {
  const enabled = useSpatialStore((state) => state.enabled);
  const invalidate = useThree((state) => state.invalidate);
  const progress = useRef(0);
  const eased = useRef(0);
  // Cards mount on the first frame after enabling and stay until the reverse animation ends.
  const [mounted, setMounted] = useState(false);

  // A change of `enabled` must wake the on-demand frame loop, which then drives everything.
  useEffect(() => invalidate(), [enabled, invalidate]);

  useFrame((_, delta) => {
    const target = enabled ? 1 : 0;
    if (progress.current !== target) {
      const step = Math.min(delta, 0.1) / DURATION;
      progress.current =
        target > progress.current
          ? Math.min(target, progress.current + step)
          : Math.max(target, progress.current - step);
      eased.current = easeInOut(progress.current);
      invalidate();
    }
    // Same value -> React bails out, so this is free on every frame.
    setMounted(enabled || progress.current > 0);
  }, -1);

  if (!mounted) return null;
  return (
    <>
      {screens.map((screen) => (
        <ScreenSpatial key={screen.node.uuid} screen={screen} eased={eased} />
      ))}
    </>
  );
}

interface ScreenSpatialProps {
  screen: VisibleScreen;
  eased: RefObject<number>;
}

/** Everything spatial for one screen, rendered into the panel node's local space. */
function ScreenSpatial({ screen, eased }: ScreenSpatialProps) {
  const { frame, spec, node } = screen;
  const basis = useMemo(
    () =>
      new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(frame.u, frame.v, frame.n)),
    [frame],
  );
  const panes = useMemo(() => (spec.kind === 'touch' ? [] : screenPanes(spec)), [spec]);

  return createPortal(
    <group position={frame.center} quaternion={basis}>
      <Backdrop spec={spec} frame={frame} eased={eased} />
      {panes.map((pane, index) => (
        <PaneCard
          key={`${spec.content.layout}-${index}`}
          spec={spec}
          pane={pane}
          index={index}
          frame={frame}
          eased={eased}
        />
      ))}
    </group>,
    node,
  );
}

function useMaxAnisotropy() {
  return useThree((state) => state.gl.capabilities.getMaxAnisotropy());
}

/** Disposes a memoised texture when it is replaced or the component unmounts. */
function useDisposed(texture: CanvasTexture) {
  useEffect(() => () => texture.dispose(), [texture]);
}

interface BackdropProps {
  spec: ScreenSpec;
  frame: PanelFrame;
  eased: RefObject<number>;
}

/** Fades the flat desktop out: a dark backdrop for displays, a control surface for touch. */
function Backdrop({ spec, frame, eased }: BackdropProps) {
  const anisotropy = useMaxAnisotropy();
  const texture = useMemo(
    () =>
      createCanvasTexture((canvas) => {
        if (spec.kind === 'touch') renderControlSurface(canvas, spec);
        else {
          const { w, h } = textureSize(spec);
          renderSpatialBackdrop(canvas, w, h);
        }
      }, anisotropy),
    [spec, anisotropy],
  );
  useDisposed(texture);
  const mesh = useRef<Mesh>(null);
  const material = useRef<MeshBasicMaterial>(null);
  useFrame(() => {
    const t = eased.current;
    if (mesh.current) mesh.current.visible = t > 0.001;
    if (material.current) material.current.opacity = t;
  });
  return (
    <mesh ref={mesh} position={[0, 0, frame.halfDepth + 0.0006]} renderOrder={1}>
      <planeGeometry args={[frame.width, frame.height]} />
      <meshBasicMaterial
        ref={material}
        map={texture}
        transparent
        opacity={0}
        toneMapped={false}
        depthWrite={false}
      />
    </mesh>
  );
}

let glowTexture: CanvasTexture | null = null;
/** Shared soft radial glow placed behind every card. */
function getGlowTexture(): CanvasTexture {
  if (glowTexture) return glowTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.35)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  glowTexture = new CanvasTexture(canvas);
  return glowTexture;
}

interface PaneCardProps {
  spec: ScreenSpec;
  pane: Pane;
  index: number;
  frame: PanelFrame;
  eased: RefObject<number>;
}

/** One window, lifted off the screen and tilted to face the user. */
function PaneCard({ spec, pane, index, frame, eased }: PaneCardProps) {
  const width = pane.w * frame.width;
  const height = pane.h * frame.height;
  const cx = (pane.x + pane.w / 2 - 0.5) * frame.width;
  const cy = (0.5 - (pane.y + pane.h / 2)) * frame.height;

  const anisotropy = useMaxAnisotropy();
  const texture = useMemo(
    () =>
      createCanvasTexture((canvas) => {
        const full = textureSize(spec);
        renderPaneCard(
          canvas,
          spec,
          index,
          Math.max(64, Math.round(pane.w * full.w)),
          Math.max(64, Math.round(pane.h * full.h)),
        );
      }, anisotropy),
    [spec, pane, index, anisotropy],
  );
  useDisposed(texture);

  const poses = useMemo(() => {
    const rest = {
      position: new Vector3(cx, cy, frame.halfDepth + 0.002),
      quaternion: new Quaternion(),
    };
    const lift = frame.height * (0.22 + 0.1 * (index % 2));
    const yaw = -(cx / (frame.width / 2)) * MathUtils.degToRad(14);
    const pitch = (cy / (frame.height / 2)) * MathUtils.degToRad(8);
    const lifted = {
      position: new Vector3(cx * 1.18, cy * 1.1 + frame.height * 0.03, lift),
      quaternion: new Quaternion().setFromEuler(new Euler(pitch, yaw, 0)),
    };
    return { rest, lifted };
  }, [cx, cy, frame, index]);

  const group = useRef<Group>(null);
  const cardMaterial = useRef<MeshBasicMaterial>(null);
  const glowMaterial = useRef<MeshBasicMaterial>(null);

  useFrame(() => {
    const t = eased.current;
    const target = group.current;
    if (!target) return;
    target.visible = t > 0.001;
    target.position.lerpVectors(poses.rest.position, poses.lifted.position, t);
    target.quaternion.slerpQuaternions(poses.rest.quaternion, poses.lifted.quaternion, t);
    target.scale.setScalar(1 + 0.06 * t);
    if (cardMaterial.current) cardMaterial.current.opacity = t;
    if (glowMaterial.current) glowMaterial.current.opacity = 0.55 * t;
  });

  return (
    <group ref={group} visible={false}>
      <mesh position={[0, 0, -0.003]} scale={[1.3, 1.4, 1]} renderOrder={2}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial
          ref={glowMaterial}
          map={getGlowTexture()}
          color={palette.glow}
          transparent
          opacity={0}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh renderOrder={3}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial
          ref={cardMaterial}
          map={texture}
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
