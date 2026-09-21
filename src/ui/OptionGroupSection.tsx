import type { OptionGroup } from '@/products/schema';
import {
  useConfiguratorStore,
  useGroupAvailability,
  useProduct,
  useSelections,
} from '@/state/configuratorStore';
import { optionDisplayLabel, selectedOption } from '@/state/derive';
import styles from './ConfiguratorPanel.module.css';
import { OptionGroupControl } from './OptionGroupControl';
import { formatPriceDelta } from './formatPrice';

interface OptionGroupSectionProps {
  group: OptionGroup;
}

/** One option group: heading with the selected value (or the blocking requirement) and its control. */
export function OptionGroupSection({ group }: OptionGroupSectionProps) {
  const { currency } = useProduct();
  const selections = useSelections();
  const availability = useGroupAvailability();
  const selectOption = useConfiguratorStore((state) => state.selectOption);

  const option = selectedOption(group, selections);
  const delta = formatPriceDelta(option.priceDelta, currency);
  const state = availability.get(group.id);
  const disabled = state?.available === false;

  return (
    <section
      className={styles.group}
      aria-labelledby={`group-${group.id}`}
      data-disabled={disabled || undefined}
    >
      <div className={styles.groupHeader}>
        <h2 id={`group-${group.id}`} className={styles.groupLabel}>
          {group.label}
        </h2>
        {disabled ? (
          <span className={styles.requirement}>{state.hint}</span>
        ) : (
          <span className={styles.selected}>
            {optionDisplayLabel(group, option)}
            {delta && <span className={styles.delta}> {delta}</span>}
          </span>
        )}
      </div>
      {group.description && <p className={styles.groupDescription}>{group.description}</p>}
      <OptionGroupControl
        group={group}
        selectedOptionId={option.id}
        disabled={disabled}
        disabledOptionIds={state?.unavailableOptionIds}
        onSelect={(optionId) => selectOption(group.id, optionId)}
      />
    </section>
  );
}
