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
  Requirement,
} from '@/products/schema';

/** Selected option id per option-group id. */
export type Selections = Readonly<Record<string, string>>;

export interface NodeScale {
  axis: Axis;
  scale: number;
}

/** Accumulated pose offset for one node: Euler degrees and a local-space translation. */
export interface NodePose {
  rotation: [number, number, number];
  position: [number, number, number];
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
  /** Pose offset per node name, applied on top of the authored transform. */
  nodePoses: ReadonlyMap<string, NodePose>;
  priceLines: readonly PriceLine[];
  totalPrice: number;
}

/** Whether a group can be interacted with, and why not if it cannot. */
export interface GroupAvailability {
  available: boolean;
  /** Short explanation for the UI, e.g. "Requires 4K screen". */
  hint?: string;
  /** Options inside an available group whose own requirements do not hold. */
  unavailableOptionIds: ReadonlySet<string>;
}

export function defaultSelections(product: ProductDefinition): Selections {
  return Object.fromEntries(product.optionGroups.map((group) => [group.id, group.defaultOptionId]));
}

/** A requirement holds when the referenced group currently has one of the listed options. */
function requirementHolds(requirement: Requirement, selections: Selections): boolean {
  const selected = selections[requirement.groupId];
  return selected !== undefined && requirement.optionIds.includes(selected);
}

export function requirementsHold(
  requires: readonly Requirement[],
  selections: Selections,
): boolean {
  return requires.every((requirement) => requirementHolds(requirement, selections));
}

/**
 * Drops unknown groups/options, fills in defaults for missing ones and resets any
 * group or option whose requirements no longer hold. Groups are visited in
 * declaration order, which the schema guarantees is dependency order.
 */
export function sanitizeSelections(product: ProductDefinition, selections: Selections): Selections {
  const resolved: Record<string, string> = {};
  for (const group of product.optionGroups) {
    const candidate = group.options.find((option) => option.id === selections[group.id]);
    const selectable =
      candidate !== undefined &&
      requirementsHold(group.requires, resolved) &&
      requirementsHold(candidate.requires, resolved);
    resolved[group.id] = selectable ? candidate.id : group.defaultOptionId;
  }
  return resolved;
}

function describeRequirement(product: ProductDefinition, requirement: Requirement): string {
  const group = product.optionGroups.find((candidate) => candidate.id === requirement.groupId);
  if (!group) return `Requires ${requirement.groupId}`;
  const labels = requirement.optionIds.map(
    (id) => group.options.find((option) => option.id === id)?.label ?? id,
  );
  // "Requires 4K screen" reads better than "Requires 4K screen: Included" for a switch.
  const isOnState =
    group.type === 'toggle' &&
    requirement.optionIds.length === 1 &&
    group.options.find((option) => option.visible)?.id === requirement.optionIds[0];
  return isOnState ? `Requires ${group.label}` : `Requires ${group.label}: ${labels.join(' or ')}`;
}

/** Evaluates `requires` for every group and option against sanitised selections. */
export function resolveAvailability(
  product: ProductDefinition,
  selections: Selections,
): ReadonlyMap<string, GroupAvailability> {
  const failing = (requires: readonly Requirement[]) =>
    requires.find((requirement) => !requirementHolds(requirement, selections));

  return new Map(
    product.optionGroups.map((group) => {
      const defaultOption = group.options.find((option) => option.id === group.defaultOptionId);
      const blocker = failing(group.requires) ?? failing(defaultOption?.requires ?? []);
      const unavailableOptionIds = new Set(
        group.options.filter((option) => failing(option.requires)).map((option) => option.id),
      );
      const availability: GroupAvailability = blocker
        ? { available: false, hint: describeRequirement(product, blocker), unavailableOptionIds }
        : { available: true, unavailableOptionIds };
      return [group.id, availability];
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

const addVec = (
  a: readonly [number, number, number],
  b: readonly [number, number, number] | undefined,
): [number, number, number] => (b ? [a[0] + b[0], a[1] + b[1], a[2] + b[2]] : [a[0], a[1], a[2]]);

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
  const nodePoses = new Map<string, NodePose>();
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
      case 'pose': {
        const chosen = selectedOption(group, selections);
        // Several pose groups may move the same node; their offsets add up.
        for (const transform of chosen.transforms) {
          for (const node of transform.nodes) {
            const current = nodePoses.get(node) ?? { rotation: [0, 0, 0], position: [0, 0, 0] };
            nodePoses.set(node, {
              rotation: addVec(current.rotation, transform.rotation),
              position: addVec(current.position, transform.position),
            });
          }
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
  return { hiddenNodes, materialAssignments, nodeScales, nodePoses, priceLines, totalPrice };
}
