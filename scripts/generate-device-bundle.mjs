/**
 * Generates `public/models/device-bundle.glb`: a mat with placeholder devices.
 *
 * Each device is a node that a toggle can hide; the meshes that take the bundle
 * colour are named `*_Body`/`*_Grip*` so a material group can target them without
 * recolouring screens, chips or the mat.
 *
 * Usage: `npm run generate:models`
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GltfBuilder, quat } from './gltf-builder.mjs';

const OUT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../public/models/device-bundle.glb',
);

const b = new GltfBuilder('DeviceBundle');

const materials = {
  mat: b.material('Mat', [0.16, 0.16, 0.17], { roughness: 0.95, metalness: 0 }),
  body: b.material('Body', [0.2, 0.2, 0.22], { roughness: 0.4, metalness: 0.6 }),
  bezel: b.material('Bezel', [0.05, 0.05, 0.055], { roughness: 0.35, metalness: 0.2 }),
  screen: b.material('Screen', [0.01, 0.012, 0.02], {
    roughness: 0.12,
    metalness: 0,
    emissive: [0.05, 0.09, 0.15],
  }),
  card: b.material('Card', [0.09, 0.13, 0.22], { roughness: 0.3, metalness: 0.8 }),
  gold: b.material('Gold', [0.83, 0.65, 0.3], { roughness: 0.25, metalness: 1 }),
};

const MAT_H = 0.012;
const ON_MAT = MAT_H; // y of the mat surface

const mat = b.node('Mat', {
  position: [0, MAT_H / 2, 0],
  mesh: b.box('MatMesh', [0.84, MAT_H, 0.5], materials.mat, 0.005),
});

// Laptop: base slab with a keyboard inset; the lid hangs from a hinge node tilted back 20°.
const LAPTOP = { w: 0.31, d: 0.22, baseH: 0.016, lidH: 0.2, lidT: 0.008 };
const laptop = b.node('Laptop', {
  position: [-0.2, ON_MAT, 0],
  children: [
    b.node('Laptop_Base', {
      position: [0, LAPTOP.baseH / 2, 0],
      mesh: b.box('Laptop_BaseMesh', [LAPTOP.w, LAPTOP.baseH, LAPTOP.d], materials.body, 0.005),
    }),
    b.node('Laptop_Keyboard', {
      position: [0, LAPTOP.baseH + 0.0005, -0.03],
      mesh: b.box('Laptop_KeyboardMesh', [0.27, 0.001, 0.11], materials.bezel),
    }),
    b.node('Laptop_Trackpad', {
      position: [0, LAPTOP.baseH + 0.0005, 0.065],
      mesh: b.box('Laptop_TrackpadMesh', [0.12, 0.001, 0.07], materials.bezel),
    }),
    b.node('Laptop_Hinge', {
      position: [0, LAPTOP.baseH, -LAPTOP.d / 2 + LAPTOP.lidT / 2],
      rotation: quat([1, 0, 0], -20),
      children: [
        b.node('Laptop_Lid', {
          position: [0, LAPTOP.lidH / 2, 0],
          mesh: b.box(
            'Laptop_LidMesh',
            [LAPTOP.w, LAPTOP.lidH, LAPTOP.lidT],
            materials.body,
            0.003,
          ),
          children: [
            b.node('Laptop_Screen', {
              position: [0, 0.004, LAPTOP.lidT / 2 + 0.0005],
              mesh: b.box(
                'Laptop_ScreenMesh',
                [LAPTOP.w - 0.02, LAPTOP.lidH - 0.028, 0.001],
                materials.screen,
              ),
            }),
          ],
        }),
      ],
    }),
  ],
});

// Gamepad-style phone: a slim phone with a thicker grip on each side.
const PHONE = { w: 0.16, d: 0.075, h: 0.008, gripW: 0.05, gripH: 0.022, gripD: 0.09 };
const grip = b.box('Phone_GripMesh', [PHONE.gripW, PHONE.gripH, PHONE.gripD], materials.body, 0.01);
const gamepadPhone = b.node('GamepadPhone', {
  position: [0.15, ON_MAT, 0.13],
  rotation: quat([0, 1, 0], 6),
  children: [
    b.node('Phone_Body', {
      position: [0, PHONE.h / 2, 0],
      mesh: b.box('Phone_BodyMesh', [PHONE.w, PHONE.h, PHONE.d], materials.body, 0.003),
    }),
    b.node('Phone_Screen', {
      position: [0, PHONE.h + 0.0005, 0],
      mesh: b.box('Phone_ScreenMesh', [PHONE.w - 0.008, 0.001, PHONE.d - 0.006], materials.screen),
    }),
    b.node('Phone_GripLeft', {
      position: [-(PHONE.w / 2 + PHONE.gripW / 2 - 0.008), PHONE.gripH / 2, 0],
      mesh: grip,
    }),
    b.node('Phone_GripRight', {
      position: [PHONE.w / 2 + PHONE.gripW / 2 - 0.008, PHONE.gripH / 2, 0],
      mesh: grip,
    }),
  ],
});

// Stylus lying along Z with a short cone tip.
const STYLUS = { r: 0.0045, length: 0.16, tip: 0.014 };
const stylus = b.node('Stylus', {
  position: [0.36, ON_MAT + STYLUS.r, 0],
  rotation: quat([0, 1, 0], 12),
  children: [
    b.node('Stylus_Body', {
      rotation: quat([1, 0, 0], 90),
      mesh: b.cylinder(
        'Stylus_BodyMesh',
        { radiusTop: STYLUS.r, height: STYLUS.length },
        materials.body,
      ),
    }),
    b.node('Stylus_Tip', {
      position: [0, 0, STYLUS.length / 2 + STYLUS.tip / 2],
      rotation: quat([1, 0, 0], 90),
      mesh: b.cylinder(
        'Stylus_TipMesh',
        { radiusTop: 0.001, radiusBottom: STYLUS.r, height: STYLUS.tip },
        materials.bezel,
      ),
    }),
  ],
});

// Credit card (ISO/IEC 7810 ID-1) with a chip.
const CARD = { w: 0.0856, d: 0.054, h: 0.0012 };
const creditCard = b.node('CreditCard', {
  position: [0.1, ON_MAT, -0.12],
  rotation: quat([0, 1, 0], -8),
  children: [
    b.node('Card_Body', {
      position: [0, CARD.h / 2, 0],
      mesh: b.box('Card_BodyMesh', [CARD.w, CARD.h, CARD.d], materials.card, 0.0005),
    }),
    b.node('Card_Chip', {
      position: [-0.028, CARD.h + 0.0003, -0.006],
      mesh: b.box('Card_ChipMesh', [0.011, 0.0006, 0.009], materials.gold),
    }),
  ],
});

// Earbuds case: a pebble-shaped rounded box with a lid seam.
const CASE = { w: 0.06, h: 0.026, d: 0.05 };
const earbudsCase = b.node('EarbudsCase', {
  position: [0.24, ON_MAT, -0.12],
  rotation: quat([0, 1, 0], 20),
  children: [
    b.node('EarbudsCase_Body', {
      position: [0, CASE.h / 2, 0],
      mesh: b.box('EarbudsCase_BodyMesh', [CASE.w, CASE.h, CASE.d], materials.body, 0.012),
    }),
    b.node('EarbudsCase_Seam', {
      position: [0, CASE.h * 0.6, 0],
      mesh: b.box(
        'EarbudsCase_SeamMesh',
        [CASE.w + 0.0006, 0.0008, CASE.d + 0.0006],
        materials.bezel,
        0.0003,
      ),
    }),
  ],
});

b.add(mat, laptop, gamepadPhone, stylus, creditCard, earbudsCase);

await b.write(OUT_PATH);
