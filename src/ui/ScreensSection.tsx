import type { ScreenGroup } from '@/products/schema';
import { useGroupAvailability } from '@/state/configuratorStore';
import { useSpatialStore } from '@/state/spatialStore';
import { OptionGroupSection } from './OptionGroupSection';
import styles from './ScreensSection.module.css';

interface ScreensSectionProps {
  groups: readonly ScreenGroup[];
}

/**
 * The screen-content controls (OS, workflow, layouts) plus the button that lifts the flat
 * desktops into the 3D workspace. Everything is hinted and disabled while no screen is on
 * the model, which `resolveAvailability` reports per screen group.
 */
export function ScreensSection({ groups }: ScreensSectionProps) {
  const availability = useGroupAvailability();
  const anyScreen = groups.some((group) => availability.get(group.id)?.available);
  const enabled = useSpatialStore((state) => state.enabled);
  const toggle = useSpatialStore((state) => state.toggle);

  return (
    <section
      className={styles.section}
      aria-labelledby="screens-heading"
      data-disabled={!anyScreen || undefined}
    >
      <div className={styles.header}>
        <h2 id="screens-heading" className={styles.title}>
          Screens
        </h2>
        <p className={styles.hint}>
          {anyScreen
            ? 'See a workflow on the screens as you would use it.'
            : 'Add a screen to preview what it shows.'}
        </p>
      </div>
      {groups.map((group) => (
        <OptionGroupSection key={group.id} group={group} />
      ))}
      <div className={styles.transition}>
        <button
          type="button"
          className={styles.transitionButton}
          aria-pressed={enabled}
          disabled={!anyScreen}
          onClick={toggle}
        >
          {enabled ? 'Back to the flat desktop' : 'Show the 3D workspace'}
        </button>
        <p className={styles.transitionHint}>
          Lifts the windows off the screens into a spatial, touch-friendly workspace; the touch
          screen becomes a control surface.
        </p>
      </div>
    </section>
  );
}
