import { useEffect } from 'react';
import { productList } from '@/products';
import { useConfiguratorStore } from '@/state/configuratorStore';
import { ConfiguratorPanel } from '@/ui/ConfiguratorPanel';
import { Header } from '@/ui/Header';
import { preloadProductModel } from '@/viewer/preload';
import { Scene } from '@/viewer/Scene';
import styles from './App.module.css';

productList.forEach(preloadProductModel);

export function App() {
  const hydrate = useConfiguratorStore((state) => state.hydrate);
  const serialize = useConfiguratorStore((state) => state.serialize);

  // Read `?product=…&c=…` on load, then keep the address bar in sync so the
  // current URL is always shareable.
  useEffect(() => {
    hydrate(window.location.search);
    return useConfiguratorStore.subscribe(() => {
      window.history.replaceState(null, '', `${window.location.pathname}${serialize()}`);
    });
  }, [hydrate, serialize]);

  return (
    <div className={styles.app}>
      <Header />
      <main className={styles.viewer}>
        <Scene />
      </main>
      <aside className={styles.panel}>
        <ConfiguratorPanel />
      </aside>
    </div>
  );
}
