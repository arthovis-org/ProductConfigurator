/**
 * Product definition schema.
 *
 * A product is a glTF model plus a declarative description of which nodes can be
 * shown, hidden, re-materialised, resized or posed. The UI and the 3D viewer are
 * driven entirely by this data, so adding a product never requires UI changes.
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
  /** Optional texture maps under `public/`; wrap each URL in `publicAsset()`. */
  textureMaps: z
    .object({
      map: z.string().optional(),
      normalMap: z.string().optional(),
      roughnessMap: z.string().optional(),
      metalnessMap: z.string().optional(),
    })
    .optional(),
});

/** Layouts a screen can show; `layoutPanes()` in `src/screens/layouts.ts` defines their panes. */
export const LAYOUT_IDS = [
  'single',
  'two-up',
  'three-column',
  'grid-2x2',
  'sidebar-main',
  'pip',
  'stack',
] as const;
/** Workflow presets; each fills the panes with abstract app mockups (`src/screens/workflows.ts`). */
export const WORKFLOW_IDS = ['design', 'trading', 'coding', 'video', 'writing'] as const;
/** Abstract desktop chrome styles (`src/screens/os.ts`). */
export const OS_IDS = ['mac', 'windows', 'linux', 'chromeos'] as const;

/** What a screen shows. Screen groups patch these facets; the part's declaration sets defaults. */
export const screenContentSchema = z.object({
  layout: z.enum(LAYOUT_IDS).default('single'),
  workflow: z.enum(WORKFLOW_IDS).default('design'),
  os: z.enum(OS_IDS).default('mac'),
});

/**
 * The facets a screen option changes; unset facets keep their value. Written out instead
 * of `screenContentSchema.partial()` because zod still applies field defaults inside a
 * partial, which would make every option reset the other facets.
 */
export const screenContentPatchSchema = z.object({
  layout: z.enum(LAYOUT_IDS).optional(),
  workflow: z.enum(WORKFLOW_IDS).optional(),
  os: z.enum(OS_IDS).optional(),
});

/**
 * A display surface on a part. `node` is the glTF node holding the panel mesh: a thin box or
 * plane whose texture U runs along local +X and V along local +Y (vertical panel facing +Z)
 * or local -Z (horizontal panel facing +Y). The pixel size only sets the aspect ratio and the
 * texture resolution; `kind: 'touch'` swaps window mockups for touch-friendly controls.
 */
export const screenDefinitionSchema = z.object({
  node: z.string().min(1),
  widthPx: z.number().int().positive(),
  heightPx: z.number().int().positive(),
  kind: z.enum(['display', 'touch']).default('display'),
  content: screenContentSchema.prefault({}),
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
  /**
   * A part declared earlier whose nodes contain this part's nodes, e.g. one screen size under
   * the touch screen assembly. The part counts as hidden whenever its parent is hidden.
   */
  partOf: identifier.optional(),
  /** Display surfaces on this part that render in-screen content. */
  screens: z.array(screenDefinitionSchema).default([]),
});

/**
 * A dependency on another group's selection: holds when that group's selected
 * option is one of `optionIds`. The referenced group must be declared earlier in
 * `optionGroups`, which rules out cycles and lets selections resolve in one pass.
 */
export const requirementSchema = z.object({
  groupId: identifier,
  optionIds: z.array(identifier).min(1),
});

const optionBase = z.object({
  id: identifier,
  label: z.string().min(1),
  /** Price difference relative to `basePrice`, in the product currency. */
  priceDelta: z.number().default(0),
  /** Optional image URL for the option (falls back to a colour swatch for materials). */
  thumbnail: z.string().optional(),
  /** The option can only be selected while every requirement holds. */
  requires: z.array(requirementSchema).default([]),
});

const groupBase = z.object({
  id: identifier,
  label: z.string().min(1),
  description: z.string().optional(),
  defaultOptionId: identifier,
  /** The group is only available while every requirement holds; otherwise it resets to its default. */
  requires: z.array(requirementSchema).default([]),
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

/** A rigid transform applied to glTF nodes on top of their authored transform. */
export const poseTransformSchema = z.object({
  nodes: z.array(z.string().min(1)).min(1),
  /** Euler rotation in degrees (XYZ order) around the node's own origin. */
  rotation: vec3.optional(),
  /** Offset in the node's local units (metres for a correctly exported model). */
  position: vec3.optional(),
});

/**
 * Moves or rotates nodes between authored poses, e.g. a hinge angle or a lift
 * height. Rotation happens around the node's origin, so model hinged parts as a
 * child of a pivot node placed on the hinge line and pose the pivot.
 */
export const poseGroupSchema = groupBase.extend({
  type: z.literal('pose'),
  options: z
    .array(optionBase.extend({ transforms: z.array(poseTransformSchema).default([]) }))
    .min(1),
});

/**
 * Sets one or more content facets (layout, workflow, OS) on the screens of the target parts.
 * Facets from several groups merge in declaration order, so one group can pick the OS for every
 * screen while another chooses the layout of a single screen. The group is unavailable while
 * every target part is hidden.
 */
export const screenGroupSchema = groupBase.extend({
  type: z.literal('screen'),
  targets: z.array(identifier).min(1),
  options: z.array(optionBase.extend({ content: screenContentPatchSchema })).min(1),
});

export const optionGroupSchema = z.discriminatedUnion('type', [
  variantGroupSchema,
  materialGroupSchema,
  toggleGroupSchema,
  dimensionGroupSchema,
  poseGroupSchema,
  screenGroupSchema,
]);

export const productDefinitionSchema = z
  .object({
    id: identifier,
    name: z.string().min(1),
    description: z.string().min(1),
    model: z.object({
      /** URL of a file under `public/`, e.g. `publicAsset('models/smart-desk.glb')`. */
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
    const screenParts = new Set(product.parts.filter((p) => p.screens.length).map((p) => p.id));
    /** Groups declared so far, so requirements can only point backwards. */
    const declaredGroups = new Map<string, z.output<typeof optionGroupSchema>>();

    const requirePart = (partId: string, path: (string | number)[]) => {
      if (!partIds.has(partId)) {
        ctx.addIssue({ code: 'custom', path, message: `unknown part "${partId}"` });
      }
    };

    product.parts.forEach((part, index) => {
      if (part.partOf === undefined) return;
      const parentIndex = product.parts.findIndex((candidate) => candidate.id === part.partOf);
      if (parentIndex === -1 || parentIndex >= index) {
        ctx.addIssue({
          code: 'custom',
          path: ['parts', index, 'partOf'],
          message: `"${part.partOf}" must be a part declared earlier`,
        });
      }
    });

    const checkRequirements = (
      requires: z.output<typeof requirementSchema>[],
      path: (string | number)[],
    ) => {
      requires.forEach((requirement, i) => {
        const target = declaredGroups.get(requirement.groupId);
        if (!target) {
          ctx.addIssue({
            code: 'custom',
            path: [...path, i, 'groupId'],
            message: `"${requirement.groupId}" must be an option group declared earlier`,
          });
          return;
        }
        requirement.optionIds.forEach((optionId, j) => {
          if (!target.options.some((option) => option.id === optionId)) {
            ctx.addIssue({
              code: 'custom',
              path: [...path, i, 'optionIds', j],
              message: `group "${target.id}" has no option "${optionId}"`,
            });
          }
        });
      });
    };

    product.optionGroups.forEach((group, groupIndex) => {
      const path = ['optionGroups', groupIndex];
      if (declaredGroups.has(group.id)) {
        ctx.addIssue({ code: 'custom', path, message: `duplicate group id "${group.id}"` });
      }

      if (!group.options.some((option) => option.id === group.defaultOptionId)) {
        ctx.addIssue({
          code: 'custom',
          path: [...path, 'defaultOptionId'],
          message: `"${group.defaultOptionId}" is not one of the group's options`,
        });
      }

      checkRequirements(group.requires, [...path, 'requires']);
      group.options.forEach((option, i) =>
        checkRequirements(option.requires, [...path, 'options', i, 'requires']),
      );

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
        case 'screen':
          group.targets.forEach((partId, i) => {
            requirePart(partId, [...path, 'targets', i]);
            if (partIds.has(partId) && !screenParts.has(partId)) {
              ctx.addIssue({
                code: 'custom',
                path: [...path, 'targets', i],
                message: `part "${partId}" declares no screens`,
              });
            }
          });
          break;
        case 'pose':
          break;
      }

      declaredGroups.set(group.id, group);
    });
  });

/** Input shape: what authors write in a definition file (defaults may be omitted). */
export type ProductDefinitionInput = z.input<typeof productDefinitionSchema>;
/** Output shape: what the app consumes (all defaults applied). */
export type ProductDefinition = z.output<typeof productDefinitionSchema>;
export type PartDefinition = z.output<typeof partDefinitionSchema>;
export type MaterialPreset = z.output<typeof materialPresetSchema>;
export type Requirement = z.output<typeof requirementSchema>;
export type PoseTransform = z.output<typeof poseTransformSchema>;
export type OptionGroup = z.output<typeof optionGroupSchema>;
export type VariantGroup = z.output<typeof variantGroupSchema>;
export type MaterialGroup = z.output<typeof materialGroupSchema>;
export type ToggleGroup = z.output<typeof toggleGroupSchema>;
export type DimensionGroup = z.output<typeof dimensionGroupSchema>;
export type PoseGroup = z.output<typeof poseGroupSchema>;
export type ScreenGroup = z.output<typeof screenGroupSchema>;
export type ScreenDefinition = z.output<typeof screenDefinitionSchema>;
export type ScreenContent = z.output<typeof screenContentSchema>;
export type LayoutId = ScreenContent['layout'];
export type WorkflowId = ScreenContent['workflow'];
export type OsId = ScreenContent['os'];
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
