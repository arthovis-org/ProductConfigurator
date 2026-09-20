import { useProduct, useResolvedConfiguration } from '@/state/configuratorStore';
import { formatPrice, formatPriceDelta } from './formatPrice';
import styles from './PriceSummary.module.css';

export function PriceSummary() {
  const { basePrice, currency } = useProduct();
  const { priceLines, totalPrice } = useResolvedConfiguration();

  return (
    <section className={styles.summary} aria-label="Price summary">
      <dl className={styles.lines}>
        <div className={styles.line}>
          <dt>Base price</dt>
          <dd>{formatPrice(basePrice, currency)}</dd>
        </div>
        {priceLines.map((line) => (
          <div key={line.groupId} className={styles.line}>
            <dt>
              {line.groupLabel} <span className={styles.muted}>· {line.optionLabel}</span>
            </dt>
            <dd>{formatPriceDelta(line.priceDelta, currency)}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.total}>
        <span>Total</span>
        <span className={styles.amount} data-testid="total-price">
          {formatPrice(totalPrice, currency)}
        </span>
      </div>
    </section>
  );
}
