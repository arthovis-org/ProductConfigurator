/**
 * Product definition schema.
 *
 * A product is a glTF model plus a declarative description of which nodes can be
 * shown, hidden, re-materialised or resized. The UI and the 3D viewer are driven
 * entirely by this data, so adding a product never requires UI changes.
 */
import { z } from 'zod';

const vec3 = z.tuple([z.number(), z.number(), z.number()]);

const identifier = z
  .string()
  .min(1)
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'use lowercase letters, digits and dashes');

export const materialPresetSchema = z.object({
  /** CSS-style hex colour, e.g. `#c9a27a`. */
  color: z.string().regex(/^#([0-9a-f]{6})$/i, 'expected a #rrggbb colour'),
  roughness: z.number().min(0).max(1).default(0.5),
  metalness: z.number().min(0).max(1).default(0),
  /** Optional texture maps, as URLs relative to `public/`. */
  textureMaps: z
    .object({
      map: z.string().optional(),
      normalMap: z.string().optional(),
      roughnessMap: z.string().optional(),
      metalnessMap: z.string().optional(),
    })
    .optional(),
});

export const partDefinitionSchema = z.object({
  id: identifier,
  /** Human-readable name shown in the UI where relevant. */
  label: z.string().min(1),
  /** glTF node names that make up this part. Children of a node are included. */
  nodes: z.array(z.string().min(1)).min(1),
  /** Optional grouping hint for the UI, e.g. "Base" or "Accessories". */
  group: z.string().optional(),
  /** Parts that may be hidden (by a toggle group) must be flagged optional. */
  optional: z.boolean().default(false),
});

const optionBase = z.object({
  id: identifier,
  label: z.string().min(1),
  /** Price difference relative to `basePrice`, in the product currency. */
  priceDelta: z.number().default(0),
  /** Optional image URL for the option (falls back to a colour swatch for materials). */
  thumbnail: z.string().optional(),
});

const groupBase = z.object({
  id: identifier,
  label: z.string().min(1),
  description: z.string().optional(),
  defaultOptionId: identifier,
});

/** Shows the option's parts and hides every other part referenced by the group. */
export const variantGroupSchema = groupBase.extend({
  type: z.literal('variant'),
  options: z.array(optionBase.extend({ parts: z.array(identifier).min(1) })).min(1),
});

/** Applies a material preset to the target parts. */
export const materialGroupSchema = groupBase.extend({
  type: z.literal('material'),
  targets: z.array(identifier).min(1),
  options: z.array(optionBase.extend({ material: materialPresetSchema })).min(1),
});

/** Shows or hides a single optional part. Exactly one option must be `visible: false`. */
export const toggleGroupSchema = groupBase.extend({
  type: z.literal('toggle'),
  part: identifier,
  options: z.array(optionBase.extend({ visible: z.boolean() })).length(2),
});

/**
 * Scales the target parts along one axis. This is a simple non-uniform scale:
 * it stretches geometry, so it suits flat slabs (a desk top) but not detailed
 * parts. Proper parametric resizing would need separate meshes per size.
 */
export const dimensionGroupSchema = groupBase.extend({
  type: z.literal('dimension'),
  targets: z.array(identifier).min(1),
  axis: z.enum(['x', 'y', 'z']),
  unit: z.string().min(1),
  options: z
    .array(optionBase.extend({ value: z.number().positive(), scale: z.number().positive() }))
    .min(1),
});

export const optionGroupSchema = z.discriminatedUnion('type', [
  variantGroupSchema,
  materialGroupSchema,
  toggleGroupSchema,
  dimensionGroupSchema,
]);

export const productDefinitionSchema = z
  .object({
    id: identifier,
    name: z.string().min(1),
    description: z.string().min(1),
    model: z.object({
      /** URL relative to `public/`, e.g. `/models/smart-desk.glb`. */
      src: z.string().min(1),
      scale: z.number().positive().default(1),
      position: vec3.default([0, 0, 0]),
      /** Euler rotation in radians. */
      rotation: vec3.default([0, 0, 0]),
    }),
    basePrice: z.number().nonnegative(),
    /** ISO 4217 code, e.g. `EUR`. */
    currency: z.string().length(3),
    parts: z.array(partDefinitionSchema).min(1),
    optionGroups: z.array(optionGroupSchema).min(1),
  })
  .superRefine((product, ctx) => {
    const partIds = new Set(product.parts.map((part) => part.id));
    const optionalParts = new Set(product.parts.filter((p) => p.optional).map((p) => p.id));
    const groupIds = new Set<string>();

    const requirePart = (partId: string, path: (string | number)[]) => {
      if (!partIds.has(partId)) {
        ctx.addIssue({ code: 'custom', path, message: `unknown part "${partId}"` });
      }
    };

    product.optionGroups.forEach((group, groupIndex) => {
      const path = ['optionGroups', groupIndex];
      if (groupIds.has(group.id)) {
        ctx.addIssue({ code: 'custom', path, message: `duplicate group id "${group.id}"` });
      }
      groupIds.add(group.id);

      if (!group.options.some((option) => option.id === group.defaultOptionId)) {
        ctx.addIssue({
          code: 'custom',
          path: [...path, 'defaultOptionId'],
          message: `"${group.defaultOptionId}" is not one of the group's options`,
        });
      }

      switch (group.type) {
        case 'variant':
          group.options.forEach((option, i) =>
            option.parts.forEach((partId, j) =>
              requirePart(partId, [...path, 'options', i, 'parts', j]),
            ),
          );
          break;
        case 'material':
        case 'dimension':
          group.targets.forEach((partId, i) => requirePart(partId, [...path, 'targets', i]));
          break;
        case 'toggle':
          requirePart(group.part, [...path, 'part']);
          if (partIds.has(group.part) && !optionalParts.has(group.part)) {
            ctx.addIssue({
              code: 'custom',
              path: [...path, 'part'],
              message: `part "${group.part}" must be marked optional to be toggled`,
            });
          }
          if (group.options.filter((option) => option.visible).length !== 1) {
            ctx.addIssue({
              code: 'custom',
              path: [...path, 'options'],
              message: 'a toggle needs exactly one visible and one hidden option',
            });
          }
          break;
      }
    });
  });

/** Input shape: what authors write in a definition file (defaults may be omitted). */
export type ProductDefinitionInput = z.input<typeof productDefinitionSchema>;
/** Output shape: what the app consumes (all defaults applied). */
export type ProductDefinition = z.output<typeof productDefinitionSchema>;
export type PartDefinition = z.output<typeof partDefinitionSchema>;
export type MaterialPreset = z.output<typeof materialPresetSchema>;
export type OptionGroup = z.output<typeof optionGroupSchema>;
export type VariantGroup = z.output<typeof variantGroupSchema>;
export type MaterialGroup = z.output<typeof materialGroupSchema>;
export type ToggleGroup = z.output<typeof toggleGroupSchema>;
export type DimensionGroup = z.output<typeof dimensionGroupSchema>;
export type Option = OptionGroup['options'][number];
export type Axis = DimensionGroup['axis'];

/** Parses and validates a definition, throwing a readable error on failure. */
export function parseProductDefinition(input: ProductDefinitionInput): ProductDefinition {
  const result = productDefinitionSchema.safeParse(input);
  if (!result.success) {
    const id = typeof input.id === 'string' ? input.id : '<unknown>';
    throw new Error(`Invalid product definition "${id}":\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
