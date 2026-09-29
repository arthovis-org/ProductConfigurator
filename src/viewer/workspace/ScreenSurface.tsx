import { useLayoutEffect, useRef } from 'react';
import type { Screen, WorkspaceWindow } from '@/catalog/schema';
import { useWorkspaceStore, type ScreenSurfaceInfo, type WindowDrag } from '@/state/workspaceStore';
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
  const drop = useWorkspaceStore((s) => (s.drag?.over?.screen === screen.id ? s.drag.over : null));
  const dropLabel = useWorkspaceStore((s) => (s.drag ? dropDescription(s.drag, windows) : ''));

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
      {drop && (
        <div
          className={styles.dropPreview}
          style={{
            left: drop.rect.x,
            top: drop.rect.y,
            width: drop.rect.width,
            height: drop.rect.height,
          }}
          aria-hidden="true"
        >
          <span className={styles.dropLabel}>{dropLabel}</span>
        </div>
      )}
    </div>
  );
}

/** What the drop preview says, e.g. "Swap with Notes". */
function dropDescription(drag: WindowDrag, windows: readonly WorkspaceWindow[]) {
  const target = drag.over;
  if (!target) return '';
  const other = windows.find((w) => w.id === target.windowId)?.title;
  switch (target.action) {
    case 'swap':
      return `Swap with ${other ?? 'this window'}`;
    case 'before':
    case 'after':
      return `Next to ${other ?? 'this window'}`;
    default:
      return `Move ${drag.title} here`;
  }
}
