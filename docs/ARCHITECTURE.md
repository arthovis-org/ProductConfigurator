# Architecture

The app is a thin pipeline from a declarative product definition to pixels. Nothing in the UI
or the viewer knows about desks, legs or finishes; they only know about parts, option groups and
node names.

```
 definitions/*.ts ──▶ products/index.ts ──▶ state/configuratorStore.ts ──▶ state/derive.ts
  (authored data)      (zod-validated          (productId + selections,        (pure: selections →
                        registry)               URL serialize/hydrate)          hidden nodes,
                                                                                material presets,
                                                                                node scales, poses,
                                                                                availability, price)
                                                        │                              │
                                                        ▼                              ▼
                                               ui/ConfiguratorPanel            viewer/ProductModel
                                               (one control per group,        (useGLTF, applies
                                                disabled while `requires`      visibility / scale /
                                                fail, writes selections)       pose / cloned materials)
```

## Layers

**Definition (`src/products`)**
`schema.ts` holds the zod schema and the exported TypeScript types. `ProductDefinitionInput` is
what authors write (defaults optional); `ProductDefinition` is the parsed output the rest of the
app consumes. `index.ts` parses every definition once at import time and exposes `products`,
`productList` and `getProduct()` with a first-product fallback.

**State (`src/state`)**
The zustand store keeps only primitive state: `productId` and `selections`
(`groupId -> optionId`). Everything else is derived. `derive.ts` contains pure functions, most
importantly `resolveConfiguration(product, selections)`, which walks the option groups once and
produces node-level instructions: which node names to hide, which material preset each node
gets, which nodes to scale, which pose offset (Euler degrees + translation) each node gets, and
the price breakdown. `useResolvedConfiguration()` memoises this per (product, selections) pair.

Dependencies between groups (`requires`) are resolved in `sanitizeSelections`, which every store
write goes through. It visits groups in declaration order (the schema only allows a requirement
to point at an earlier group, so one pass suffices) and resets a group to its default whenever
the group's or the selected option's requirements fail against the selections resolved so far.
`resolveAvailability` reports the same facts to the UI as `{ available, hint,
unavailableOptionIds }` per group, so the panel can grey out a group with "Requires 4K screen"
instead of silently ignoring clicks. `urlState.ts` encodes and decodes the query string used for
sharing; `App.tsx` hydrates from it on load and mirrors every change with `history.replaceState`.

**Viewer (`src/viewer`)**
`Scene.tsx` owns the Canvas, lighting (`StudioEnvironment`, a procedural light-former
environment so there is no runtime CDN dependency), contact shadows, orbit controls and the
`Bounds` framing. `ProductModel.tsx` loads the glTF, resolves every referenced node name once
(`getObjectByName` searches the whole hierarchy, so definitions may target nested nodes) and
remembers each node's authored scale, position and rotation. One effect then applies visibility,
axis scale and pose offsets relative to those authored values; because they are plain scene-graph
properties, hiding or moving a parent takes its children with it, which is how a raised
`TopAssembly` carries the screens and trays. The camera is re-framed when the product changes or
a pose moves geometry, but not when parts are merely shown or hidden. Material presets are applied by
`PartAppearance`, one instance per node, which clones each mesh's original material so shared
glTF materials never leak between parts and restores the original on cleanup. Textured presets
suspend while their maps load. `ViewerErrorBoundary` keeps a broken model from taking down the
page.

**UI (`src/ui`)**
`ConfiguratorPanel` maps option groups to `OptionGroupControl`, which switches on `group.type`:
material -> `MaterialSwatches`, variant, dimension and pose -> `SegmentedControl`,
toggle -> `Switch`. Controls are dumb: they receive items, a selected id and disabled flags and
call back with an option id. A group whose requirements fail is rendered dimmed with the hint
from `resolveAvailability` in place of its selected value. `Header` hosts the product switcher,
which calls `selectProduct` (resetting selections to that product's defaults). Prices are
formatted with `Intl.NumberFormat` in the product's currency.

## Model structure rules

- Every node a definition refers to (part nodes and pose targets) must exist by name; children
  of a referenced node are included implicitly.
- Nest what moves together: anything attached to a posed node must be its descendant.
- A pose rotates around the node's origin, so hinged parts hang from a pivot node on the hinge
  line and the definition poses the pivot. One pose option may list several transforms, so a
  single "Drafting" preset can turn each screen size's pivot by its own angle; hidden variants
  are posed too, which is harmless.
- Alternative variants live side by side in the file; the configurator hides the unselected ones.

## Adding an option type

1. Add a group schema in `schema.ts` and include it in the `optionGroupSchema` union.
2. Handle the new `type` in `resolveConfiguration` (what does it do to nodes?).
3. Add a case in `OptionGroupControl` (what does the user click?).
4. If it needs new viewer behaviour, extend `ProductModel` or add a sibling of `PartAppearance`.

Everything else (pricing, URL state, reset, validation) works without changes.
