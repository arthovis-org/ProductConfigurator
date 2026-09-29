import { useProduct } from '@/state/configuratorStore';
import { useWorkspaceStore, workspaceById } from '@/state/workspaceStore';
import styles from './WorkspaceHud.module.css';

/**
 * Controls over the viewer while workspace mode is on (exit, back to all screens), and the
 * label that follows the pointer while a window is dragged between screens.
 */
export function WorkspaceHud() {
  const product = useProduct();
  const active = useWorkspaceStore((s) => s.active);
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  const focus = useWorkspaceStore((s) => s.focus);
  const drag = useWorkspaceStore((s) => s.drag);
  const exit = useWorkspaceStore((s) => s.exit);
  const setFocus = useWorkspaceStore((s) => s.setFocus);
  if (!active) return null;

  const workspace = workspaceById(product, workspaceId);
  const target = drag?.over ? product.screens.find((s) => s.id === drag.over) : undefined;

  return (
    <>
      <div className={styles.bar} role="toolbar" aria-label="Workspace">
        <span className={styles.name}>{workspace?.label} workspace</span>
        {focus && (
          <button type="button" className={styles.button} onClick={() => setFocus(null)}>
            All screens
          </button>
        )}
        <button type="button" className={`${styles.button} ${styles.primary}`} onClick={exit}>
          Exit
        </button>
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
