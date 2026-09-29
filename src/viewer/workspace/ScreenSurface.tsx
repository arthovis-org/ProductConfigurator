import { Html } from '@react-three/drei';
import { createPortal } from '@react-three/fiber';
import type { Screen, WorkspaceWindow } from '@/catalog/schema';
import { useWorkspaceStore } from '@/state/workspaceStore';
import { WindowFrame } from '@/ui/workspace/WindowFrame';
import styles from './ScreenSurface.module.css';
import type { ScreenFrame } from './screenFrame';

interface ScreenSurfaceProps {
  screen: Screen;
  frame: ScreenFrame;
  /** World metres per local unit of the screen mesh (object and model scale). */
  worldScale: number;
  pixelsPerMetre: number;
  windows: readonly WorkspaceWindow[];
  /** Screens a window can be moved to. */
  targets: readonly Screen[];
}

/**
 * The live content of one screen: a DOM element laid exactly over the display surface. It is
 * portalled into the screen mesh, so it rises with the desk and disappears with its monitor.
 * Every screen uses the same pixel density, so text is the same physical size everywhere and
 * a portrait screen gets the narrow layout a real one would.
 */
export function ScreenSurface({
  screen,
  frame,
  worldScale,
  pixelsPerMetre,
  windows,
  targets,
}: ScreenSurfaceProps) {
  const isDropTarget = useWorkspaceStore(
    (s) =>
      s.drag !== null &&
      s.drag.over === screen.id &&
      !windows.some((w) => w.id === s.drag?.windowId),
  );
  const widthPx = Math.round(frame.width * worldScale * pixelsPerMetre);
  const heightPx = Math.round(frame.height * worldScale * pixelsPerMetre);
  const portrait = heightPx > widthPx;

  return createPortal(
    <group position={frame.position} quaternion={frame.quaternion}>
      <Html
        transform
        // drei maps one CSS pixel to distanceFactor / 400 local units; the mesh's own scale
        // applies on top, so divide it out to get pixelsPerMetre in world space.
        distanceFactor={400 / (pixelsPerMetre * worldScale)}
        zIndexRange={[100, 0]}
      >
        <div
          className={styles.screen}
          data-portrait={portrait || undefined}
          data-drop-target={isDropTarget || undefined}
          style={{ width: widthPx, height: heightPx }}
          aria-label={`${screen.label} screen`}
        >
          {windows.length === 0 ? (
            <div className={styles.empty}>
              {screen.label} screen
              <br />
              Drag a window here
            </div>
          ) : (
            windows.map((window) => (
              <WindowFrame key={window.id} window={window} screenId={screen.id} screens={targets} />
            ))
          )}
        </div>
      </Html>
    </group>,
    frame.mesh,
  );
}
