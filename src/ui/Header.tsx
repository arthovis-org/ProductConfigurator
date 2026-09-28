import { useEffect, useState } from 'react';
import { productList } from '@/catalog';
import { useConfiguratorStore, useProduct } from '@/state/configuratorStore';
import styles from './Header.module.css';

export function Header() {
  const product = useProduct();
  const resetToDefaults = useConfiguratorStore((state) => state.resetToDefaults);
  const selectProduct = useConfiguratorStore((state) => state.selectProduct);
  const serialize = useConfiguratorStore((state) => state.serialize);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copyShareLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}${serialize()}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      window.prompt('Copy this link', url);
    }
  };

  return (
    <header className={styles.header}>
      <div className={styles.title}>
        <span className={styles.eyebrow}>Configurator</span>
        {productList.length > 1 ? (
          <h1 className={styles.name}>
            <select
              className={styles.productSelect}
              value={product.id}
              aria-label="Product"
              onChange={(event) => selectProduct(event.target.value)}
            >
              {productList.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </h1>
        ) : (
          <h1 className={styles.name}>{product.name}</h1>
        )}
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={resetToDefaults}>
          Reset
        </button>
        <button
          type="button"
          className={`${styles.button} ${styles.primary}`}
          onClick={() => void copyShareLink()}
        >
          {copied ? 'Link copied' : 'Copy share link'}
        </button>
      </div>
    </header>
  );
}
