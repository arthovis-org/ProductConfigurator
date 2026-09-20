/**
 * Pure functions that turn (product definition + selections) into what the
 * viewer and UI need. Kept free of React and zustand so they are easy to test.
 */
import type {
  Axis,
  MaterialPreset,
  Option,
  OptionGroup,
  ProductDefinition,
} from '@/products/schema';

/** Selected option id per option-group id. */
export type Selections = Readonly<Record<string, string>>;

export interface NodeScale {
  axis: Axis;
  scale: number;
}

export interface PriceLine {
  groupId: string;
  groupLabel: string;
  optionLabel: string;
  priceDelta: number;
}

/** Everything derived from the current selections, resolved to glTF node names. */
export interface ResolvedConfiguration {
  /** Node names that must be hidden. Anything not listed stays visible. */
  hiddenNodes: ReadonlySet<string>;
  /** Material preset per node name. */
  materialAssignments: ReadonlyMap<string, MaterialPreset>;
  /** Non-uniform scale per node name. */
  nodeScales: ReadonlyMap<string, NodeScale>;
  priceLines: readonly PriceLine[];
  totalPrice: number;
}

export function defaultSelections(product: ProductDefinition): Selections {
  return Object.fromEntries(product.optionGroups.map((group) => [group.id, group.defaultOptionId]));
}

/** Drops unknown groups/options and fills in defaults for missing ones. */
export function sanitizeSelections(product: ProductDefinition, selections: Selections): Selections {
  return Object.fromEntries(
    product.optionGroups.map((group) => {
      const selected = selections[group.id];
      const valid = group.options.some((option) => option.id === selected);
      return [group.id, valid && selected ? selected : group.defaultOptionId];
    }),
  );
}

/** Label shown for a selected option; dimensions carry their unit. */
export function optionDisplayLabel(group: OptionGroup, option: Option): string {
  return group.type === 'dimension' ? `${option.label} ${group.unit}` : option.label;
}

export function selectedOption<G extends OptionGroup>(
  group: G,
  selections: Selections,
): G['options'][number] {
  const selectedId = selections[group.id] ?? group.defaultOptionId;
  const option =
    group.options.find((candidate) => candidate.id === selectedId) ??
    group.options.find((candidate) => candidate.id === group.defaultOptionId);
  // The schema guarantees that defaultOptionId exists, so this only fails on a corrupt store.
  if (!option) throw new Error(`Option group "${group.id}" has no option "${selectedId}"`);
  return option;
}

export function resolveConfiguration(
  product: ProductDefinition,
  selections: Selections,
): ResolvedConfiguration {
  const nodesOf = new Map(product.parts.map((part) => [part.id, part.nodes]));
  const nodesForParts = (partIds: readonly string[]) =>
    partIds.flatMap((partId) => nodesOf.get(partId) ?? []);

  const hiddenNodes = new Set<string>();
  const materialAssignments = new Map<string, MaterialPreset>();
  const nodeScales = new Map<string, NodeScale>();
  const priceLines: PriceLine[] = [];

  for (const group of product.optionGroups) {
    let option: Option;
    switch (group.type) {
      case 'variant': {
        const chosen = selectedOption(group, selections);
        const shown = new Set(chosen.parts);
        const alternatives = group.options.flatMap((o) => o.parts).filter((p) => !shown.has(p));
        for (const node of nodesForParts(alternatives)) hiddenNodes.add(node);
        option = chosen;
        break;
      }
      case 'material': {
        const chosen = selectedOption(group, selections);
        for (const node of nodesForParts(group.targets))
          materialAssignments.set(node, chosen.material);
        option = chosen;
        break;
      }
      case 'toggle': {
        const chosen = selectedOption(group, selections);
        if (!chosen.visible) for (const node of nodesForParts([group.part])) hiddenNodes.add(node);
        option = chosen;
        break;
      }
      case 'dimension': {
        const chosen = selectedOption(group, selections);
        for (const node of nodesForParts(group.targets)) {
          nodeScales.set(node, { axis: group.axis, scale: chosen.scale });
        }
        option = chosen;
        break;
      }
    }

    if (option.priceDelta !== 0) {
      priceLines.push({
        groupId: group.id,
        groupLabel: group.label,
        optionLabel: optionDisplayLabel(group, option),
        priceDelta: option.priceDelta,
      });
    }
  }

  const totalPrice = priceLines.reduce((sum, line) => sum + line.priceDelta, product.basePrice);
  return { hiddenNodes, materialAssignments, nodeScales, priceLines, totalPrice };
}
