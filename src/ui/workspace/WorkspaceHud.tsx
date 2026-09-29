import { useProduct } from '@/state/configuratorStore';
import { useWorkspaceStore, workspaceById } from '@/state/workspaceStore';
import styles from './WorkspaceHud.module.css';

/**
 * The workspace demo's own controls, over the viewer: a card to start it, then a toolbar
 * while it runs (switch workspace, back to all screens, reset, exit) and the label that
 * follows the pointer while a window is dragged between screens.
 */
export function WorkspaceHud() {
  const product = useProduct();
  const active = useWorkspaceStore((s) => s.active);
  const cameraFree = useWorkspaceStore((s) => s.cameraFree);
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  const focus = useWorkspaceStore((s) => s.focus);
  const drag = useWorkspaceStore((s) => s.drag);
  const enter = useWorkspaceStore((s) => s.enter);
  const exit = useWorkspaceStore((s) => s.exit);
  const select = useWorkspaceStore((s) => s.select);
  const resetWindows = useWorkspaceStore((s) => s.resetWindows);
  const setFocus = useWorkspaceStore((s) => s.setFocus);
  if (product.workspaces.length === 0) return null;

  const workspace = workspaceById(product, workspaceId);

  if (!active) {
    // Hidden while the camera flies back from a workspace.
    if (!cameraFree) return null;
    return (
      <section className={styles.card} aria-labelledby="workspace-demo">
        <span className={styles.eyebrow}>Live demo</span>
        <h2 id="workspace-demo" className={styles.title}>
          Work on these screens
        </h2>
        <p className={styles.description}>
          {product.workspaces.length === 1 && workspace?.description
            ? workspace.description
            : 'Real websites on every monitor. Use them, and drag windows between screens.'}
        </p>
        <div className={styles.actions}>
          {product.workspaces.map((w) => (
            <button
              key={w.id}
              type="button"
              className={`${styles.button} ${styles.primary}`}
              onClick={() => enter(w.id)}
            >
              {product.workspaces.length === 1
                ? `Try the ${w.label.toLowerCase()} workspace`
                : w.label}
            </button>
          ))}
        </div>
      </section>
    );
  }

  const target = drag?.over ? product.screens.find((s) => s.id === drag.over) : undefined;

  return (
    <>
      <div className={styles.top}>
        <div className={styles.bar} role="toolbar" aria-label="Workspace">
          {product.workspaces.length > 1 ? (
            <div className={styles.tabs} role="radiogroup" aria-label="Workspace">
              {product.workspaces.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  role="radio"
                  aria-checked={w.id === workspace?.id}
                  className={styles.tab}
                  onClick={() => select(w.id)}
                >
                  {w.label}
                </button>
              ))}
            </div>
          ) : (
            <span className={styles.name}>{workspace?.label} workspace</span>
          )}
          {focus && (
            <button type="button" className={styles.button} onClick={() => setFocus(null)}>
              All screens
            </button>
          )}
          <button type="button" className={styles.button} onClick={resetWindows}>
            Reset windows
          </button>
          <button type="button" className={`${styles.button} ${styles.primary}`} onClick={exit}>
            Exit
          </button>
        </div>
        <p className={styles.hint}>Drag a title bar to move a window · ⤢ zooms to one screen</p>
      </div>
      {drag && (
        <div className={styles.ghost} style={{ left: drag.x, top: drag.y }} aria-hidden="true">
          {drag.title}
          <span className={styles.ghostTarget}>
            {target ? `→ ${target.label}` : 'Drop on a screen'}
          </span>
        </div>
      )}
    </>
  );
}
