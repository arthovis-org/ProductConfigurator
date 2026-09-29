import { useProduct } from '@/state/configuratorStore';
import { useWorkspaceStore, workspaceById } from '@/state/workspaceStore';
import { SegmentedControl } from './controls/SegmentedControl';
import styles from './WorkspaceControl.module.css';

/**
 * Panel section for the workspace demo: live websites on the product's screens. Only shown
 * for products that define workspaces.
 */
export function WorkspaceControl() {
  const product = useProduct();
  const active = useWorkspaceStore((s) => s.active);
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  const enter = useWorkspaceStore((s) => s.enter);
  const exit = useWorkspaceStore((s) => s.exit);
  const select = useWorkspaceStore((s) => s.select);
  const resetWindows = useWorkspaceStore((s) => s.resetWindows);
  if (product.workspaces.length === 0) return null;

  const workspace = workspaceById(product, workspaceId);

  return (
    <div className={styles.control}>
      {product.workspaces.length > 1 && (
        <SegmentedControl
          items={product.workspaces.map((w) => ({ id: w.id, label: w.label }))}
          selectedId={workspace?.id ?? ''}
          onSelect={(id) => (active ? select(id) : enter(id))}
        />
      )}
      {workspace?.description && <p className={styles.description}>{workspace.description}</p>}
      {active ? (
        <>
          <p className={styles.tip}>
            Use the sites on the screens, drag a window by its title bar onto another monitor, or
            zoom to one screen with ⤢.
          </p>
          <div className={styles.actions}>
            <button type="button" className={styles.button} onClick={resetWindows}>
              Reset windows
            </button>
            <button type="button" className={`${styles.button} ${styles.primary}`} onClick={exit}>
              Exit workspace
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          className={`${styles.button} ${styles.primary} ${styles.wide}`}
          onClick={() => enter()}
        >
          Try the {workspace?.label.toLowerCase()} workspace
        </button>
      )}
    </div>
  );
}
