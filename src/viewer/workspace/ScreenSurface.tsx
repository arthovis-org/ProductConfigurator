import { useLayoutEffect, useRef } from 'react';
import type { Screen, WorkspaceWindow } from '@/catalog/schema';
import { useWorkspaceStore, type ScreenSurfaceInfo } from '@/state/workspaceStore';
import { WindowFrame } from '@/ui/workspace/WindowFrame';
import { cssProjection } from './cssProjection';
import styles from './ScreenSurface.module.css';

interface ScreenSurfaceProps {
  surface: ScreenSurfaceInfo;
  windows: readonly WorkspaceWindow[];
  /** Screens a window can be moved to. */
  targets: readonly Screen[];
}

/**
 * The live content of one screen: a DOM element the viewer lays exactly over the display
 * surface every frame (see `cssProjection`), so it rises with the desk. Every screen uses the
 * same pixel density, so text is the same physical size everywhere and a portrait screen gets
 * the narrow layout a real one would.
 */
export function ScreenSurface({ surface, windows, targets }: ScreenSurfaceProps) {
  const { screen, widthPx, heightPx } = surface;
  const ref = useRef<HTMLDivElement>(null);
  const isDropTarget = useWorkspaceStore(
    (s) =>
      s.drag !== null &&
      s.drag.over === screen.id &&
      !windows.some((w) => w.id === s.drag?.windowId),
  );

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    cssProjection.surfaces.set(screen.id, element);
    cssProjection.invalidate?.();
    return () => {
      cssProjection.surfaces.delete(screen.id);
    };
  }, [screen.id]);

  return (
    <div
      ref={ref}
      className={styles.screen}
      data-portrait={heightPx > widthPx || undefined}
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
  );
}
