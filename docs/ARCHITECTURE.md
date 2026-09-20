# Architecture

The app is a thin pipeline from a declarative product definition to pixels. Nothing in the UI
or the viewer knows about desks, legs or finishes; they only know about parts, option groups and
node names.

```
 definitions/*.ts ──▶ products/index.ts ──▶ state/configuratorStore.ts ──▶ state/derive.ts
  (authored data)      (zod-validated          (productId + selections,        (pure: selections →
                        registry)               URL serialize/hydrate)          hidden nodes,
                                                                                material presets,
                                                                                node scales, price)
                                                        │                              │
                                                        ▼                              ▼
                                               ui/ConfiguratorPanel            viewer/ProductModel
                                               (one control per group,        (useGLTF, applies
                                                writes selections)             visibility / scale /
                                                                               cloned materials)
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
gets, which nodes to scale, and the price breakdown. `useResolvedConfiguration()` memoises this
per (product, selections) pair. `urlState.ts` encodes and decodes the query string used for
sharing; `App.tsx` hydrates from it on load and mirrors every change with `history.replaceState`.

**Viewer (`src/viewer`)**
`Scene.tsx` owns the Canvas, lighting (`StudioEnvironment`, a procedural light-former
environment so there is no runtime CDN dependency), contact shadows, orbit controls and the
`Bounds` framing. `ProductModel.tsx` loads the glTF, resolves each part's node names once and
applies visibility and axis scale in an effect. Material presets are applied by
`PartAppearance`, one instance per node, which clones each mesh's original material so shared
glTF materials never leak between parts and restores the original on cleanup. Textured presets
suspend while their maps load. `ViewerErrorBoundary` keeps a broken model from taking down the
page.

**UI (`src/ui`)**
`ConfiguratorPanel` maps option groups to `OptionGroupControl`, which switches on `group.type`:
material -> `MaterialSwatches`, variant and dimension -> `SegmentedControl`, toggle -> `Switch`.
Controls are dumb: they receive items and a selected id and call back with an option id. Prices
are formatted with `Intl.NumberFormat` in the product's currency.

## Adding an option type

1. Add a group schema in `schema.ts` and include it in the `optionGroupSchema` union.
2. Handle the new `type` in `resolveConfiguration` (what does it do to nodes?).
3. Add a case in `OptionGroupControl` (what does the user click?).
4. If it needs new viewer behaviour, extend `ProductModel` or add a sibling of `PartAppearance`.

Everything else (pricing, URL state, reset, validation) works without changes.
