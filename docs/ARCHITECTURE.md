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
                                                fail, writes selections;       pose / cloned materials;
                                                Screens section + 3D toggle)   ScreenSurface textures,
                                                                               SpatialWorkspace cards)
                                                                                       ▲
                                                                                       │
                                                                               screens/renderScreen
                                                                               (canvas: OS chrome,
                                                                                layouts, app mockups)
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

`screen` groups patch the `layout`/`workflow`/`os` facets of the screens on their target
parts, later groups overriding earlier ones facet by facet, and the result is exposed per panel
node as `screens`. `resolveHiddenParts` (variants not selected, toggles off, plus `partOf`
children of hidden parts) also feeds `resolveAvailability`, which disables a screen group while
every target part is hidden.

Dependencies between groups (`requires`) are resolved in `sanitizeSelections`, which every store
write goes through. It visits groups in declaration order (the schema only allows a requirement
to point at an earlier group, so one pass suffices) and resets a group to its default whenever
the group's or the selected option's requirements fail against the selections resolved so far.
`resolveAvailability` reports the same facts to the UI as `{ available, hint,
unavailableOptionIds }` per group, so the panel can grey out a group with "Requires 4K screen"
instead of silently ignoring clicks. `urlState.ts` encodes and decodes the query string used for
sharing; `App.tsx` hydrates from it on load and mirrors every change with `history.replaceState`.

**Screens (`src/screens`)**
Pure canvas code with no React or Three.js. `renderScreen(canvas, spec)` draws a whole display
from a `ScreenSpec` (pixel size, `display`/`touch` kind and the `layout`/`workflow`/`os`
facets): the OS style's wallpaper (`os.ts`), one window per pane of the layout (`layouts.ts`
returns normalised pane rects inside the OS work area), an abstract app mockup in each window
(`apps.ts`, chosen by `workflows.ts` in priority order with the main pane first) and the dock
or bar on top. Touch screens get a touch shell with the workflow's touch apps instead of
windows. The same module renders the pieces the 3D transition needs: single panes as cards,
the dark spatial backdrop and the touch control surface. All "text" is drawn as bars and every
colour comes from `palette.ts`, so nothing resembles a real product's UI. `internSpec()` returns
one shared object per distinct spec so React memos keyed on it only invalidate when the content
changes.

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

Screens are handled by two siblings of `PartAppearance`. `ProductModel` lists the screens whose
panel node is on the model (walking up the parents against `hiddenNodes`) and measures each
panel with `measurePanel`, which reads the mesh's bounding box and takes its thinnest axis as
the normal, yielding a `u`/`v`/`n` basis that matches the texture orientation. `ScreenSurface`
draws the content once per spec into a `CanvasTexture` (sRGB, anisotropic) and swaps the panel
material for one that uses it as both colour and emissive map, so the display reads as lit.
`SpatialWorkspace` implements the flat -> 3D transition: a `useFrame` at priority -1 moves a
progress value towards the target over 1.5 s and calls `invalidate()` while it is running, so
the on-demand frame loop keeps going only during the animation. Per screen it portals into the
panel node (`createPortal`) a backdrop plane whose opacity follows the eased progress (the dark
spatial background, or the control surface for touch screens) and one card per pane: a plane
with that pane rendered as a rounded window, plus an additive glow plane behind it. Cards
interpolate from their place on the screen to a lifted, spread and tilted pose in the panel's
local frame, so they follow the desk height and hinge angle for free. Everything unmounts once
the reverse animation reaches zero. The `enabled` flag lives in `state/spatialStore.ts`; it is
view state, not configuration, so it is not shared in the URL.

**UI (`src/ui`)**
`ConfiguratorPanel` renders one `OptionGroupSection` per group; the section maps the group to
`OptionGroupControl`, which switches on `group.type`: material -> `MaterialSwatches`, variant,
dimension, pose and screen -> `SegmentedControl`, toggle -> `Switch`. Screen groups are gathered
into `ScreensSection`, placed where the first of them is declared, together with the button that
toggles the spatial workspace; both are disabled while no screen group is available. Controls are dumb: they receive items, a selected id and disabled flags and
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

## Adding screen content

- A new **layout** is an id in `LAYOUT_IDS` plus a case in `layoutPanes()`.
- A new **workflow** is an id in `WORKFLOW_IDS` plus an entry in `workflows.ts`; new app mockups
  are drawers in `apps.ts` (`(d, rect) => void`, using the `DrawContext`'s seeded `rand` so the
  picture is deterministic).
- A new **OS style** is an id in `OS_IDS` plus a style in `os.ts`.

The schema enums are the source of truth; TypeScript makes `workflows`, `osStyles` and
`layoutPanes` fail to compile until the new id is handled.

## Adding an option type

1. Add a group schema in `schema.ts` and include it in the `optionGroupSchema` union.
2. Handle the new `type` in `resolveConfiguration` (what does it do to nodes?).
3. Add a case in `OptionGroupControl` (what does the user click?).
4. If it needs new viewer behaviour, extend `ProductModel` or add a sibling of `PartAppearance`.

Everything else (pricing, URL state, reset, validation) works without changes.
