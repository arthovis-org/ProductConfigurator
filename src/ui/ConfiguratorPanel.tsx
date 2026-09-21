import { useProduct } from '@/state/configuratorStore';
import styles from './ConfiguratorPanel.module.css';
import { OptionGroupSection } from './OptionGroupSection';
import { PriceSummary } from './PriceSummary';
import { ScreensSection } from './ScreensSection';

/**
 * Lists every option group of the current product in declaration order, followed by the
 * price summary. Screen groups are gathered into one "Screens" section, placed where the
 * first of them appears.
 */
export function ConfiguratorPanel() {
  const product = useProduct();
  const screenGroups = product.optionGroups.filter((group) => group.type === 'screen');
  const firstScreenGroup = screenGroups[0];

  return (
    <div className={styles.panel}>
      <p className={styles.description}>{product.description}</p>

      {product.optionGroups.map((group) => {
        if (group.type === 'screen') {
          return group === firstScreenGroup ? (
            <ScreensSection key="screens" groups={screenGroups} />
          ) : null;
        }
        return <OptionGroupSection key={group.id} group={group} />;
      })}

      <PriceSummary />
    </div>
  );
}
