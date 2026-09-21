import type { MaterialGroup } from '@/products/schema';
import { formatPriceDelta } from '../formatPrice';
import styles from './MaterialSwatches.module.css';

interface MaterialSwatchesProps {
  options: MaterialGroup['options'];
  selectedId: string;
  currency: string;
  isDisabled?: (optionId: string) => boolean;
  onSelect: (optionId: string) => void;
}

export function MaterialSwatches({
  options,
  selectedId,
  currency,
  isDisabled,
  onSelect,
}: MaterialSwatchesProps) {
  return (
    <div className={styles.swatches} role="radiogroup">
      {options.map((option) => {
        const delta = formatPriceDelta(option.priceDelta, currency);
        const title = delta ? `${option.label} (${delta})` : option.label;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={option.id === selectedId}
            aria-label={title}
            title={title}
            disabled={isDisabled?.(option.id)}
            className={styles.swatch}
            data-metallic={option.material.metalness > 0.5 || undefined}
            onClick={() => onSelect(option.id)}
          >
            <span
              className={styles.fill}
              style={
                option.thumbnail
                  ? { backgroundImage: `url(${option.thumbnail})` }
                  : { backgroundColor: option.material.color }
              }
            />
          </button>
        );
      })}
    </div>
  );
}
