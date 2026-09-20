# Product Configurator

An interactive 3D product configurator for the browser. A product is a glTF model plus one
TypeScript definition file that describes which parts can be swapped, recoloured, toggled or
resized. The viewer, the option panel, pricing and shareable links are all derived from that
definition, so adding a product means adding a `.glb` and a definition, not UI code.

The first real product will be a smart desk modelled in Blender; until it lands the app ships
with a procedurally generated placeholder desk that exercises every option type.

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

| Script                         | Purpose                                              |
| ------------------------------ | ---------------------------------------------------- |
| `npm run build`                | Type-check and produce a production build in `dist/` |
| `npm run preview`              | Serve the production build locally                   |
| `npm run lint`                 | ESLint (type-aware)                                  |
| `npm run typecheck`            | `tsc --noEmit` for app and config                    |
| `npm run format`               | Prettier                                             |
| `npm run generate:placeholder` | Regenerate `public/models/placeholder-desk.glb`      |

Open a specific product with `?product=<id>`; the current configuration is kept in the URL
(`&c=group:option,...`) so the address bar is always a shareable link.

## Project layout

```
src/
  products/
    schema.ts              zod schema + TypeScript types for a ProductDefinition
    index.ts               registry; validates every definition at import time
    definitions/           one file per product
  state/
    configuratorStore.ts   zustand store: product, selections, reset, serialize/hydrate
    derive.ts              pure functions: selections -> hidden nodes, materials, scales, price
    urlState.ts            query-string encoding of a configuration
  viewer/                  Canvas, lighting, model loading, per-part appearance
  ui/                      option panel, controls, header, price summary
  App.tsx                  layout and URL sync
scripts/
  generate-placeholder-model.mjs   builds the placeholder .glb from boxes
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
import type { ProductDefinitionInput } from '../schema';

export const smartDesk: ProductDefinitionInput = {
  id: 'smart-desk', // lowercase, dashes; used in URLs
  name: 'Smart Desk',
  description: 'Height-adjustable desk with integrated cable management.',
  model: { src: '/models/smart-desk.glb' }, // optional: scale, position, rotation
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
  ],
};
```

Definitions are validated when the app starts. A typo in a part id, a missing default option or
a toggle on a non-optional part fails immediately with a message that points at the offending
field. Node names that do not exist in the `.glb` are reported in the browser console.

### 3. Check it

`npm run dev`, open `http://localhost:5173/?product=<product-id>`, click through every option.

## Known limitations

- `dimension` groups use a non-uniform scale, which stretches geometry. Real parametric sizing
  needs one mesh per size (model them as a `variant`) or a bespoke solution.
- Texture maps referenced by a material preset are loaded on demand; the first switch to a
  textured preset shows the loading indicator briefly.
- No Draco/KTX2 decoding yet; export uncompressed or add the decoders to `useGLTF`.
