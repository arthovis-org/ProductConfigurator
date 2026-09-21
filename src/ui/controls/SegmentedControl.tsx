import styles from './SegmentedControl.module.css';

export interface SegmentedItem {
  id: string;
  label: string;
  /** Small secondary text, e.g. a price delta. */
  hint?: string;
  disabled?: boolean;
}

interface SegmentedControlProps {
  items: SegmentedItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** Visual size; `small` suits toolbars such as the header. */
  size?: 'regular' | 'small';
}

export function SegmentedControl({
  items,
  selectedId,
  onSelect,
  size = 'regular',
}: SegmentedControlProps) {
  return (
    <div className={styles.control} role="radiogroup" data-size={size}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="radio"
          aria-checked={item.id === selectedId}
          disabled={item.disabled}
          className={styles.item}
          onClick={() => onSelect(item.id)}
        >
          <span className={styles.label}>{item.label}</span>
          {item.hint && <span className={styles.hint}>{item.hint}</span>}
        </button>
      ))}
    </div>
  );
}
