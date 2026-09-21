# Product Configurator

An interactive 3D product configurator for the browser. A product is a glTF model plus one
TypeScript definition file that describes which parts can be swapped, recoloured, toggled,
resized or posed, and which options depend on others. The viewer, the option panel, pricing and
shareable links are all derived from that definition, so adding a product means adding a `.glb`
and a definition, not UI code.

Two products ship today, both with procedurally generated placeholder models until the real
Blender files land: a **smart desk** (touch screen in three sizes on a front-edge drafting hinge,
4K screen on a rear-edge arm with optional side monitors, keyboard tray, sit/stand frame, and
in-screen content that shows a workflow on every display) and a **device bundle** (laptop,
gamepad-style phone, stylus, card, earbuds on a mat).

## Stack

- [Vite](https://vite.dev) + React 19 + TypeScript (strict)
- [Three.js](https://threejs.org) via [@react-three/fiber](https://r3f.docs.pmnd.rs) and
  [@react-three/drei](https://drei.docs.pmnd.rs)
- [zustand](https://zustand.docs.pmnd.rs) for configuration state
- [zod](https://zod.dev) to validate product definitions at startup
- CSS Modules with CSS variables (light and dark via `prefers-color-scheme`)

## Getting started

```bash
npm install
npm run dev          # http://localhost:5173
```

Other scripts:

| Script                    | Purpose                                              |
| ------------------------- | ---------------------------------------------------- |
| `npm run build`           | Type-check and produce a production build in `dist/` |
| `npm run preview`         | Serve the production build locally                   |
| `npm run lint`            | ESLint (type-aware)                                  |
| `npm run typecheck`       | `tsc --noEmit` for app and config                    |
| `npm run format`          | Prettier                                             |
| `npm run generate:models` | Regenerate the placeholder `.glb` files              |

Switch products with the selector in the header or open one directly with `?product=<id>`; the
current configuration is kept in the URL (`&c=group:option,...`) so the address bar is always a
shareable link.

## Project layout

```
src/
  products/
    schema.ts              zod schema + TypeScript types for a ProductDefinition
    index.ts               registry; validates every definition at import time
    definitions/           one file per product
  state/
    configuratorStore.ts   zustand store: product, selections, reset, serialize/hydrate
    spatialStore.ts        view state of the flat -> 3D workspace transition
    derive.ts              pure functions: selections -> hidden nodes, materials, scales, poses,
                           screen content, availability (requires) and price
    urlState.ts            query-string encoding of a configuration
  screens/                 canvas renderers for in-screen content: layouts, OS chrome, app
                           mockups, workflows, spatial backdrop and control surface
  viewer/                  Canvas, lighting, model loading, per-part appearance, screen
                           textures and the spatial workspace
  ui/                      option panel, controls, header, price summary, Screens section
  App.tsx                  layout and URL sync
scripts/
  gltf-builder.mjs         helper that turns Three.js geometries into named glTF nodes
  generate-smart-desk.mjs  builds public/models/smart-desk.glb and the hinge angles in
                           src/products/definitions/smart-desk.geometry.json
  generate-device-bundle.mjs  builds public/models/device-bundle.glb
public/models/             glTF binaries served as static files
docs/ARCHITECTURE.md       data flow in more detail
```

## Adding a new product

### 1. Export the model from Blender

The configurator identifies parts by **node name**, so the model's structure matters more than
its polygon count.

- One object (or empty with children) per configurable part, with a clear name such as
  `Top`, `Leg_Straight_L`, `Drawer`. Names survive the export unchanged; avoid renaming after
  the definition is written.
- Alternatives (for example two leg styles) are both present in the file as separate objects.
  The configurator hides the ones that are not selected.
- **Nest what moves together.** Parenting is the only way the configurator knows that a screen
  is attached to the top: hiding a node hides its children, and a `pose` offset on a node moves
  everything below it. Put the top and whatever is mounted on it under one empty
  (`TopAssembly > Top, TouchScreens > TouchScreenPivot_27 > TouchScreen_27, MonitorMount >
Monitor4K > SideMonitorLeft`) so that raising the top raises the screens, and leave fixed parts
  (legs) at the root.
- **Hinged parts rotate around their parent's origin.** A `pose` rotates a node around its own
  origin, so give a hinged part a parent empty placed on the hinge line (`TouchScreenPivot_<size>`
  along the front edge of the touch screen, so a positive X rotation raises the far edge like a
  drafting table) and pose that pivot.
- **Sizes are separate objects.** The touch screen ships as one recess + pivot + screen per size
  (`TouchScreenRecess_24`, `TouchScreenPivot_24`, ...) under a common `TouchScreens` empty; a
  `variant` group shows one size and a `toggle` on the parent hides them all.
- Give materials meaningful names (`Top`, `Frame`). Material presets are applied per part on
  a clone of the original material, so baked-in textures (normal maps etc.) are kept unless a
  preset overrides them.
- Apply modifiers, set scale to metres (1 Blender unit = 1 m), and place the origin at the
  centre of the footprint with the floor at `y = 0` (glTF is Y-up; the exporter converts).
- Export as **glTF Binary (.glb)** with `Include > Selected Objects` off, `Apply Modifiers`
  on, textures embedded, and compression optional (Draco is not enabled in the loader yet).
- Keep it lean: a few MB at most. Bake detail into textures rather than geometry.

Drop the file into `public/models/<product-id>.glb`.

### 2. Write the definition

Create `src/products/definitions/<product-id>.ts` and register it in `src/products/index.ts`.
An annotated example:

```ts
import { publicAsset } from '../assets';
import type { ProductDefinitionInput } from '../schema';

export const smartDesk: ProductDefinitionInput = {
  id: 'smart-desk', // lowercase, dashes; used in URLs
  name: 'Smart Desk',
  description: 'Height-adjustable desk with integrated cable management.',
  model: { src: publicAsset('models/smart-desk.glb') }, // optional: scale, position, rotation
  basePrice: 1290,
  currency: 'EUR',

  // Every configurable piece of the model. `nodes` are glTF node names;
  // children of a node are included automatically.
  parts: [
    { id: 'top', label: 'Desk top', nodes: ['Top'] },
    { id: 'legs-straight', label: 'Straight legs', nodes: ['Leg_Straight_L', 'Leg_Straight_R'] },
    { id: 'legs-t', label: 'T legs', nodes: ['Leg_T_L', 'Leg_T_R'] },
    // Parts that a toggle may hide must be marked `optional`.
    { id: 'cable-tray', label: 'Cable tray', nodes: ['CableTray'], optional: true },
  ],

  // Rendered top-to-bottom in the panel. Each type gets a matching control.
  optionGroups: [
    {
      // Segmented buttons. Shows the option's parts, hides the other options' parts.
      id: 'legs',
      type: 'variant',
      label: 'Leg style',
      defaultOptionId: 'straight',
      options: [
        { id: 'straight', label: 'Straight', parts: ['legs-straight'] },
        { id: 't', label: 'T-shape', parts: ['legs-t'], priceDelta: 90 },
      ],
    },
    {
      // Colour swatches. Applies the preset to every mesh of the target parts.
      id: 'top-finish',
      type: 'material',
      label: 'Top finish',
      targets: ['top'],
      defaultOptionId: 'oak',
      options: [
        { id: 'oak', label: 'Oak', material: { color: '#d1ad80', roughness: 0.6 } },
        {
          id: 'linoleum',
          label: 'Linoleum',
          material: {
            color: '#3a4a3f',
            roughness: 0.8,
            textureMaps: { normalMap: '/textures/lino_n.jpg' },
          },
          thumbnail: '/thumbs/linoleum.jpg', // optional image instead of a flat colour
          priceDelta: 140,
        },
      ],
    },
    {
      // A switch. Exactly two options: one `visible: true`, one `visible: false`.
      id: 'cable-tray',
      type: 'toggle',
      label: 'Cable tray',
      part: 'cable-tray',
      defaultOptionId: 'without',
      options: [
        { id: 'without', label: 'None', visible: false },
        { id: 'with', label: 'Included', visible: true, priceDelta: 49 },
      ],
    },
    {
      // Segmented buttons. Scales the target parts along one axis relative to the
      // modelled size (scale 1 = as modelled). This stretches geometry, so it suits
      // slabs like a desk top; parts that must not stretch belong in a `variant`.
      id: 'width',
      type: 'dimension',
      label: 'Width',
      axis: 'x',
      unit: 'cm',
      targets: ['top'],
      defaultOptionId: 'w140',
      options: [
        { id: 'w120', label: '120', value: 120, scale: 120 / 140, priceDelta: -60 },
        { id: 'w140', label: '140', value: 140, scale: 1 },
        { id: 'w160', label: '160', value: 160, scale: 160 / 140, priceDelta: 90 },
      ],
    },
    {
      // Segmented buttons. Moves or rotates glTF nodes relative to how they were exported.
      // Rotations are Euler degrees around the node's origin, so hinged parts need a pivot
      // node on the hinge line (see step 1). Offsets from several pose groups add up.
      id: 'touch-tilt',
      type: 'pose',
      label: 'Touch screen tilt',
      // `requires` makes a group (or a single option) depend on earlier groups. While the
      // dependency does not hold the group is shown disabled with a hint and its selection
      // falls back to the default; the referenced group must be declared above this one.
      requires: [{ groupId: 'touch-screen', optionIds: ['with'] }],
      defaultOptionId: 'flat',
      options: [
        { id: 'flat', label: 'Flat', transforms: [] },
        {
          id: 'tilt30',
          label: '30°',
          transforms: [{ nodes: ['TouchScreenPivot_27'], rotation: [30, 0, 0] }],
        },
        {
          // One option may pose several nodes with different values, e.g. each screen size's
          // pivot by the angle at which its far edge meets the 4K screen.
          id: 'drafting',
          label: 'Drafting (meets 4K screen)',
          transforms: [
            { nodes: ['TouchScreenPivot_24'], rotation: [58.2, 0, 0] },
            { nodes: ['TouchScreenPivot_27'], rotation: [49.1, 0, 0] },
          ],
        },
      ],
    },
    // A `position` offset works the same way, e.g. a sit/stand lift:
    // transforms: [{ nodes: ['TopAssembly'], position: [0, 0.35, 0] }]
  ],
};
```

Definitions are validated when the app starts. A typo in a part id, a missing default option, a
toggle on a non-optional part, a `requires` that points at an unknown or later group or a
`screen` group that targets a part without screens fails immediately with a message that points
at the offending field. Node names that do not exist in
the `.glb` are reported in the browser console.

### 3. Check it

`npm run dev`, open `http://localhost:5173/?product=<product-id>`, click through every option.

## Deployment

Every push to `main` builds the app and deploys it to GitHub Pages at
<https://arthovis-org.github.io/ProductConfigurator/> through the
`.github/workflows/deploy-pages.yml` GitHub Actions workflow (build with
`--base=/ProductConfigurator/`, then `actions/deploy-pages`). The workflow can also be run by hand
from the repository's **Actions** tab via _Run workflow_. Static assets referenced from product
definitions must go through `publicAsset()` so they resolve under the deployment sub-path.

## Screens: content inside the displays

Any part can declare display surfaces, and the viewer draws abstract app mockups on them so
users see their workflow on the product rather than a black panel.

### Declaring a screen

```ts
{
  id: 'monitor-4k',
  label: '4K screen',
  nodes: ['MonitorMount'],
  optional: true,
  screens: [
    {
      node: 'Monitor4K_Panel', // the panel mesh (a thin box or plane)
      widthPx: 3840, // sets the aspect ratio and texture resolution (longest side <= 1920)
      heightPx: 2160,
      kind: 'display', // or 'touch' for tiles, sliders and wheels instead of windows
      content: { layout: 'two-up' }, // defaults; screen groups override facets
    },
  ],
},
```

The panel's texture runs along local +X (right) and local +Y (up) for a vertical panel facing
+Z, or local -Z (away from the user) for a horizontal panel facing +Y, which is what a
Blender box or plane exports by default. The thinnest axis of the mesh is taken as the normal.
A part whose nodes sit under another part's nodes (one touch screen size under the touch screen
assembly) declares `partOf: '<parent part id>'` so its screens count as hidden with the parent.

### Controlling what screens show

A `screen` option group changes one or more content facets on the screens of its `targets`;
facets from several groups merge in declaration order, so one group picks the OS for every
screen and another the layout of a single one. The group is disabled with "Requires a screen"
while every target part is hidden.

```ts
{
  id: 'layout-4k',
  type: 'screen',
  label: '4K screen layout',
  targets: ['monitor-4k'],
  requires: [{ groupId: 'monitor-4k', optionIds: ['with'] }],
  defaultOptionId: 'two-up',
  options: [
    { id: 'single', label: 'Single', content: { layout: 'single' } },
    { id: 'grid-2x2', label: '2×2 grid', content: { layout: 'grid-2x2' } },
  ],
},
```

The facets are `layout` (`single`, `two-up`, `three-column`, `grid-2x2`, `sidebar-main`, `pip`,
`stack`), `workflow` (`design`, `trading`, `coding`, `video`, `writing`) and `os` (`mac`,
`windows`, `linux`, `chromeos`, all drawn as generic desktop chrome). The panel gathers screen
groups into a **Screens** section with a **Show the 3D workspace** button that lifts the
windows off the displays as floating cards, fades the desktops to a dark backdrop and turns
touch screens into control surfaces; the button reverses the animation.

### Adding a layout, workflow or OS style

- **Layout**: add the id to `LAYOUT_IDS` in `schema.ts` and return its panes from
  `layoutPanes()` in `src/screens/layouts.ts` (normalised rects with a `main`, `secondary` or
  `pip` role; `pip` panes are drawn last).
- **Workflow**: add the id to `WORKFLOW_IDS` and an entry in `src/screens/workflows.ts` listing
  its apps in priority order plus their touch counterparts. New app mockups are functions in
  `src/screens/apps.ts` that draw into a rect with the helpers in `draw.ts`; keep them abstract
  (bars, panels, charts) and use `palette.ts`.
- **OS style**: add the id to `OS_IDS` and a style in `src/screens/os.ts` (wallpaper stops, bar
  placement, window radius, control placement and shape).

## Smart desk geometry

The placeholder smart desk keeps the touch screen and the 4K screen in a fixed relationship:
the touch screen lies flush in the top with its hinge along the front edge, and its steepest
preset raises the far edge until it stops just under the bottom edge of the 4K screen. Because a
larger panel reaches that edge at a shallower angle, `scripts/generate-smart-desk.mjs` solves the
angle and the hinge position per size from the 4K screen's position and writes them to
`src/products/definitions/smart-desk.geometry.json`, which the definition imports for the
"Drafting" option. Change the screen sizes or the 4K mount in the generator, run
`npm run generate:models`, and the presets follow.

## Known limitations

- `dimension` groups use a non-uniform scale, which stretches geometry. Real parametric sizing
  needs one mesh per size (model them as a `variant`) or a bespoke solution.
- Texture maps referenced by a material preset are loaded on demand; the first switch to a
  textured preset shows the loading indicator briefly.
- No Draco/KTX2 decoding yet; export uncompressed or add the decoders to `useGLTF`.
- When several `pose` groups move the same node their Euler angles are added component-wise,
  which is only exact while they rotate around a single axis. Use one pose group per hinge.
