# Products

One folder per product. The folder name is the product id used in links
(`?product=smart-desk`): lowercase letters, digits and dashes.

```
products/
  smart-desk/
    model.glb          the Blender export, used exactly as exported (required)
    product.json       name, prices, defaults, height range (optional)
    materials/         PBR finish texture sets (optional)
      DeskMat/
        walnut/        walnut_diff_2k.jpg, walnut_nor_gl_2k.jpg, walnut_arm_2k.jpg
```

Drop a folder in and the configurator picks it up; while `npm run dev` runs, saving any file in
here reloads the page. `npm run inspect -- smart-desk` shows what was recognised and what needs
fixing, and the same list appears in the app in development.

## Object names

Name objects in Blender with these prefixes. Everything else about the model is left alone.

| Name                                           | Becomes                                            |
| ---------------------------------------------- | -------------------------------------------------- |
| `Toggle_SideMonitors`                          | an on/off option "Side monitors"                   |
| `Toggle_SideMonitors_Left`, `…_Right`          | the same option; everything after the name is free |
| `Variant_Legs_Straight`, `Variant_Legs_TShape` | a pick-one option "Legs": Straight / T shape       |
| `Lift100_Top`                                  | moves 100 % with the height control                |
| `Lift50_Leg_L_Middle`                          | moves 50 % (middle stage of a three-stage leg)     |

- Tags combine, `Lift<n>` first: `Lift100_Toggle_DeskMonitor` rises with the desk and can be
  switched off.
- Children follow their parent. Parent the monitors to the top in Blender and only the top needs
  `Lift100`; an object inside a toggled object disappears with it.
- Labels come from the name (`SideMonitors` → "Side monitors"); `product.json` can override them.

### Three-stage legs

The top and everything on it rise by the full height change, the middle stage by half of it, and
the base stays on the floor:

```
Lift100_Top              (monitors, arm etc. parented to it, or tagged Lift100 themselves)
Lift100_Leg_L_Upper      Lift100_Leg_R_Upper
Lift50_Leg_L_Middle      Lift50_Leg_R_Middle
Leg_L_Base               Leg_R_Base
```

The current height is measured from the top surface of the `Lift` object named like "top" or
"desk" (or `height.reference`), so the model can be exported at any height.

## Materials

A folder under `materials/` named after a **Blender material** adds a finish option for every
mesh that uses that material. Each sub-folder is one choice, holding a PBR texture set:

```
materials/
  DeskMat/                         the Blender material's name
    walnut/                        one choice ("Walnut")
      walnut_diff_2k.jpg           colour (base colour / albedo)
      walnut_nor_gl_2k.jpg         normal map
      walnut_arm_2k.jpg            packed AO + roughness + metalness
      swatch.jpg                   optional small image for the swatch button
    white-oak/
      Wood049_2K_Color.jpg
      Wood049_2K_NormalGL.jpg
      Wood049_2K_Roughness.jpg
      Wood049_2K_AmbientOcclusion.jpg
```

Files keep the names the texture site gave them; the map type is read from the words in the
name:

| Map       | Recognised words                                                |
| --------- | --------------------------------------------------------------- |
| Colour    | `color`, `colour`, `basecolor`, `albedo`, `diff`, `diffuse`     |
| Normal    | `normal`, `nor`, `nrm`, `normalgl`; `dx` / `normaldx` = DirectX |
| Roughness | `roughness`, `rough`                                            |
| Metalness | `metalness`, `metallic`, `metal`                                |
| AO        | `ao`, `occlusion`, `ambientocclusion`                           |
| Packed    | `arm`, `orm` (R = AO, G = roughness, B = metalness)             |
| Swatch    | `swatch`, `thumb`, `preview`                                    |
| Ignored   | `displacement`, `height`, `bump`, `opacity`, `specular` …       |

- **Normal maps:** three.js expects OpenGL-style. DirectX ones (`_dx`, `NormalDX`) are flipped
  automatically; if one is not named so, set `"normalDirectX": true` for the choice.
- **Glossiness** maps are inverted roughness and are reported; download the roughness version.
- The first choice is "As modelled" (the material exactly as exported) unless `product.json`
  says otherwise.
- A single image works too: `materials/DeskMat/walnut.jpg` is a colour-only choice, and
  `walnut_normal.jpg` next to it adds a normal map.

Settings per choice go in `product.json` (`materials.<Material>.choices.<choice>`):

| Setting          | Default   | Use                                                        |
| ---------------- | --------- | ---------------------------------------------------------- |
| `repeat`         | `1`       | tile the textures `n` times across the UV map, or `[u, v]` |
| `rotation`       | `0`       | degrees, e.g. `90` to turn the wood grain                  |
| `normalScale`    | `1`       | strength of the normal map                                 |
| `roughness`      | map / 0.6 | multiplies the roughness map (1 = as the map says)         |
| `metalness`      | map / 0   | multiplies the metalness map                               |
| `color`          | white     | tint multiplied with the colour map                        |
| `label`, `price` |           | as for other options                                       |

### Preparing the model in Blender

The textures follow the mesh's **UV map**, so it decides how big the wood grain looks:

1. Select the desk top, Tab into Edit Mode, select all, then _UV > Cube Projection_ (or _Smart
   UV Project_). Box-like parts unwrap cleanly this way, edges included.
2. Make the scale consistent: with _UV > Average Islands Scale_ and _Pack Islands_ off, 1 UV unit
   then covers roughly the same area everywhere, so the grain is the same size on the top and
   on the edges.
3. For a tileable texture that covers about 1 m, set the UV scale so 1 UV unit ≈ 1 m (in the UV
   editor, scale until a 1 m square fills the 0–1 square), then tune with `repeat`.
4. Rotate the top's UV island so the grain runs along the desk's length, or use `rotation`.
5. Keep the material assigned to the top named exactly like its folder (`DeskMat`).

Previewing the texture set in Blender first (Principled BSDF, same images) is the quickest way
to judge scale; what you see there with 1 UV unit ≈ 1 m is what `repeat: 1` shows here.

### Keeping it light

- Use **1K or 2K** textures (1024–2048 px); 4K and 8K sets add megabytes and GPU memory for no
  visible gain on a desk top. JPG for colour, normal and roughness is fine.
- Only the selected choice's maps are downloaded, but every swatch button shows an image: add a
  small `swatch.jpg` (about 128 px) per choice, otherwise the full colour map is used.

## product.json

Everything is optional. Keys refer to names from Blender (case and underscores don't matter).

```json
{
  "name": "Smart Desk",
  "description": "Motorised sit-stand desk with an integrated three-monitor arm.",
  "currency": "EUR",
  "basePrice": 899,
  "order": 1,

  "options": {
    "SideMonitors": { "label": "Side monitors", "price": 598 },
    "DeskMonitor": { "price": 349, "default": false },
    "Legs": { "default": "Straight", "choices": { "TShape": { "label": "T-frame", "price": 90 } } }
  },

  "materials": {
    "DeskMat": {
      "label": "Desk top",
      "default": "walnut",
      "original": false,
      "choices": {
        "walnut": { "price": 150, "repeat": 2, "rotation": 90 },
        "white": { "label": "White laminate", "color": "#f2f1ec", "roughness": 0.7 }
      }
    }
  },

  "height": {
    "label": "Desk height",
    "unit": "cm",
    "min": 65,
    "max": 125,
    "initial": 72,
    "presets": { "Sit": 72, "Stand": 110 }
  }
}
```

- `options.<Name>`: for a toggle, `price` is the price when on and `default` is `true`/`false`.
  For a variant, `default` names the initial choice and `choices` holds per-choice labels and
  prices.
- `materials.<Material>.choices`: settings for image choices (price, label, roughness,
  metalness), or colour-only choices with `color`. `"original": false` hides "As modelled";
  a string renames it.
- `height`: `min` / `max` should stay within what the leg stages can do without separating.
  `modelled` sets the model's height instead of measuring it, `reference` names the object to
  measure, `speed` is units per second.
- `order`: position in the product switcher; the lowest is the default product.

## Keeping models outside the repository

Set `CONFIGURATOR_PRODUCTS_DIR` to another folder with the same layout, for example to keep large
or private models out of git:

```bash
CONFIGURATOR_PRODUCTS_DIR=../my-products npm run dev
```
