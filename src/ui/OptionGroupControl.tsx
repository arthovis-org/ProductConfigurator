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
  /** The whole group is unavailable (its `requires` do not hold). */
  disabled?: boolean;
  /** Individual options whose own `requires` do not hold. */
  disabledOptionIds?: ReadonlySet<string> | undefined;
  onSelect: (optionId: string) => void;
}

/** Picks the right input for an option group's type. */
export function OptionGroupControl({
  group,
  selectedOptionId,
  disabled = false,
  disabledOptionIds,
  onSelect,
}: OptionGroupControlProps) {
  const { currency } = useProduct();
  const isDisabled = (optionId: string) => disabled || (disabledOptionIds?.has(optionId) ?? false);

  switch (group.type) {
    case 'material':
      return (
        <MaterialSwatches
          options={group.options}
          selectedId={selectedOptionId}
          onSelect={onSelect}
          currency={currency}
          isDisabled={isDisabled}
        />
      );
    case 'variant':
    case 'dimension':
    case 'pose':
      return (
        <SegmentedControl
          items={group.options.map((option) => ({
            id: option.id,
            label: optionDisplayLabel(group, option),
            hint: formatPriceDelta(option.priceDelta, currency),
            disabled: isDisabled(option.id),
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
          disabled={isDisabled(selectedOptionId === on.id ? off.id : on.id)}
          onChange={(checked) => onSelect(checked ? on.id : off.id)}
        />
      );
    }
  }
}
