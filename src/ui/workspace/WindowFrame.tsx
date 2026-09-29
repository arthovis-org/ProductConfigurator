import { useState, type PointerEvent } from 'react';
import type { Screen, WorkspaceWindow } from '@/catalog/schema';
import { useWorkspaceStore } from '@/state/workspaceStore';
import styles from './WindowFrame.module.css';

interface WindowFrameProps {
  window: WorkspaceWindow;
  screenId: string;
  /** Screens the window can move to (the visible ones). */
  screens: readonly Screen[];
}

// Keeps sites that need scripts, forms and their own storage working, while a sandbox still
// stops them from navigating the configurator itself.
const SANDBOX =
  'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals';

/**
 * One website on a screen: a title bar to drag it between screens, move it from a menu, zoom
 * the camera to its screen or open the site in a new tab (for sites that refuse to be shown
 * inside another page), and the site itself in an iframe.
 */
export function WindowFrame({ window: win, screenId, screens }: WindowFrameProps) {
  const startDrag = useWorkspaceStore((s) => s.startDrag);
  const moveWindow = useWorkspaceStore((s) => s.moveWindow);
  const setFocus = useWorkspaceStore((s) => s.setFocus);
  const focused = useWorkspaceStore((s) => s.focus === screenId);
  const [iconFailed, setIconFailed] = useState(false);
  const host = new URL(win.url).host;

  // Only starts the drag; the move and release are followed on the whole window (see
  // WorkspaceLayer), which keeps working even where pointer capture is unavailable.
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('a, button, select')) return;
    event.preventDefault();
    startDrag(win, event.clientX, event.clientY);
  };

  return (
    <div className={styles.window}>
      <div
        className={styles.titleBar}
        onPointerDown={onPointerDown}
        title="Drag onto another screen"
      >
        {!iconFailed && (
          <img
            className={styles.icon}
            src={`https://${host}/favicon.ico`}
            alt=""
            width={24}
            height={24}
            referrerPolicy="no-referrer"
            onError={() => setIconFailed(true)}
          />
        )}
        <span className={styles.title}>{win.title}</span>
        <span className={styles.host}>{host}</span>
        <div className={styles.actions}>
          <select
            className={styles.move}
            aria-label={`Move ${win.title} to another screen`}
            value={screenId}
            onChange={(event) => moveWindow(win.id, event.target.value)}
          >
            {screens.map((screen) => (
              <option key={screen.id} value={screen.id}>
                {screen.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={styles.button}
            aria-label={focused ? 'Show all screens' : `Zoom to the ${win.title} screen`}
            title={focused ? 'Show all screens' : 'Zoom to this screen'}
            onClick={() => setFocus(focused ? null : screenId)}
          >
            {focused ? '⤡' : '⤢'}
          </button>
          <a
            className={styles.button}
            href={win.url}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${win.title} in a new tab`}
            title="Open in a new tab (if the site stays blank here)"
          >
            ↗
          </a>
        </div>
      </div>
      <iframe
        className={styles.frame}
        src={win.url}
        title={win.title}
        sandbox={SANDBOX}
        allow="fullscreen; clipboard-read; clipboard-write"
        referrerPolicy="strict-origin-when-cross-origin"
        loading="lazy"
      />
    </div>
  );
}
