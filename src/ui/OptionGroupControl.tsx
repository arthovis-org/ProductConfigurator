import type { OptionGroup } from '@/products/schema';
import { useProduct } from '@/state/configuratorStore';
import { optionDisplayLabel } from '@/state/derive';
import { MaterialSwatches } from './controls/MaterialSwatches';
import { SegmentedControl } from './controls/SegmentedControl';
import { Switch } from './controls/Switch';
import { formatPriceDelta } from './formatPrice';

interface OptionGroupControlProps {
  group: OptionGroup;
  selectedOptionId: string;
  onSelect: (optionId: string) => void;
}

/** Picks the right input for an option group's type. */
export function OptionGroupControl({ group, selectedOptionId, onSelect }: OptionGroupControlProps) {
  const { currency } = useProduct();

  switch (group.type) {
    case 'material':
      return (
        <MaterialSwatches
          options={group.options}
          selectedId={selectedOptionId}
          onSelect={onSelect}
          currency={currency}
        />
      );
    case 'variant':
    case 'dimension':
      return (
        <SegmentedControl
          items={group.options.map((option) => ({
            id: option.id,
            label: optionDisplayLabel(group, option),
            hint: formatPriceDelta(option.priceDelta, currency),
          }))}
          selectedId={selectedOptionId}
          onSelect={onSelect}
        />
      );
    case 'toggle': {
      const on = group.options.find((option) => option.visible);
      const off = group.options.find((option) => !option.visible);
      // The schema guarantees one of each; guard so the compiler agrees.
      if (!on || !off) return null;
      return (
        <Switch
          label={group.label}
          checked={selectedOptionId === on.id}
          hint={formatPriceDelta(on.priceDelta - off.priceDelta, currency)}
          onChange={(checked) => onSelect(checked ? on.id : off.id)}
        />
      );
    }
  }
}
