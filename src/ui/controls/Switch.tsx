import styles from './Switch.module.css';

interface SwitchProps {
  label: string;
  checked: boolean;
  hint?: string;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

/** "Touch screen" -> "touch screen", but "4K screen" stays as written. */
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

export function Switch({ label, checked, hint, disabled = false, onChange }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={styles.row}
      onClick={() => {
        onChange(!checked);
      }}
    >
      <span className={styles.text}>
        <span className={styles.label}>
          {checked ? `${label} included` : `Add ${lowerFirst(label)}`}
        </span>
        {hint && <span className={styles.hint}>{hint}</span>}
      </span>
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
    </button>
  );
}
